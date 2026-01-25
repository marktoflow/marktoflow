import { create } from 'zustand';

export interface NavigationItem {
  id: string;
  name: string;
  path: string;
}

interface NavigationState {
  // Breadcrumb trail for sub-workflow navigation
  breadcrumbs: NavigationItem[];

  // Actions
  pushWorkflow: (item: NavigationItem) => void;
  popToIndex: (index: number) => void;
  popWorkflow: () => void;
  resetNavigation: () => void;
  setRootWorkflow: (item: NavigationItem) => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  breadcrumbs: [],

  pushWorkflow: (item) => {
    set({ breadcrumbs: [...get().breadcrumbs, item] });
  },

  popToIndex: (index) => {
    const { breadcrumbs } = get();
    if (index >= 0 && index < breadcrumbs.length) {
      set({ breadcrumbs: breadcrumbs.slice(0, index + 1) });
    }
  },

  popWorkflow: () => {
    const { breadcrumbs } = get();
    if (breadcrumbs.length > 1) {
      set({ breadcrumbs: breadcrumbs.slice(0, -1) });
    }
  },

  resetNavigation: () => {
    set({ breadcrumbs: [] });
  },

  setRootWorkflow: (item) => {
    set({ breadcrumbs: [item] });
  },
}));
