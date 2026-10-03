import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getDatabase } from '../../db/database.ts';
import { workspaceAuth, requireUserType } from '../middleware/auth.ts';
import { ActivityEntry } from '../../src/types.ts';
import { parseRequestId } from '../utils/requestId.ts';
import { sendProblem } from '../utils/problem.ts';
import { isBoundedText, isJsonObject } from '../utils/validation.ts';

const router = Router();
router.use(workspaceAuth);

const ACTIVITY_SELECT = `
  SELECT a.*, actor.name AS actor_name, c.name AS customer_name, r.service_title, r.status AS request_status
  FROM activity_log a
  JOIN requests r ON r.id = a.request_id
  JOIN users c ON c.id = r.customer_id
  LEFT JOIN users actor ON actor.id = a.actor_id
`;

router.get('/feed', (req: Request, res: Response) => {
  const db = getDatabase();
  const user = req.user!;
  const query = user.user_type === 'CUSTOMER'
    ? `${ACTIVITY_SELECT} WHERE r.customer_id = ? ORDER BY a.created_at DESC LIMIT 100`
    : `${ACTIVITY_SELECT} WHERE a.workspace_id = ? ORDER BY a.created_at DESC LIMIT 100`;
  const activities = db.prepare(query).all(user.user_type === 'CUSTOMER' ? user.id : req.workspace!.id) as unknown as ActivityEntry[];
  res.json({ data: activities, total: activities.length });
});

router.get('/requests/:requestId', (req: Request, res: Response) => {
  const requestId = parseRequestId(req.params.requestId);
  if (requestId === null) {
    sendProblem(req, res, 422, 'INVALID_REQUEST_ID', 'Request ID must be a five-digit integer that does not start with 0.', { requestId: 'Use a five-digit integer that does not start with 0.' });
    return;
  }
  const db = getDatabase();
  const wsId = req.workspace!.id;
  const request = db.prepare('SELECT id, customer_id FROM requests WHERE id = ? AND workspace_id = ?').get(requestId, wsId) as { id: number; customer_id: string } | undefined;
  if (!request || (req.user!.user_type === 'CUSTOMER' && request.customer_id !== req.user!.id)) {
    sendProblem(req, res, 404, 'NOT_FOUND', `Request "${requestId}" not found in this workspace.`);
    return;
  }
  const activities = db.prepare(`${ACTIVITY_SELECT} WHERE a.request_id = ? AND a.workspace_id = ? ORDER BY a.created_at DESC`).all(requestId, wsId) as unknown as ActivityEntry[];
  res.json({ data: activities, total: activities.length });
});

router.post('/requests/:requestId', requireUserType('WORKPLACE'), (req: Request, res: Response) => {
  const requestId = parseRequestId(req.params.requestId);
  if (requestId === null) {
    sendProblem(req, res, 422, 'INVALID_REQUEST_ID', 'Request ID must be a five-digit integer that does not start with 0.', { requestId: 'Use a five-digit integer that does not start with 0.' });
    return;
  }
  const body: unknown = req.body ?? {};
  if (!isJsonObject(body)) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Note body must be a JSON object.', { body: 'Note body must be a JSON object.' });
    return;
  }
  const { note } = body;
  if (!isBoundedText(note, 1, 2000)) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Note must be between 1 and 2000 characters.', { note: 'Note must be between 1 and 2000 characters.' });
    return;
  }
  const db = getDatabase();
  const wsId = req.workspace!.id;
  if (!db.prepare('SELECT id FROM requests WHERE id = ? AND workspace_id = ?').get(requestId, wsId)) {
    sendProblem(req, res, 404, 'NOT_FOUND', `Request "${requestId}" not found in this workspace.`);
    return;
  }
  const id = `act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const createdAt = new Date().toISOString();
  db.prepare(`INSERT INTO activity_log (id, workspace_id, request_id, actor_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, wsId, requestId, req.user!.id, 'NOTE_ADDED', JSON.stringify({ note: note.trim() }), createdAt);
  const entry = db.prepare(`${ACTIVITY_SELECT} WHERE a.id = ?`).get(id) as unknown as ActivityEntry;
  res.status(201).json({ data: entry });
});

export default router;
