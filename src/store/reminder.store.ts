import { create } from 'zustand';
import { supabase } from '../supabase/client';
import { scheduleConfiguredReminder } from '../services/notification.service';
import type { Residence } from '../types';

export interface ReminderState {
  enabled: boolean;
  dayOfWeek: number; // 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
  hour: number;
  minute: number;
  isSaving: boolean;

  /** Charge les settings depuis l'objet résidence (appelé après loadSession) */
  loadFromResidence: (residence: Residence | null) => void;

  /** Sauvegarde les settings dans Supabase et re-planifie la notification */
  updateSettings: (
    settings: Partial<Pick<ReminderState, 'enabled' | 'dayOfWeek' | 'hour' | 'minute'>>,
    residenceId: string,
  ) => Promise<void>;
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

    const enabled  = residence.reminder_enabled  ?? true;
    const dayOfWeek = residence.reminder_day     ?? 2;
    const hour     = residence.reminder_hour     ?? 10;
    const minute   = residence.reminder_minute   ?? 0;

    set({ enabled, dayOfWeek, hour, minute });

    // Re-planifie la notification locale avec les nouveaux settings
    scheduleConfiguredReminder({ enabled, dayOfWeek, hour, minute }).catch(
      (err) => console.error('[Reminder] Error scheduling from residence:', err),
    );
  },

  updateSettings: async (newSettings, residenceId) => {
    const current = get();
    const updated = {
      enabled:   newSettings.enabled   ?? current.enabled,
      dayOfWeek: newSettings.dayOfWeek ?? current.dayOfWeek,
      hour:      newSettings.hour      ?? current.hour,
      minute:    newSettings.minute    ?? current.minute,
    };

    // 1. Mise à jour immédiate du store (réactivité UI)
    set({ ...updated, isSaving: true });

    // 2. Re-planifie la notification locale
    scheduleConfiguredReminder(updated).catch(
      (err) => console.error('[Reminder] Error rescheduling:', err),
    );

    // 3. Persiste dans Supabase
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
    } catch (err) {
      console.error('[Reminder] Supabase save error:', err);
    } finally {
      set({ isSaving: false });
    }
  },
}));
