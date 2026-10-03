import { DatabaseSync } from 'node:sqlite';

export const REQUEST_ID_MIN = 10000;
export const REQUEST_ID_MAX = 99999;
export const WORK_ITEM_ID_MIN = 100000;
export const WORK_ITEM_ID_MAX = 999999;

/** Only five-digit, non-zero-leading integer IDs are valid in request routes. */
export function parseRequestId(value: string): number | null {
  if (!/^[1-9]\d{4}$/.test(value)) return null;

  const requestId = Number(value);
  return Number.isSafeInteger(requestId) && requestId >= REQUEST_ID_MIN && requestId <= REQUEST_ID_MAX
    ? requestId
    : null;
}

/** Allocates the next database-backed request ID. The schema enforces its five-digit range. */
export function getNextRequestId(db: DatabaseSync): number {
  const row = db.prepare(`
    SELECT COALESCE(MAX(id), ${REQUEST_ID_MIN - 1}) + 1 AS next_id
    FROM requests
  `).get() as { next_id: number };

  if (!Number.isSafeInteger(row.next_id) || row.next_id > REQUEST_ID_MAX) {
    throw new Error('REQUEST_ID_CAPACITY_REACHED');
  }

  return row.next_id;
}

export function getNextWorkItemId(db: DatabaseSync): number {
  const row = db.prepare(`
    SELECT COALESCE(MAX(work_item_id), ${WORK_ITEM_ID_MIN - 1}) + 1 AS next_id
    FROM work_items
  `).get() as { next_id: number };

  if (!Number.isSafeInteger(row.next_id) || row.next_id > WORK_ITEM_ID_MAX) {
    throw new Error('WORK_ITEM_ID_CAPACITY_REACHED');
  }

  return row.next_id;
}
