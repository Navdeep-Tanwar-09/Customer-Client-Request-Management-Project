import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getDatabase } from '../../db/database.ts';
import { workspaceAuth, requireUserType } from '../middleware/auth.ts';
import { CustomerRequest, WorkItem } from '../../src/types.ts';
import { getNextWorkItemId, parseRequestId } from '../utils/requestId.ts';
import { sendProblem } from '../utils/problem.ts';
import { isBoundedText, isDateOnly, isJsonObject, isOptionalBoundedText } from '../utils/validation.ts';

const router = Router();
router.use(workspaceAuth, requireUserType('WORKPLACE'));

const WORK_ITEM_SELECT = `
  SELECT wi.*, r.service_title, c.name AS customer_name, u.name AS created_by_user_name
  FROM work_items wi
  JOIN requests r ON r.id = wi.request_id
  JOIN users c ON c.id = r.customer_id
  LEFT JOIN users u ON u.id = wi.created_by_user_id
`;

router.post('/convert/:requestId', (req: Request, res: Response) => {
  const requestId = parseRequestId(req.params.requestId);
  if (requestId === null) {
    sendProblem(req, res, 422, 'INVALID_REQUEST_ID', 'Request ID must be a five-digit integer that does not start with 0.', { requestId: 'Use a five-digit integer that does not start with 0.' });
    return;
  }
  const db = getDatabase();
  const wsId = req.workspace!.id;
  const user = req.user!;
  if (user.user_type !== 'WORKPLACE') {
    sendProblem(req, res, 403, 'WORKPLACE_ONLY', 'Only workplace users can create work items.');
    return;
  }
  const request = db.prepare(`
    SELECT r.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
    FROM requests r JOIN users c ON c.id = r.customer_id
    WHERE r.id = ? AND r.workspace_id = ?
  `).get(requestId, wsId) as CustomerRequest | undefined;
  if (!request) {
    sendProblem(req, res, 404, 'NOT_FOUND', `Request "${requestId}" not found in this workspace.`);
    return;
  }
  if (request.status !== 'QUALIFIED') {
    sendProblem(req, res, 422, 'NOT_QUALIFIED', `Cannot create work: request status must be QUALIFIED. Current status is ${request.status}.`, { requestId: 'The request must have QUALIFIED status.' });
    return;
  }
  if (request.work_item_id) {
    const existing = db.prepare(`${WORK_ITEM_SELECT} WHERE wi.work_item_id = ?`).get(request.work_item_id);
    sendProblem(req, res, 409, 'ALREADY_CONVERTED', `Work item ${request.work_item_id} already exists for this request.`);
    return;
  }
  const body: unknown = req.body ?? {};
  if (!isJsonObject(body)) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Conversion body must be a JSON object.', { body: 'Conversion body must be a JSON object.' });
    return;
  }
  const { scheduled_date, assigned_technician, notes } = body;
  const errors: Record<string, string> = {};
  if (!isDateOnly(scheduled_date)) errors.scheduled_date = 'Scheduled date must be a valid YYYY-MM-DD date.';
  if (assigned_technician !== undefined && !isBoundedText(assigned_technician, 1, 160)) errors.assigned_technician = 'Assigned technician must be between 1 and 160 characters.';
  if (!isOptionalBoundedText(notes, 10000)) errors.notes = 'Notes must be text with at most 10000 characters.';
  if (Object.keys(errors).length) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Conversion payload failed validation.', errors);
    return;
  }
  const scheduledDate = isDateOnly(scheduled_date) ? scheduled_date : '';
  let workItemId: number;
  try { workItemId = getNextWorkItemId(db); } catch {
    sendProblem(req, res, 503, 'WORK_ITEM_ID_CAPACITY_REACHED', 'All six-digit work item IDs have been used.');
    return;
  }
  const createdAt = new Date().toISOString();
  const description = typeof notes === 'string' && notes.trim() ? notes.trim() : request.description;
  const assignedTechnician = typeof assigned_technician === 'string' && assigned_technician.trim()
    ? assigned_technician.trim()
    : 'Unassigned';
  try {
    db.exec('BEGIN TRANSACTION;');
    db.prepare(`
      INSERT INTO work_items (work_item_id, request_id, scheduled_date, assigned_technician, description, status, created_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, 'SCHEDULED', ?, ?)
    `).run(workItemId, requestId, scheduledDate, assignedTechnician, description, user.id, createdAt);
    db.prepare('UPDATE requests SET work_item_id = ? WHERE id = ? AND workspace_id = ?').run(workItemId, requestId, wsId);
    db.prepare(`INSERT INTO activity_log (id, workspace_id, request_id, actor_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(`act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, wsId, requestId, user.id, 'CONVERTED_TO_WORK_ITEM', JSON.stringify({ workItemId, scheduledDate, assignedTechnician }), createdAt);
    db.exec('COMMIT;');
  } catch (error: unknown) {
    try { db.exec('ROLLBACK;'); } catch {}
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      sendProblem(req, res, 409, 'DUPLICATE_CONVERSION', 'A work item already exists for this request.');
      return;
    }
    throw error;
  }
  const workItem = db.prepare(`${WORK_ITEM_SELECT} WHERE wi.work_item_id = ?`).get(workItemId) as unknown as WorkItem;
  const updatedRequest = db.prepare(`
    SELECT r.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
    FROM requests r JOIN users c ON c.id = r.customer_id WHERE r.id = ?
  `).get(requestId) as unknown as CustomerRequest;
  res.status(201).json({ data: { work_item: workItem, request: updatedRequest }, message: `Work item ${workItemId} created successfully.` });
});

export default router;
