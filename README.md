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

## Architecture

The application follows a **single-process, full-stack architecture** consisting of a React frontend, Express.js backend, and SQLite database. The system is designed around **workspace isolation, role-based access, validated business workflows, and audit logging**.

### Frontend

The frontend is a single-page React application with role-based navigation and centralized state management.

- `App.tsx` manages authentication state, workspace context, requests, filters, selections, and modals.
- JWT sessions are restored on application startup.
- **Customer mode:** Create requests and track their status.
- **Workplace mode:** Review requests, update statuses, convert qualified requests into work items, and view activity history.
- `api.ts` provides a centralized API client for communication with the backend.

### Backend

The Express backend is organized by business responsibility:

| Module         | Responsibility                                                |
| -------------- | ------------------------------------------------------------- |
| `server.ts`    | Express bootstrap, middleware, API mounting, frontend serving |
| `auth.ts`      | JWT authentication, workspace isolation, role authorization   |
| `requests.ts`  | Request creation, listing, validation, and status transitions |
| `workItems.ts` | Request-to-work-item conversion and transactional updates     |
| `activity.ts`  | Activity timeline and audit logging                           |
| `assistant.ts` | Deterministic rule-based recommendations                      |

Each protected operation follows the pattern:

**Authentication → Authorization → Validation → Business Logic → Database Mutation**

### Data & Persistence

The database schema is defined in `schema.ts` and follows a normalized, workspace-scoped data model:

- `workspaces` — tenant/workspace information
- `users` — workplace and customer accounts
- `requests` — customer requests associated with a workspace
- `work_items` — qualified requests converted into actionable work
- `activity_log` — audit history and workflow events

`database.ts` manages SQLite connections, schema migrations, and initial demo-data seeding.

### Security & Business Rules

The application enforces security and workflow constraints at the API layer:

- JWT authentication for protected endpoints
- Workspace-level tenant isolation
- Role-based authorization (`WORKPLACE` / `CUSTOMER`)
- Validated request bodies before database mutations
- Controlled request status transitions
- Work-item conversion restricted to `QUALIFIED` requests
- Transactional updates for critical workflow operations
- Persistent activity logging for auditability

### Architectural Rationale

A single-process architecture was chosen to keep deployment and maintenance simple while providing clear separation between presentation, API, business logic, and persistence.

**Advantages**

- Simple deployment and local development
- Minimal infrastructure requirements
- Easy-to-follow business workflows
- SQLite provides lightweight persistent storage
- Strong validation and workspace isolation

**Trade-off:** The architecture is optimized for an internal tool or small-team deployment rather than horizontally scaled, high-volume SaaS workloads.

### Core Design Principle

> **Workspace-scoped business workflows with strict validation, role separation, controlled state transitions, and auditability.**

## Assumptions and trade-offs

The architecture is optimized for an internal tool or small-team deployment rather than horizontally scaled, high-volume SaaS workloads. SQLite and synchronous queries are appropriate for a small single-instance deployment, not multi-replica workloads. 

## Improvements with more time

- Add login rate limiting.
- Add pagination, request-size limits, and broader backend integration tests.
- Move to PostgreSQL with migrations and tenant row-level policies for multi-instance deployment.
- Add operational monitoring, backups, and deployment-specific secret management.
- Add caching with Redis for frequently accessed data and rate-limiting support.
- Add automated database backups, recovery procedures, and deployment-specific secret management.
- Add API documentation with OpenAPI/Swagger and standardized API response formats.
- Add email/in-app notifications for request creation, status changes, and work-item completion.
- Add real-time request and status updates using WebSockets or Server-Sent Events.

## AI tools and review

Google AI Studio Build and GitHub Copilot were used for development assistance, including scaffolding, code suggestions, and test drafting. Suggestions were reviewed against the source and API contracts, then checked with TypeScript diagnostics, the test suite, production build, and live API probes. The runtime assistant is deterministic and makes no external model calls.
