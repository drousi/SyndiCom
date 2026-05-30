import { create } from 'zustand';
import { Residence } from '../types';
import { getAllResidences, getResidenceById } from '../db/repositories/residences';

interface ResidenceState {
  residences: Residence[];
  activeResidence: Residence | null;
  isLoading: boolean;

  loadResidences: () => Promise<void>;
  setActiveResidence: (residence: Residence) => void;
  refreshResidence: (id: string) => Promise<void>;
}

export const useResidenceStore = create<ResidenceState>((set, get) => ({
  residences: [],
  activeResidence: null,
  isLoading: false,

  loadResidences: async () => {
    set({ isLoading: true });
    try {
      const residences = await getAllResidences();
      const { activeResidence } = get();
      set({
        residences,
        // Keep active or default to first
        activeResidence: activeResidence
          ? residences.find(r => r.id === activeResidence.id) ?? residences[0] ?? null
          : residences[0] ?? null,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveResidence: (residence) => set({ activeResidence: residence }),

  refreshResidence: async (id) => {
    const updated = await getResidenceById(id);
    if (!updated) return;
    set(state => ({
      residences: state.residences.map(r => r.id === id ? updated : r),
      activeResidence: state.activeResidence?.id === id ? updated : state.activeResidence,
    }));
  },
}));
