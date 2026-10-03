import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getDatabase } from '../../db/database.ts';
import { workspaceAuth, requireUserType } from '../middleware/auth.ts';
import { CustomerRequest, RequestStatus } from '../../src/types.ts';
import { getNextRequestId, parseRequestId } from '../utils/requestId.ts';
import { sendProblem } from '../utils/problem.ts';
import { isBoundedText, isJsonObject, isOptionalBoundedText, isOptionalDateOnly, isRequestStatus } from '../utils/validation.ts';

const router = Router();
router.use(workspaceAuth, requireUserType('WORKPLACE'));

const REQUEST_SELECT = `
  SELECT r.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
  FROM requests r
  JOIN users c ON c.id = r.customer_id
`;

function sendInvalidId(req: Request, res: Response) {
  sendProblem(req, res, 422, 'INVALID_REQUEST_ID', 'Request ID must be a five-digit integer that does not start with 0.', {
    id: 'Use a five-digit integer that does not start with 0.',
  });
}

router.get('/', (req: Request, res: Response) => {
  const db = getDatabase();
  const wsId = req.workspace!.id;
  const { status, search, sort = 'newest' } = req.query;
  if (status !== undefined && (typeof status !== 'string' || !['ALL', 'NEW', 'QUALIFIED', 'CLOSED'].includes(status))) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Status filter is invalid.', { status: 'Use ALL, NEW, QUALIFIED, or CLOSED.' });
    return;
  }
  if (search !== undefined && (typeof search !== 'string' || search.length > 2000)) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Search must be text with at most 2000 characters.', { search: 'Search must be text with at most 2000 characters.' });
    return;
  }
  if (typeof sort !== 'string' || !['newest', 'oldest'].includes(sort)) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Sort order is invalid.', { sort: 'Use newest or oldest.' });
    return;
  }
  let query = `${REQUEST_SELECT} WHERE r.workspace_id = ?`;
  const params: string[] = [wsId];

  if (status && status !== 'ALL') {
    query += ' AND r.status = ?';
    params.push(status);
  }
  if (typeof search === 'string' && search.trim()) {
    const value = `%${search.trim().toLowerCase()}%`;
    query += ' AND (LOWER(r.service_title) LIKE ? OR LOWER(r.description) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(c.email) LIKE ? OR LOWER(c.phone) LIKE ?)';
    params.push(value, value, value, value, value);
  }
  query += sort === 'oldest' ? ' ORDER BY r.created_at ASC' : ' ORDER BY r.created_at DESC';
  const requests = db.prepare(query).all(...params) as unknown as CustomerRequest[];
  res.json({ data: requests, total: requests.length });
});

router.get('/:id', (req: Request, res: Response) => {
  const requestId = parseRequestId(req.params.id);
  if (requestId === null) return sendInvalidId(req, res);
  const db = getDatabase();
  const wsId = req.workspace!.id;
  const request = db.prepare(`${REQUEST_SELECT} WHERE r.id = ? AND r.workspace_id = ?`).get(requestId, wsId) as CustomerRequest | undefined;
  if (!request) {
    sendProblem(req, res, 404, 'NOT_FOUND', `Request "${requestId}" not found in this workspace.`);
    return;
  }
  res.json({ data: request });
});

router.post('/', (req: Request, res: Response) => {
  const db = getDatabase();
  const body: unknown = req.body ?? {};
  if (!isJsonObject(body)) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Request body must be a JSON object.', { body: 'Request body must be a JSON object.' });
    return;
  }
  const { workspace_id, customer_id, service_title, description, preferred_date, status = 'NEW' } = body;
  const workspaceId = req.workspace!.id;
  if (typeof workspace_id === 'string' && workspace_id !== workspaceId) {
    sendProblem(req, res, 403, 'WORKSPACE_MISMATCH', 'You can only create requests in your assigned workspace.');
    return;
  }
  const errors: Record<string, string> = {};
  if (workspace_id !== undefined && typeof workspace_id !== 'string') errors.workspace_id = 'Workspace ID must be text.';
  if (typeof customer_id !== 'string' || !customer_id.trim()) errors.customer_id = 'A customer ID is required.';
  if (!isBoundedText(service_title, 2, 200)) errors.service_title = 'Service title must be between 2 and 200 characters.';
  if (!isBoundedText(description, 2, 10000)) errors.description = 'Description must be between 2 and 10000 characters.';
  if (status !== 'NEW') errors.status = 'New requests must start with NEW status.';
  if (!isOptionalDateOnly(preferred_date)) errors.preferred_date = 'Preferred date must be a valid YYYY-MM-DD date or null.';
  const customerId = typeof customer_id === 'string' ? customer_id.trim() : '';
  const serviceTitle = typeof service_title === 'string' ? service_title.trim() : '';
  const requestDescription = typeof description === 'string' ? description.trim() : '';
  const preferredDate = typeof preferred_date === 'string' ? preferred_date : null;
  const customer = customerId
    ? db.prepare("SELECT id FROM users WHERE id = ? AND user_type = 'CUSTOMER'").get(customerId)
    : null;
  if (!customer) errors.customer_id = 'The selected customer does not exist.';
  if (Object.keys(errors).length) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Request payload failed validation.', errors);
    return;
  }

  let id: number;
  try { id = getNextRequestId(db); } catch {
    sendProblem(req, res, 503, 'REQUEST_ID_CAPACITY_REACHED', 'All available five-digit request IDs have been used.');
    return;
  }
  const createdAt = new Date().toISOString();
  try {
    db.exec('BEGIN TRANSACTION;');
    db.prepare(`
      INSERT INTO requests (id, workspace_id, customer_id, description, service_title, status, preferred_date, work_item_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `).run(id, workspaceId, customerId, requestDescription, serviceTitle, 'NEW', preferredDate, createdAt);
    db.prepare(`INSERT INTO activity_log (id, workspace_id, request_id, actor_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(`act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, workspaceId, id, req.user!.id, 'REQUEST_CREATED', JSON.stringify({ serviceTitle, status: 'NEW' }), createdAt);
    db.exec('COMMIT;');
  } catch (error) {
    try { db.exec('ROLLBACK;'); } catch {}
    throw error;
  }
  const created = db.prepare(`${REQUEST_SELECT} WHERE r.id = ?`).get(id) as unknown as CustomerRequest;
  res.status(201).json({ data: created });
});

router.patch('/:id', (req: Request, res: Response) => {
  const requestId = parseRequestId(req.params.id);
  if (requestId === null) return sendInvalidId(req, res);
  const db = getDatabase();
  const wsId = req.workspace!.id;
  const existing = db.prepare(`${REQUEST_SELECT} WHERE r.id = ? AND r.workspace_id = ?`).get(requestId, wsId) as CustomerRequest | undefined;
  if (!existing) {
    sendProblem(req, res, 404, 'NOT_FOUND', `Request "${requestId}" not found in this workspace.`);
    return;
  }
  const body: unknown = req.body ?? {};
  if (!isJsonObject(body)) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Update body must be a JSON object.', { body: 'Update body must be a JSON object.' });
    return;
  }
  const { service_title, description, preferred_date, status, activity_note } = body;
  const errors: Record<string, string> = {};
  if (service_title !== undefined && !isBoundedText(service_title, 2, 200)) errors.service_title = 'Service title must be between 2 and 200 characters.';
  if (description !== undefined && !isBoundedText(description, 2, 10000)) errors.description = 'Description must be between 2 and 10000 characters.';
  if (preferred_date !== undefined && !isOptionalDateOnly(preferred_date)) errors.preferred_date = 'Preferred date must be a valid YYYY-MM-DD date or null.';
  if (activity_note !== undefined && !isOptionalBoundedText(activity_note, 2000)) errors.activity_note = 'Activity note must be text with at most 2000 characters.';
  if (status !== undefined && !isRequestStatus(status)) errors.status = 'Invalid request status.';
  else if (status !== undefined && status !== existing.status && status !== 'QUALIFIED' && status !== 'CLOSED') errors.status = 'A request can only be changed to QUALIFIED or CLOSED.';
  if (isRequestStatus(status) && status !== existing.status && existing.status !== 'NEW') {
    sendProblem(req, res, 409, 'STATUS_LOCKED', `Request status is already ${existing.status} and cannot be changed again.`);
    return;
  }
  if (Object.keys(errors).length) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Update payload failed validation.', errors);
    return;
  }
  const nextTitle = typeof service_title === 'string' ? service_title.trim() : existing.service_title;
  const nextDescription = typeof description === 'string' ? description.trim() : existing.description;
  const nextDate = typeof preferred_date === 'string' || preferred_date === null ? preferred_date : existing.preferred_date;
  const nextStatus: RequestStatus = isRequestStatus(status) ? status : existing.status;
  const action = status && status !== existing.status ? 'STATUS_CHANGED' : 'REQUEST_UPDATED';
  const details = action === 'STATUS_CHANGED'
    ? { oldStatus: existing.status, newStatus: nextStatus, note: typeof activity_note === 'string' && activity_note.trim() ? activity_note.trim() : `Status transitioned from ${existing.status} to ${nextStatus}` }
    : { note: typeof activity_note === 'string' && activity_note.trim() ? activity_note.trim() : 'Request details updated by team member' };
  try {
    db.exec('BEGIN TRANSACTION;');
    db.prepare('UPDATE requests SET service_title = ?, description = ?, preferred_date = ?, status = ? WHERE id = ? AND workspace_id = ?')
      .run(nextTitle, nextDescription, nextDate || null, nextStatus, requestId, wsId);
    db.prepare(`INSERT INTO activity_log (id, workspace_id, request_id, actor_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(`act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, wsId, requestId, req.user!.id, action, JSON.stringify(details), new Date().toISOString());
    db.exec('COMMIT;');
  } catch (error) {
    try { db.exec('ROLLBACK;'); } catch {}
    throw error;
  }
  const updated = db.prepare(`${REQUEST_SELECT} WHERE r.id = ?`).get(requestId) as unknown as CustomerRequest;
  res.json({ data: updated });
});

export default router;
