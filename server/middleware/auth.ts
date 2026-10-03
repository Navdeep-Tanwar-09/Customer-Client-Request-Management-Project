import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../db/database.ts';
import { Workspace, User, UserType } from '../../src/types.ts';
import { verifyAccessToken } from '../utils/jwt.ts';
import { sendProblem } from '../utils/problem.ts';

declare global {
  namespace Express {
    interface Request {
      workspace?: Workspace;
      user?: User;
    }
  }
}

function unauthorized(req: Request, res: Response, message = 'A valid Bearer token is required.'): void {
  res.set('WWW-Authenticate', 'Bearer realm="api"');
  sendProblem(req, res, 401, 'UNAUTHORIZED', message);
}

/** Verifies the JWT and reloads the account so deleted or changed users lose access immediately. */
export function jwtAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const match = typeof authHeader === 'string' ? /^Bearer\s+(.+)$/i.exec(authHeader) : null;
  if (!match) {
    unauthorized(req, res);
    return;
  }

  const verified = verifyAccessToken(match[1]);
  if (!verified) {
    unauthorized(req, res, 'The access token is invalid or expired. Please log in again.');
    return;
  }

  const db = getDatabase();
  const row = db.prepare(`
    SELECT id, workspace_id, name, email, user_type, phone
    FROM users WHERE id = ?
  `).get(verified.userId) as User | undefined;
  if (!row) {
    unauthorized(req, res, 'The account for this access token no longer exists.');
    return;
  }

  req.user = row;
  next();
}

/** Adds workspace context while enforcing role and workspace ownership from the database account. */
export function workspaceAuth(req: Request, res: Response, next: NextFunction): void {
  jwtAuth(req, res, () => {
    const db = getDatabase();
    const user = req.user!;
    const requestedWorkspaceId = (req.headers['x-workspace-id'] as string | undefined)
      || (req.query.workspace_id ? String(req.query.workspace_id) : undefined);

    let workspaceId: string | null;
    if (user.user_type === 'WORKPLACE') {
      if (!user.workspace_id) {
        sendProblem(req, res, 403, 'WORKSPACE_REQUIRED', 'This workplace account is not assigned to a workspace.');
        return;
      }
      if (requestedWorkspaceId && requestedWorkspaceId !== user.workspace_id) {
        sendProblem(req, res, 403, 'USER_WORKSPACE_MISMATCH', 'This account cannot access the requested workspace.');
        return;
      }
      workspaceId = user.workspace_id;
    } else {
      // Customer accounts have no home workspace; their selected workspace is request context only.
      workspaceId = requestedWorkspaceId || 'ws_apex';
    }

    const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId) as Workspace | undefined;
    if (!workspace) {
      sendProblem(req, res, 400, 'INVALID_WORKSPACE', 'The selected workspace does not exist.');
      return;
    }

    req.workspace = workspace;
    next();
  });
}

export function requireUserType(...allowedTypes: UserType[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedTypes.includes(req.user.user_type)) {
      sendProblem(req, res, 403, 'FORBIDDEN', 'Your account is not permitted to perform this action.');
      return;
    }
    next();
  };
}
