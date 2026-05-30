import { supabase } from './client';
import {
  getPendingSyncItems,
  markSynced,
  incrementRetryCount,
  getPendingCount,
} from '../db/repositories/sync-queue';
import { useSyncStore } from '../store/sync.store';
import { SyncQueueItem } from '../types';

const TABLE_MAP: Record<string, string> = {
  residences: 'residences',
  apartments: 'apartments',
  contributions: 'contributions',
  expenses: 'expenses',
  users: 'users',
};

async function syncItem(item: SyncQueueItem): Promise<void> {
  const table = TABLE_MAP[item.entity_type];
  if (!table) throw new Error(`Unknown entity type: ${item.entity_type}`);

  const payload = JSON.parse(item.payload);

  if (item.action === 'DELETE') {
    const { error } = await supabase.from(table).delete().eq('id', item.entity_id);
    if (error) throw error;
  } else {
    // INSERT or UPDATE → upsert
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }
}

export async function runSync(): Promise<void> {
  const syncStore = useSyncStore.getState();

  try {
    syncStore.setStatus('syncing');

    const items = await getPendingSyncItems();
    if (items.length === 0) {
      syncStore.setSyncSuccess();
      return;
    }

    let hasError = false;

    for (const item of items) {
      try {
        await syncItem(item);
        await markSynced(item.id);
      } catch (e) {
        console.warn(`[Sync] Failed to sync ${item.entity_type}/${item.entity_id}:`, e);
        await incrementRetryCount(item.id);
        hasError = true;
      }
    }

    const remaining = await getPendingCount();
    syncStore.setPendingCount(remaining);

    if (hasError && remaining > 0) {
      syncStore.setSyncError('Certains éléments n\'ont pas pu être synchronisés');
    } else {
      syncStore.setSyncSuccess();
    }
  } catch (e: any) {
    console.error('[Sync] Sync failed:', e);
    syncStore.setSyncError(e?.message ?? 'Erreur de synchronisation');
  }
}

export async function checkPendingCount(): Promise<void> {
  const count = await getPendingCount();
  useSyncStore.getState().setPendingCount(count);
}
