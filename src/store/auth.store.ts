import { create } from 'zustand';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase/client';
import { Profile, SystemRole, ResidenceRole, ResidenceWithRole, PermissionAction, Residence, UserResidence } from '../types';

type UserResidenceJoinRow = UserResidence & {
  residences: Residence | null;
};

// Mutex: prevents concurrent loadSession calls
let _sessionLoadingPromise: Promise<void> | null = null;

interface AuthState {
  profile: Profile | null;
  systemRole: SystemRole;
  residences: ResidenceWithRole[];          // Toutes les résidences de l'utilisateur
  activeResidence: ResidenceWithRole | null;
  residenceRole: ResidenceRole | null;      // Rôle dans la résidence active

  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loadSession: (background?: boolean) => Promise<void>;
  setActiveResidence: (residence: ResidenceWithRole) => void;
  clearError: () => void;

  // Permissions
  hasPermission: (action: PermissionAction) => boolean;
  isSuperuser: () => boolean;
  isAdmin: () => boolean;
  isManager: () => boolean;
  isResident: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null,
  systemRole: 'user',
  residences: [],
  activeResidence: null,
  residenceRole: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  loadSession: async (background = false) => {
    if (_sessionLoadingPromise) return _sessionLoadingPromise;

    const run = async () => {
      try {
        if (!background) {
          set({ isLoading: true });
        }
        const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        set({ profile: null, isAuthenticated: false });
        return;
      }

      const uid = session.user.id;
      // 1. Fetch from Supabase (source of truth)
      const { data: remoteProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

      let profile: Profile | null = null;

      if (remoteProfile) {
        profile = remoteProfile as Profile;
      } else {
        // Create minimal profile from auth data if not exists and save it to Supabase
        profile = {
          id: uid,
          email: session.user.email ?? '',
          full_name: session.user.user_metadata?.full_name ?? null,
          phone: null,
          push_token: null,
          system_role: 'user',
          force_password_change: false,
          created_at: session.user.created_at,
          updated_at: session.user.created_at,
        };
        
        const { error: upsertError } = await supabase.from('profiles').upsert(profile);
        if (upsertError) {
          console.warn('[Auth] Profile upsert failed, user might be deleted. Signing out.');
          await supabase.auth.signOut();
          set({ profile: null, isAuthenticated: false });
          return;
        }
      }

      // 2. Load residences + roles for this user
      let residencesWithRole: ResidenceWithRole[] = [];

      if (profile.system_role === 'superuser') {
        // Superuser sees all residences
        const { data: allResidences } = await supabase
          .from('residences')
          .select('*')
          .order('name');
        residencesWithRole = (allResidences ?? []).map(r => ({ ...r, role: 'admin' as ResidenceRole }));
      } else {
        // Load from user_residences
        const { data: userResidences, error: urError } = await supabase
          .from('user_residences')
          .select('*, residences(*)')
          .eq('user_id', uid);

        residencesWithRole = (userResidences ?? [] as UserResidenceJoinRow[])
          .filter((ur): ur is UserResidenceJoinRow & { residences: Residence } => ur.residences !== null)
          .map((ur) => ({
            ...ur.residences,
            role: ur.role as ResidenceRole,
          }));
      }

      const activeResidence = residencesWithRole[0] ?? null;

      set({
        profile,
        systemRole: profile.system_role,
        residences: residencesWithRole,
        activeResidence,
        residenceRole: activeResidence?.role ?? null,
        isAuthenticated: true,
      });

      // Synchronise le store de rappels avec les settings de la résidence active
      const { loadFromResidence } = await import('./reminder.store').then(m => m.useReminderStore.getState());
      loadFromResidence(activeResidence);

    } catch (e) {
      console.error('[Auth] loadSession error:', e);
      set({ profile: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
      _sessionLoadingPromise = null;
    }
  };

    _sessionLoadingPromise = run();
    return _sessionLoadingPromise;
  },

  signIn: async (email, password) => {
    try {
      set({ isLoading: true, error: null });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('Aucune session retournée');
      await get().loadSession();
    } catch (e: any) {
      let msg = e?.message ?? 'Erreur de connexion';
      if (msg.includes('Invalid login credentials')) msg = 'Email ou mot de passe incorrect';
      if (msg.includes('Email not confirmed')) msg = 'Veuillez confirmer votre email';
      set({ error: msg });
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email, password, fullName) => {
    try {
      set({ isLoading: true, error: null });
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      if (error) throw error;
    } catch (e: any) {
      let msg = e?.message ?? 'Erreur lors de l\'inscription';
      if (msg.includes('User already registered')) msg = 'Cet email est déjà utilisé';
      set({ error: msg });
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      profile: null,
      systemRole: 'user',
      residences: [],
      activeResidence: null,
      residenceRole: null,
      isAuthenticated: false,
      error: null,
    });
  },

  resetPassword: async (email) => {
    try {
      set({ isLoading: true, error: null });
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    } catch (e: any) {
      set({ error: e?.message ?? 'Erreur lors de la réinitialisation' });
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveResidence: (residence) => {
    set({ activeResidence: residence, residenceRole: residence.role });
    import('./reminder.store').then(m => m.useReminderStore.getState().loadFromResidence(residence));
  },

  clearError: () => set({ error: null }),

  // ─── Permission helpers ──────────────────────────────────────────────────────

  isSuperuser: () => get().systemRole === 'superuser',

  isAdmin: () => {
    const { systemRole, residenceRole } = get();
    return systemRole === 'superuser' || residenceRole === 'admin';
  },

  isManager: () => {
    const { systemRole, residenceRole } = get();
    return systemRole === 'superuser' || residenceRole === 'admin' || residenceRole === 'manager';
  },

  isResident: () => get().residenceRole === 'resident',

  hasPermission: (action) => {
    const { systemRole, residenceRole } = get();
    if (systemRole === 'superuser') return true;

    switch (action) {
      case 'read':
        return !!residenceRole; // Any role can read
      case 'write':
        return residenceRole === 'admin' || residenceRole === 'manager';
      case 'delete':
        return residenceRole === 'admin';
      case 'manageUsers':
        return residenceRole === 'admin';
      case 'manageResidence':
        return residenceRole === 'admin';
      case 'declarePayment':
        return residenceRole === 'resident';
      default:
        return false;
    }
  },
}));
