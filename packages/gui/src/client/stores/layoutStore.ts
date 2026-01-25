import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

interface LayoutState {
  // Panel visibility
  sidebarOpen: boolean;
  propertiesPanelOpen: boolean;

  // Mobile menu
  mobileMenuOpen: boolean;

  // Current breakpoint (computed from window width)
  breakpoint: Breakpoint;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  togglePropertiesPanel: () => void;
  setPropertiesPanelOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  setBreakpoint: (breakpoint: Breakpoint) => void;

  // Close all panels (useful for mobile)
  closeAllPanels: () => void;
}

// Breakpoint thresholds
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
} as const;

export function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      // Default state - sidebar open on desktop, closed on mobile
      sidebarOpen: true,
      propertiesPanelOpen: true,
      mobileMenuOpen: false,
      breakpoint: 'desktop',

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      togglePropertiesPanel: () =>
        set((state) => ({ propertiesPanelOpen: !state.propertiesPanelOpen })),
      setPropertiesPanelOpen: (open) => set({ propertiesPanelOpen: open }),

      toggleMobileMenu: () =>
        set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

      setBreakpoint: (breakpoint) => {
        const current = get();
        // Auto-manage panels based on breakpoint changes
        if (breakpoint === 'mobile') {
          set({
            breakpoint,
            sidebarOpen: false,
            propertiesPanelOpen: false,
          });
        } else if (breakpoint === 'tablet') {
          set({
            breakpoint,
            sidebarOpen: true,
            propertiesPanelOpen: false,
          });
        } else {
          set({
            breakpoint,
            sidebarOpen: true,
            propertiesPanelOpen: true,
          });
        }
      },

      closeAllPanels: () =>
        set({
          sidebarOpen: false,
          propertiesPanelOpen: false,
          mobileMenuOpen: false,
        }),
    }),
    {
      name: 'marktoflow-layout',
      partialize: (state) => ({
        // Don't persist breakpoint - it's computed from window
        sidebarOpen: state.sidebarOpen,
        propertiesPanelOpen: state.propertiesPanelOpen,
      }),
    }
  )
);
