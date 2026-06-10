import { create } from 'zustand';
import { supabase } from '../supabase/client';
import { scheduleConfiguredReminder } from '../services/notification.service';
import type { Residence } from '../types';

type ReminderSettings = Pick<ReminderState, 'enabled' | 'dayOfWeek' | 'hour' | 'minute'>;

// Debounce timer for Supabase writes — prevents a write per key press
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
// Last confirmed-saved state for rollback on Supabase failure
let _lastSavedSettings: ReminderSettings | null = null;

export interface ReminderState {
  enabled: boolean;
  dayOfWeek: number; // 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
  hour: number;
  minute: number;
  isSaving: boolean;

  /** Charge les settings depuis l'objet résidence (appelé après loadSession) */
  loadFromResidence: (residence: Residence | null) => void;

  /**
   * Met à jour les settings localement (immédiat) et persiste dans Supabase
   * après 800 ms d'inactivité (debounce). En cas d'échec Supabase, le store
   * est rollbacké à la dernière valeur sauvegardée et `onError` est appelé.
   */
  updateSettings: (
    settings: Partial<ReminderSettings>,
    residenceId: string,
    onError?: (err: unknown) => void,
  ) => void;
}

export const useReminderStore = create<ReminderState>()((set, get) => ({
  // Defaults (écrasés dès que loadFromResidence est appelé)
  enabled: true,
  dayOfWeek: 2, // Lundi
  hour: 10,
  minute: 0,
  isSaving: false,

  loadFromResidence: (residence) => {
    if (!residence) return;

    const settings: ReminderSettings = {
      enabled:   residence.reminder_enabled  ?? true,
      dayOfWeek: residence.reminder_day      ?? 2,
      hour:      residence.reminder_hour     ?? 10,
      minute:    residence.reminder_minute   ?? 0,
    };

    _lastSavedSettings = settings;
    set(settings);

    // Re-planifie la notification locale avec les nouveaux settings
    scheduleConfiguredReminder(settings).catch(
      (err) => console.error('[Reminder] Error scheduling from residence:', err),
    );
  },

  updateSettings: (newSettings, residenceId, onError) => {
    const current = get();
    const updated: ReminderSettings = {
      enabled:   newSettings.enabled   ?? current.enabled,
      dayOfWeek: newSettings.dayOfWeek ?? current.dayOfWeek,
      hour:      newSettings.hour      ?? current.hour,
      minute:    newSettings.minute    ?? current.minute,
    };

    // 1. Mise à jour immédiate du store (réactivité UI)
    set(updated);

    // 2. Debounce: re-planifie + persiste après 800 ms d'inactivité
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
      _saveTimer = null;
      set({ isSaving: true });

      // Re-planifie la notification locale
      scheduleConfiguredReminder(updated).catch(
        (err) => console.error('[Reminder] Error rescheduling:', err),
      );

      // Persiste dans Supabase
      try {
        const { error } = await supabase
          .from('residences')
          .update({
            reminder_enabled: updated.enabled,
            reminder_day:     updated.dayOfWeek,
            reminder_hour:    updated.hour,
            reminder_minute:  updated.minute,
          })
          .eq('id', residenceId);

        if (error) throw error;

        // Confirme la sauvegarde pour les rollbacks futurs
        _lastSavedSettings = updated;
      } catch (err) {
        console.error('[Reminder] Supabase save error:', err);
        // Rollback vers la dernière valeur confirmée en base
        if (_lastSavedSettings) {
          set(_lastSavedSettings);
          scheduleConfiguredReminder(_lastSavedSettings).catch(() => {});
        }
        onError?.(err);
      } finally {
        set({ isSaving: false });
      }
    }, 800);
  },
}));
