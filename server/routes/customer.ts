import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getDatabase } from '../../db/database.ts';
import { workspaceAuth, requireUserType } from '../middleware/auth.ts';
import { CustomerRequest } from '../../src/types.ts';
import { getNextRequestId } from '../utils/requestId.ts';
import { sendProblem } from '../utils/problem.ts';
import { isBoundedText, isJsonObject, isOptionalDateOnly, isOptionalBoundedText } from '../utils/validation.ts';

const router = Router();
router.use(workspaceAuth, requireUserType('CUSTOMER'));

router.get('/my-requests', (req: Request, res: Response) => {
  const db = getDatabase();
  const customerId = req.user!.id;
  const requests = db.prepare(`
    SELECT r.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
           w.name AS workspace_name, wi.work_item_id, wi.scheduled_date AS work_order_scheduled_date,
           wi.assigned_technician AS work_order_technician, wi.status AS work_order_status
    FROM requests r
    JOIN users c ON c.id = r.customer_id
    JOIN workspaces w ON w.id = r.workspace_id
    LEFT JOIN work_items wi ON wi.work_item_id = r.work_item_id
    WHERE r.customer_id = ?
    ORDER BY r.created_at DESC
  `).all(customerId) as unknown as CustomerRequest[];
  res.json({ data: requests, total: requests.length });
});

router.post('/my-requests', (req: Request, res: Response) => {
  const db = getDatabase();
  const customer = req.user!;
  if (customer.user_type !== 'CUSTOMER') {
    sendProblem(req, res, 403, 'CUSTOMER_ONLY', 'Only customer accounts can create customer requests.');
    return;
  }
  const body: unknown = req.body ?? {};
  if (!isJsonObject(body)) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Request body must be a JSON object.', { body: 'Request body must be a JSON object.' });
    return;
  }
  const { workspace_id, service_title, description, preferred_date, customer_phone } = body;
  const errors: Record<string, string> = {};
  if (typeof workspace_id !== 'string' || !workspace_id.trim()) {
    errors.workspace_id = 'Select a valid workplace.';
  } else if (!db.prepare('SELECT id FROM workspaces WHERE id = ?').get(workspace_id.trim())) {
    errors.workspace_id = 'Select a valid workplace.';
  }
  if (!isBoundedText(service_title, 2, 200)) errors.service_title = 'Service title must be between 2 and 200 characters.';
  if (!isBoundedText(description, 2, 10000)) errors.description = 'Description must be between 2 and 10000 characters.';
  if (!isOptionalDateOnly(preferred_date)) errors.preferred_date = 'Preferred date must be a valid YYYY-MM-DD date or null.';
  if (!isOptionalBoundedText(customer_phone, 64)) errors.customer_phone = 'Phone must be text with at most 64 characters.';
  if (Object.keys(errors).length) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Request failed validation.', errors);
    return;
  }
  const workspaceId = typeof workspace_id === 'string' ? workspace_id.trim() : '';
  const serviceTitle = typeof service_title === 'string' ? service_title.trim() : '';
  const requestDescription = typeof description === 'string' ? description.trim() : '';
  const preferredDate = typeof preferred_date === 'string' ? preferred_date : null;
  const currentPhone = customer.phone ?? null;
  const phone = typeof customer_phone === 'string' && customer_phone.trim()
    ? customer_phone.trim()
    : currentPhone;
  let id: number;
  try { id = getNextRequestId(db); } catch {
    sendProblem(req, res, 503, 'REQUEST_ID_CAPACITY_REACHED', 'All available five-digit request IDs have been used.');
    return;
  }
  const createdAt = new Date().toISOString();
  try {
    db.exec('BEGIN TRANSACTION;');
    if (phone !== currentPhone) {
      db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, customer.id);
    }
    db.prepare(`
      INSERT INTO requests (id, workspace_id, customer_id, description, service_title, status, preferred_date, work_item_id, created_at)
      VALUES (?, ?, ?, ?, ?, 'NEW', ?, NULL, ?)
    `).run(id, workspaceId, customer.id, requestDescription, serviceTitle, preferredDate, createdAt);
    db.prepare(`INSERT INTO activity_log (id, workspace_id, request_id, actor_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(`act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, workspaceId, id, customer.id, 'REQUEST_CREATED', JSON.stringify({ serviceTitle, customerName: customer.name, status: 'NEW' }), createdAt);
    db.exec('COMMIT;');
  } catch (error) {
    try { db.exec('ROLLBACK;'); } catch {}
    throw error;
  }
  const created = db.prepare(`
    SELECT r.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
    FROM requests r JOIN users c ON c.id = r.customer_id WHERE r.id = ?
  `).get(id) as unknown as CustomerRequest;
  res.status(201).json({ data: created, message: 'Request created successfully.' });
});

export default router;
