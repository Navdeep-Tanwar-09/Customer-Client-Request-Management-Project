import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { getDatabase } from './db/database.ts';
import { seed } from './db/seed.ts';
import workspacesRouter from './server/routes/workspaces.ts';
import requestsRouter from './server/routes/requests.ts';
import workItemsRouter from './server/routes/workItems.ts';
import activityRouter from './server/routes/activity.ts';
import assistantRouter from './server/routes/assistant.ts';
import authRouter from './server/routes/auth.ts';
import customerRouter from './server/routes/customer.ts';
import { assertJwtConfiguration } from './server/utils/jwt.ts';
import { sendProblem } from './server/utils/problem.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiRoutes: Array<{ pattern: RegExp; methods: string[] }> = [
  { pattern: /^\/auth\/login$/, methods: ['POST'] },
  { pattern: /^\/auth\/demo-accounts$/, methods: ['GET'] },
  { pattern: /^\/auth\/me$/, methods: ['GET'] },
  { pattern: /^\/customer\/my-requests$/, methods: ['GET', 'POST'] },
  { pattern: /^\/workspaces$/, methods: ['GET'] },
  { pattern: /^\/workspaces\/current$/, methods: ['GET'] },
  { pattern: /^\/requests$/, methods: ['GET', 'POST'] },
  { pattern: /^\/requests\/[^/]+$/, methods: ['GET', 'PATCH'] },
  { pattern: /^\/work-items\/convert\/[^/]+$/, methods: ['POST'] },
  { pattern: /^\/activity\/feed$/, methods: ['GET'] },
  { pattern: /^\/activity\/requests\/[^/]+$/, methods: ['GET', 'POST'] },
  { pattern: /^\/assistant\/requests\/[^/]+$/, methods: ['GET'] },
];

async function startServer() {
  assertJwtConfiguration();
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Initialize SQLite database & migrations
  const db = getDatabase();
  console.log('[Database] SQLite connected and schema migrations verified.');

  // Auto-seed if workspaces table is empty
  const countRow = db.prepare('SELECT COUNT(*) as count FROM workspaces').get() as { count: number } | undefined;
  if (!countRow || countRow.count === 0) {
    console.log('[Database] Workspaces table is empty. Running initial database seed...');
    seed();
  }

  // JSON Body parsing
  app.use(express.json());

  // This API accepts JSON representations for requests that carry a body.
  // Rejecting other media types avoids treating malformed input as a server error.
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const hasBody = req.headers['content-length'] !== undefined && req.headers['content-length'] !== '0';
    const methodCarriesBody = ['POST', 'PUT', 'PATCH'].includes(req.method);
    if (hasBody && methodCarriesBody && !req.is('application/json')) {
      sendProblem(req, res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Use Content-Type: application/json for request bodies.');
      return;
    }
    next();
  });

  // Mount API routers
  app.use('/api/auth', authRouter);
  app.use('/api/customer', customerRouter);
  app.use('/api/workspaces', workspacesRouter);
  app.use('/api/requests', requestsRouter);
  app.use('/api/work-items', workItemsRouter);
  app.use('/api/activity', activityRouter);
  app.use('/api/assistant', assistantRouter);

  // API paths must always return JSON, including unknown routes and methods.
  app.use('/api', (req: Request, res: Response) => {
    const route = apiRoutes.find(({ pattern }) => pattern.test(req.path));
    if (route) {
      res.set('Allow', route.methods.join(', '));
      sendProblem(req, res, 405, 'METHOD_NOT_ALLOWED', `Method ${req.method} is not allowed for ${req.path}.`);
      return;
    }
    sendProblem(req, res, 404, 'API_NOT_FOUND', `No API route exists for ${req.method} ${req.originalUrl}.`);
  });

  // Global API Error Handler
  app.use('/api', (err: unknown, req: Request, res: Response, next: NextFunction) => {
    console.error('[API Error]', err);
    if (res.headersSent) return next(err);

    const error = typeof err === 'object' && err !== null ? err as Record<string, unknown> : {};
    const isInvalidJson = error.type === 'entity.parse.failed';
    const errorStatus = typeof error.statusCode === 'number' ? error.statusCode : typeof error.status === 'number' ? error.status : 500;
    const status = isInvalidJson ? 400 : errorStatus;
    const isClientError = status >= 400 && status < 500;
    sendProblem(
      req,
      res,
      status,
      isInvalidJson ? 'INVALID_JSON' : (typeof error.code === 'string' ? error.code : 'INTERNAL_SERVER_ERROR'),
      isInvalidJson
        ? 'The request body must contain valid JSON.'
        : isClientError
          ? (typeof error.message === 'string' ? error.message : 'The request could not be completed.')
          : 'The server could not complete this request. Please try again shortly.',
    );
  });

  // Frontend Serving (Dev vs Production)
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Client Request Desk running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Fatal Error starting server]', err);
  process.exit(1);
});
