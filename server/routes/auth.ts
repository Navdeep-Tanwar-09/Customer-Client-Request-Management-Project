import { Router, Request, Response } from 'express';
import { getDatabase } from '../../db/database.ts';
import { User, Workspace } from '../../src/types.ts';
import { verifyPassword } from '../utils/password.ts';
import { createAccessToken } from '../utils/jwt.ts';
import { jwtAuth } from '../middleware/auth.ts';
import { sendProblem } from '../utils/problem.ts';

const router = Router();

interface AuthUserRow extends User {
  password: string;
}

interface DemoAccountRow {
  id: string;
  workspace_id: string | null;
  name: string;
  email: string;
  user_type: User['user_type'];
  workspace_name: string | null;
}

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const db = getDatabase();
  const { email, password, role } = req.body ?? {};

  if (!email || !password) {
    sendProblem(req, res, 422, 'VALIDATION_ERROR', 'Email and password are required.', {
      email: 'Email is required.',
      password: 'Password is required.',
    });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.prepare(`
    SELECT * FROM users WHERE LOWER(email) = ?
  `).get(normalizedEmail) as AuthUserRow | undefined;

  if (!user || !verifyPassword(String(password), user.password)) {
    res.set('WWW-Authenticate', 'Bearer realm="api"');
    sendProblem(req, res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    return;
  }

  // Validate role if specified
  if (role && user.user_type !== role) {
    sendProblem(req, res, 403, 'ROLE_MISMATCH', `Account is registered as ${user.user_type === 'WORKPLACE' ? 'a Workplace User' : 'a Customer'}. Please select the ${user.user_type === 'WORKPLACE' ? 'Workplace' : 'Customer'} role.`);
    return;
  }

  let workspace: Workspace | null = null;
  if (user.workspace_id) {
    workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(user.workspace_id) as unknown as Workspace;
  }

  // Don't leak raw password
  const sanitizedUser: User = {
    id: user.id,
    workspace_id: user.workspace_id,
    name: user.name,
    email: user.email,
    user_type: user.user_type,
    phone: user.phone || undefined
  };

  res.json({
    data: {
      user: sanitizedUser,
      workspace,
      token: createAccessToken(user.id)
    },
    message: `Logged in successfully as ${sanitizedUser.name}`
  });
});

// GET /api/auth/demo-accounts (Returns quick credentials to display on the login page)
router.get('/demo-accounts', (req: Request, res: Response) => {
  const db = getDatabase();
  const users = db.prepare(`
    SELECT u.id, u.workspace_id, u.name, u.email, u.user_type,
           w.name as workspace_name
    FROM users u
    LEFT JOIN workspaces w ON u.workspace_id = w.id
    ORDER BY u.user_type DESC, u.name ASC
  `).all() as DemoAccountRow[];

  const workplaceAccounts = users
    .filter(u => u.user_type === 'WORKPLACE')
    .map(u => ({
      email: u.email,
      password: 'password123',
      name: u.name,
      user_type: 'WORKPLACE' as const,
      workspace_name: u.workspace_name
    }));

  const customerAccounts = users
    .filter(u => u.user_type === 'CUSTOMER')
    .map(u => ({
      email: u.email,
      password: 'password123',
      name: u.name,
      user_type: 'CUSTOMER' as const,
      workspace_name: u.workspace_name
    }));

  res.json({
    data: {
      workplace: workplaceAccounts,
      customer: customerAccounts
    }
  });
});

// GET /api/auth/me (Returns session info)
router.get('/me', jwtAuth, (req: Request, res: Response) => {
  const db = getDatabase();
  const user = req.user!;

  let workspace: Workspace | null = null;
  if (user.workspace_id) {
    workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(user.workspace_id) as unknown as Workspace;
  }

  const sanitizedUser: User = {
    id: user.id,
    workspace_id: user.workspace_id,
    name: user.name,
    email: user.email,
    user_type: user.user_type,
    phone: user.phone || undefined
  };

  res.json({
    data: {
      user: sanitizedUser,
      workspace
    }
  });
});

export default router;
