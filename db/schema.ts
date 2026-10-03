/** Normalized SQLite schema for the Client Request Desk. */
export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('WORKPLACE', 'CUSTOMER')),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  workspace_id TEXT,
  phone TEXT,
  CHECK (
    (user_type = 'WORKPLACE' AND workspace_id IS NOT NULL) OR
    (user_type = 'CUSTOMER' AND workspace_id IS NULL)
  ),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY CHECK (id BETWEEN 10000 AND 99999),
  workspace_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  description TEXT NOT NULL,
  service_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'QUALIFIED', 'CLOSED')),
  preferred_date TEXT,
  work_item_id INTEGER UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (work_item_id) REFERENCES work_items(work_item_id)
);

CREATE TABLE IF NOT EXISTS work_items (
  work_item_id INTEGER PRIMARY KEY CHECK (work_item_id BETWEEN 100000 AND 999999),
  request_id INTEGER NOT NULL UNIQUE,
  scheduled_date TEXT NOT NULL,
  assigned_technician TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  request_id INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_workspace ON users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_requests_workspace ON requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_requests_workspace_status ON requests(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_customer ON requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_items_request ON work_items(request_id);
CREATE INDEX IF NOT EXISTS idx_activity_workspace_request ON activity_log(workspace_id, request_id);
`;
