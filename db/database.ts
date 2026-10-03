import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CREATE_TABLES_SQL } from './schema.ts';
import { seed } from './seed.ts';
import { hashPassword, isPasswordHash } from '../server/utils/password.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.DATABASE_FILE || path.join(DATA_DIR, 'client_desk.db');

let instance: DatabaseSync | null = null;

interface LegacyWorkspaceRow {
  id: string;
  name: string;
  industry: string;
  created_at: string;
}

interface LegacyUserRow {
  id: string;
  name: string;
  user_type?: string;
  email: string;
  password?: string | null;
  workspace_id?: string | null;
  phone?: string | null;
}

interface LegacyRequestRow {
  id: number;
  workspace_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  description: string;
  service_title: string;
  status: string;
  preferred_date?: string | null;
  created_at: string;
}

interface LegacyWorkItemRow {
  id?: number | string | null;
  work_item_id?: number | string | null;
  request_id: number | string;
  scheduled_date: string;
  assigned_technician?: string | null;
  description?: string | null;
  notes?: string | null;
  status?: string | null;
  created_by_user_id?: string | null;
  created_at: string;
}

interface LegacyActivityRow {
  id: string;
  workspace_id: string;
  request_id: number | string;
  actor_id?: string | null;
  actor_name?: string | null;
  action: string;
  details: string;
  created_at: string;
}

interface MigratedUser {
  id: string;
  name: string;
  user_type: 'WORKPLACE' | 'CUSTOMER';
  email: string;
  password: string;
  workspace_id: string | null;
  phone: string | null;
}

function hasTable(db: DatabaseSync, name: string) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

function hasColumn(db: DatabaseSync, table: string, column: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((item) => item.name === column);
}

function isNormalizedSchema(db: DatabaseSync) {
  return hasTable(db, 'requests') && hasColumn(db, 'requests', 'customer_id') &&
    hasColumn(db, 'requests', 'work_item_id') && hasColumn(db, 'work_items', 'work_item_id') &&
    !hasColumn(db, 'workspaces', 'slug');
}

/** Migrates the previous denormalized schema without losing requests, work items, or audit history. */
function migrateToNormalizedSchema(db: DatabaseSync) {
  if (isNormalizedSchema(db)) return;

  const workspaces = hasTable(db, 'workspaces') ? db.prepare('SELECT * FROM workspaces').all() as LegacyWorkspaceRow[] : [];
  const users = hasTable(db, 'users') ? db.prepare('SELECT * FROM users').all() as LegacyUserRow[] : [];
  const requests = hasTable(db, 'requests') ? db.prepare('SELECT * FROM requests').all() as LegacyRequestRow[] : [];
  const workItems = hasTable(db, 'work_items') ? db.prepare('SELECT * FROM work_items').all() as LegacyWorkItemRow[] : [];
  const activities = hasTable(db, 'activity_log') ? db.prepare('SELECT * FROM activity_log').all() as LegacyActivityRow[] : [];

  if (workspaces.length === 0) return;

  const normalizedUsers = new Map<string, MigratedUser>();
  const userByEmail = new Map<string, MigratedUser>();
  const userByName = new Map<string, MigratedUser>();
  const userIdMap = new Map<string, string>();
  const addUser = (user: MigratedUser) => {
    normalizedUsers.set(user.id, user);
    userByEmail.set(user.email.toLowerCase(), user);
    userByName.set(user.name.toLowerCase(), user);
    return user;
  };

  for (const user of users) {
    const userType = user.user_type === 'CUSTOMER' ? 'CUSTOMER' : 'WORKPLACE';
    const normalized = addUser({
      id: user.id,
      name: user.name,
      user_type: userType,
      email: String(user.email).toLowerCase(),
      password: isPasswordHash(user.password || '') ? user.password! : hashPassword(user.password || 'password123'),
      workspace_id: userType === 'WORKPLACE' ? user.workspace_id : null,
      phone: user.phone || null
    });
    userIdMap.set(user.id, normalized.id);
  }

  let generatedUserNumber = 1;
  const ensureCustomer = (name: string, email?: string, phone?: string) => {
    const normalizedEmail = email?.trim().toLowerCase();
    const existing = normalizedEmail ? userByEmail.get(normalizedEmail) : userByName.get(name.toLowerCase());
    if (existing?.user_type === 'CUSTOMER') return existing;

    let id = `user_migrated_customer_${generatedUserNumber++}`;
    while (normalizedUsers.has(id)) id = `user_migrated_customer_${generatedUserNumber++}`;
    const fallbackEmail = normalizedEmail || `${id}@migrated.local`;
    return addUser({
      id,
      name: name || 'Migrated customer',
      user_type: 'CUSTOMER',
      email: fallbackEmail,
      password: hashPassword('password123'),
      workspace_id: null,
      phone: phone || null
    });
  };

  const requestCustomerIds = new Map<number, string>();
  for (const request of requests) {
    const customer = request.customer_id && normalizedUsers.get(request.customer_id)?.user_type === 'CUSTOMER'
      ? normalizedUsers.get(request.customer_id)
      : ensureCustomer(request.customer_name || 'Migrated customer', request.customer_email, request.customer_phone);
    requestCustomerIds.set(Number(request.id), customer!.id);
  }

  const firstWorkspace = workspaces[0].id;
  let fallbackWorkplaceUser = [...normalizedUsers.values()].find((user) => user.user_type === 'WORKPLACE');
  if (!fallbackWorkplaceUser) {
    fallbackWorkplaceUser = addUser({
      id: 'user_migrated_dispatcher', name: 'Migrated Dispatcher', user_type: 'WORKPLACE',
      email: 'dispatcher@migrated.local', password: hashPassword('password123'), workspace_id: firstWorkspace, phone: null
    });
  }

  const workItemIdMap = new Map<string, number>();
  const usedWorkItemIds = new Set<number>();
  for (const item of workItems) {
    const candidate = Number(item.work_item_id);
    if (Number.isInteger(candidate) && candidate >= 100000 && candidate <= 999999 && !usedWorkItemIds.has(candidate)) {
      workItemIdMap.set(String(item.work_item_id), candidate);
      if (item.id) workItemIdMap.set(String(item.id), candidate);
      usedWorkItemIds.add(candidate);
    }
  }
  let nextWorkItemId = 100000;
  for (const item of workItems) {
    const legacyKey = String(item.work_item_id ?? item.id);
    if (workItemIdMap.has(legacyKey)) continue;
    while (usedWorkItemIds.has(nextWorkItemId)) nextWorkItemId++;
    workItemIdMap.set(legacyKey, nextWorkItemId);
    if (item.id) workItemIdMap.set(String(item.id), nextWorkItemId);
    usedWorkItemIds.add(nextWorkItemId++);
  }

  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN TRANSACTION;');
    db.exec(`
      CREATE TABLE workspaces_new (id TEXT PRIMARY KEY, name TEXT NOT NULL, industry TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, user_type TEXT NOT NULL CHECK (user_type IN ('WORKPLACE', 'CUSTOMER')),
        email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, workspace_id TEXT, phone TEXT,
        CHECK ((user_type = 'WORKPLACE' AND workspace_id IS NOT NULL) OR (user_type = 'CUSTOMER' AND workspace_id IS NULL)),
        FOREIGN KEY (workspace_id) REFERENCES workspaces_new(id) ON DELETE CASCADE
      );
      CREATE TABLE requests_new (
        id INTEGER PRIMARY KEY CHECK (id BETWEEN 10000 AND 99999), workspace_id TEXT NOT NULL, customer_id TEXT NOT NULL,
        description TEXT NOT NULL, service_title TEXT NOT NULL, status TEXT NOT NULL, preferred_date TEXT,
        work_item_id INTEGER UNIQUE, created_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces_new(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES users_new(id),
        FOREIGN KEY (work_item_id) REFERENCES work_items_new(work_item_id)
      );
      CREATE TABLE work_items_new (
        work_item_id INTEGER PRIMARY KEY CHECK (work_item_id BETWEEN 100000 AND 999999), request_id INTEGER NOT NULL UNIQUE,
        scheduled_date TEXT NOT NULL, assigned_technician TEXT, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'SCHEDULED',
        created_by_user_id TEXT NOT NULL, created_at TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES requests_new(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by_user_id) REFERENCES users_new(id)
      );
      CREATE TABLE activity_log_new (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, request_id INTEGER NOT NULL, actor_id TEXT NOT NULL,
        action TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces_new(id) ON DELETE CASCADE,
        FOREIGN KEY (request_id) REFERENCES requests_new(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES users_new(id)
      );
    `);

    const insertWorkspace = db.prepare('INSERT INTO workspaces_new (id, name, industry, created_at) VALUES (?, ?, ?, ?)');
    for (const workspace of workspaces) insertWorkspace.run(workspace.id, workspace.name, workspace.industry, workspace.created_at);
    const insertUser = db.prepare('INSERT INTO users_new (id, name, user_type, email, password, workspace_id, phone) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const user of normalizedUsers.values()) insertUser.run(user.id, user.name, user.user_type, user.email, user.password, user.workspace_id, user.phone);

    const insertRequest = db.prepare(`
      INSERT INTO requests_new (id, workspace_id, customer_id, description, service_title, status, preferred_date, work_item_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const request of requests) {
      const customerId = requestCustomerIds.get(Number(request.id));
      if (!customerId) throw new Error(`Cannot migrate request ${request.id}: customer is missing.`);
      insertRequest.run(Number(request.id), request.workspace_id, customerId, request.description, request.service_title, request.status, request.preferred_date, null, request.created_at);
    }

    const insertWorkItem = db.prepare(`
      INSERT INTO work_items_new (work_item_id, request_id, scheduled_date, assigned_technician, description, status, created_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of workItems) {
      const workItemId = workItemIdMap.get(String(item.work_item_id ?? item.id));
      if (workItemId === undefined) throw new Error(`Cannot migrate work item ${item.id}: ID is missing.`);
      const creator = typeof item.created_by_user_id === 'string' ? normalizedUsers.get(item.created_by_user_id) : undefined;
      const creatorId = creator?.user_type === 'WORKPLACE' ? creator.id : fallbackWorkplaceUser.id;
      insertWorkItem.run(workItemId, Number(item.request_id), item.scheduled_date, item.assigned_technician, item.description || item.notes || '', item.status || 'SCHEDULED', creatorId, item.created_at);
      db.prepare('UPDATE requests_new SET work_item_id = ? WHERE id = ?').run(workItemId, Number(item.request_id));
    }

    const insertActivity = db.prepare('INSERT INTO activity_log_new (id, workspace_id, request_id, actor_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const activity of activities) {
      let actorId = typeof activity.actor_id === 'string' ? userIdMap.get(activity.actor_id) : undefined;
      if (!actorId) {
        const requestCustomerId = requestCustomerIds.get(Number(activity.request_id));
        actorId = userByName.get(String(activity.actor_name || '').toLowerCase())?.id || requestCustomerId || fallbackWorkplaceUser.id;
      }
      insertActivity.run(activity.id, activity.workspace_id, Number(activity.request_id), actorId || fallbackWorkplaceUser.id, activity.action, activity.details, activity.created_at);
    }

    db.exec(`
      DROP TABLE IF EXISTS activity_log;
      DROP TABLE IF EXISTS work_items;
      DROP TABLE IF EXISTS requests;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS workspaces;
      ALTER TABLE workspaces_new RENAME TO workspaces;
      ALTER TABLE users_new RENAME TO users;
      ALTER TABLE requests_new RENAME TO requests;
      ALTER TABLE work_items_new RENAME TO work_items;
      ALTER TABLE activity_log_new RENAME TO activity_log;
    `);
    db.exec('COMMIT;');
  } catch (error) {
    try { db.exec('ROLLBACK;'); } catch {}
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
  db.exec(CREATE_TABLES_SQL);
  console.log(`[Database] Migrated ${requests.length} requests to the normalized schema.`);
}

export function getDatabase(): DatabaseSync {
  if (!instance) {
    instance = new DatabaseSync(DB_PATH);
    instance.exec('PRAGMA foreign_keys = ON;');
    instance.exec('PRAGMA journal_mode = WAL;');
    if (hasTable(instance, 'workspaces')) migrateToNormalizedSchema(instance);
    instance.exec(CREATE_TABLES_SQL);
    const count = instance.prepare('SELECT COUNT(*) AS count FROM workspaces').get() as { count: number };
    if (!count || count.count === 0) seed(instance);
  }
  return instance;
}

