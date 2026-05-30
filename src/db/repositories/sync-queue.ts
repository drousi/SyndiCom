import { getDatabase } from '../schema';
import { SyncQueueItem, SyncAction, EntityType } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export async function addToSyncQueue(
  entityType: EntityType,
  entityId: string,
  action: SyncAction,
  payload: object,
  _userId?: string
): Promise<void> {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sync_queue (id, entity_type, entity_id, action, payload, synced, retry_count, created_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
    [id, entityType, entityId, action, JSON.stringify(payload), now]
  );
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM sync_queue WHERE synced = 0 AND retry_count < 3 ORDER BY created_at ASC LIMIT 50'
  );
  return rows.map(r => ({ ...r, synced: r.synced === 1 }));
}

export async function markSynced(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('UPDATE sync_queue SET synced = 1 WHERE id = ?', [id]);
}

export async function incrementRetryCount(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?', [id]);
}

export async function getPendingCount(): Promise<number> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0 AND retry_count < 3'
  );
  return row?.count ?? 0;
}

export async function clearSyncedItems(): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE synced = 1');
}
