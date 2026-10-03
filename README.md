# Client Request Desk

A multi-workspace service desk for customer requests, dispatch work items, and audit activity. The assistant panel offers deterministic suggestions; people confirm all changes.

## Setup

### Requirements

- Node.js 22.13 or newer (uses the built-in `node:sqlite` module)
- npm

### Development

```bash
npm ci
node -e "require('node:fs').writeFileSync('.env', 'JWT_SECRET=' + require('node:crypto').randomBytes(32).toString('hex') + '\n')"
npm run dev
```

Open <http://localhost:3000>. On a new database, the server creates the schema and seeds demo workspaces and accounts automatically. The database is stored at `data/client_desk.db` by default.

The login page lists demo accounts. They use the shared demo password `password123`; keep this sample setup local and do not expose it to the public internet.

### Tests and build

```bash
npm test
npm run build
```

The API safety suite needs a running server. Start it in one terminal, then run in another:

```bash
API_BASE_URL=http://localhost:3000 npm run test:api
```

PowerShell equivalent:

```powershell
$env:API_BASE_URL = 'http://localhost:3000'
npm run test:api
```

The API suite checks read routes, authentication and tenant boundaries, error responses, and invalid writes. It uses rejected writes and verifies records remain unchanged.

### Production mode

Set a fresh `JWT_SECRET` of at least 32 characters and `NODE_ENV=production`, build the frontend, then start the server:

```bash
npm run build
NODE_ENV=production npm start
```

PowerShell:

```powershell
$env:NODE_ENV = 'production'
npm run build
npm start
```

Configure `PORT` to change the listener port and `DATABASE_FILE` to choose the SQLite file. Keep the database on persistent storage. `npm run seed` is destructive: it drops existing tables and recreates demo data.

## Architecture and decisions

- **Frontend:** React and TypeScript, built with Vite and served by the Express app in production.
- **API:** Express JSON routes with JWT authentication, role checks, workspace scoping, and parameterized SQL.
- **Storage:** Node's synchronous SQLite API keeps local setup simple and provides transactions for request, audit, and conversion writes. It assumes a single application instance and local database file.
- **Assistant:** Rule-based suggestions rather than an external AI service. Suggestions require explicit user confirmation before writes.
- **Demo accounts:** Seed data and the demo-account endpoint make evaluation easy, but are not suitable for an internet-facing deployment.

## Assumptions and trade-offs

The app prioritizes a quick, self-contained evaluation setup over distributed scale. SQLite and synchronous queries are appropriate for a small single-instance deployment, not multi-replica workloads. Demo credentials, simplified roles, and unpaginated areas are convenience choices, not production security or scalability guarantees.

## Improvements with more time

- Remove public demo credentials and add login rate limiting.
- Add pagination, request-size limits, and broader backend integration tests.
- Move to PostgreSQL with migrations and tenant row-level policies for multi-instance deployment.
- Add operational monitoring, backups, and deployment-specific secret management.

## AI tools and review

Google AI Studio Build and GitHub Copilot were used for development assistance, including scaffolding, code suggestions, and test drafting. Suggestions were reviewed against the source and API contracts, then checked with TypeScript diagnostics, the test suite, production build, and live API probes. The runtime assistant is deterministic and makes no external model calls.
