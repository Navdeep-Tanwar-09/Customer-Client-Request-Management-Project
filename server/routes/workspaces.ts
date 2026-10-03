import { Router, Request, Response } from 'express';
import { getDatabase } from '../../db/database.ts';
import { seed } from '../../db/seed.ts';
import { workspaceAuth, requireUserType } from '../middleware/auth.ts';
import { WorkspaceStats } from '../../src/types.ts';

interface WorkspaceDirectoryRow {
  id: string;
  name: string;
  industry: string;
  created_at: string;
}

interface CountRow {
  count: number;
}

const router = Router();

// Public: Get all workspaces and their users (for mock login / workspace switcher)
router.get('/', (req: Request, res: Response) => {
  const db = getDatabase();
  let workspaces = db.prepare('SELECT * FROM workspaces ORDER BY name ASC').all() as unknown as WorkspaceDirectoryRow[];

  // If database is empty, auto-seed
  if (workspaces.length === 0) {
    console.log('[Workspaces Route] Workspaces table empty. Running seed...');
    seed();
    workspaces = db.prepare('SELECT * FROM workspaces ORDER BY name ASC').all() as unknown as WorkspaceDirectoryRow[];
  }

  // This small directory is public so customers can select a workspace before creating a request.
  res.json({ data: workspaces.map(({ id, name, industry, created_at }) => ({ id, name, industry, created_at })) });
});

// Authenticated: Get current workspace details and workspace-scoped statistics
router.get('/current', workspaceAuth, requireUserType('WORKPLACE'), (req: Request, res: Response) => {
  const db = getDatabase();
  const wsId = req.workspace!.id;

  const totalRequests = (db.prepare('SELECT COUNT(*) as count FROM requests WHERE workspace_id = ?').get(wsId) as CountRow | undefined)?.count || 0;
  const newRequests = (db.prepare('SELECT COUNT(*) as count FROM requests WHERE workspace_id = ? AND status = ?').get(wsId, 'NEW') as CountRow | undefined)?.count || 0;
  const qualifiedRequests = (db.prepare('SELECT COUNT(*) as count FROM requests WHERE workspace_id = ? AND status = ?').get(wsId, 'QUALIFIED') as CountRow | undefined)?.count || 0;
  const closedRequests = (db.prepare('SELECT COUNT(*) as count FROM requests WHERE workspace_id = ? AND status = ?').get(wsId, 'CLOSED') as CountRow | undefined)?.count || 0;
  const workItemsCount = (db.prepare(`
    SELECT COUNT(*) as count FROM work_items wi
    JOIN requests r ON r.id = wi.request_id
    WHERE r.workspace_id = ?
  `).get(wsId) as CountRow | undefined)?.count || 0;

  res.json({
    workspace: req.workspace,
    user: req.user,
    stats: {
      totalRequests,
      newRequests,
      qualifiedRequests,
      closedRequests,
      workItemsCount
    } satisfies WorkspaceStats
  });
});

export default router;
