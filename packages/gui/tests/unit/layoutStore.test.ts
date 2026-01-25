import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLayoutStore, getBreakpoint, BREAKPOINTS } from '../../src/client/stores/layoutStore';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('layoutStore', () => {
  beforeEach(() => {
    // Reset store state
    useLayoutStore.setState({
      sidebarOpen: true,
      propertiesPanelOpen: true,
      mobileMenuOpen: false,
      breakpoint: 'desktop',
    });
    localStorageMock.clear();
  });

  describe('initial state', () => {
    it('should have sidebar open by default', () => {
      const state = useLayoutStore.getState();
      expect(state.sidebarOpen).toBe(true);
    });

    it('should have properties panel open by default', () => {
      const state = useLayoutStore.getState();
      expect(state.propertiesPanelOpen).toBe(true);
    });

    it('should have mobile menu closed by default', () => {
      const state = useLayoutStore.getState();
      expect(state.mobileMenuOpen).toBe(false);
    });

    it('should default to desktop breakpoint', () => {
      const state = useLayoutStore.getState();
      expect(state.breakpoint).toBe('desktop');
    });
  });

  describe('sidebar', () => {
    it('should toggle sidebar', () => {
      const { toggleSidebar } = useLayoutStore.getState();

      toggleSidebar();
      expect(useLayoutStore.getState().sidebarOpen).toBe(false);

      toggleSidebar();
      expect(useLayoutStore.getState().sidebarOpen).toBe(true);
    });

    it('should set sidebar open state', () => {
      const { setSidebarOpen } = useLayoutStore.getState();

      setSidebarOpen(false);
      expect(useLayoutStore.getState().sidebarOpen).toBe(false);

      setSidebarOpen(true);
      expect(useLayoutStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe('properties panel', () => {
    it('should toggle properties panel', () => {
      const { togglePropertiesPanel } = useLayoutStore.getState();

      togglePropertiesPanel();
      expect(useLayoutStore.getState().propertiesPanelOpen).toBe(false);

      togglePropertiesPanel();
      expect(useLayoutStore.getState().propertiesPanelOpen).toBe(true);
    });

    it('should set properties panel open state', () => {
      const { setPropertiesPanelOpen } = useLayoutStore.getState();

      setPropertiesPanelOpen(false);
      expect(useLayoutStore.getState().propertiesPanelOpen).toBe(false);

      setPropertiesPanelOpen(true);
      expect(useLayoutStore.getState().propertiesPanelOpen).toBe(true);
    });
  });

  describe('mobile menu', () => {
    it('should toggle mobile menu', () => {
      const { toggleMobileMenu } = useLayoutStore.getState();

      toggleMobileMenu();
      expect(useLayoutStore.getState().mobileMenuOpen).toBe(true);

      toggleMobileMenu();
      expect(useLayoutStore.getState().mobileMenuOpen).toBe(false);
    });

    it('should set mobile menu open state', () => {
      const { setMobileMenuOpen } = useLayoutStore.getState();

      setMobileMenuOpen(true);
      expect(useLayoutStore.getState().mobileMenuOpen).toBe(true);

      setMobileMenuOpen(false);
      expect(useLayoutStore.getState().mobileMenuOpen).toBe(false);
    });
  });

  describe('breakpoint', () => {
    it('should set breakpoint to mobile and close panels', () => {
      const { setBreakpoint } = useLayoutStore.getState();

      setBreakpoint('mobile');

      const state = useLayoutStore.getState();
      expect(state.breakpoint).toBe('mobile');
      expect(state.sidebarOpen).toBe(false);
      expect(state.propertiesPanelOpen).toBe(false);
    });

    it('should set breakpoint to tablet with sidebar open', () => {
      const { setBreakpoint } = useLayoutStore.getState();

      setBreakpoint('tablet');

      const state = useLayoutStore.getState();
      expect(state.breakpoint).toBe('tablet');
      expect(state.sidebarOpen).toBe(true);
      expect(state.propertiesPanelOpen).toBe(false);
    });

    it('should set breakpoint to desktop with all panels open', () => {
      // First set to mobile
      useLayoutStore.getState().setBreakpoint('mobile');

      // Then set to desktop
      useLayoutStore.getState().setBreakpoint('desktop');

      const state = useLayoutStore.getState();
      expect(state.breakpoint).toBe('desktop');
      expect(state.sidebarOpen).toBe(true);
      expect(state.propertiesPanelOpen).toBe(true);
    });
  });

  describe('closeAllPanels', () => {
    it('should close all panels', () => {
      const { closeAllPanels } = useLayoutStore.getState();

      closeAllPanels();

      const state = useLayoutStore.getState();
      expect(state.sidebarOpen).toBe(false);
      expect(state.propertiesPanelOpen).toBe(false);
      expect(state.mobileMenuOpen).toBe(false);
    });
  });
});

describe('getBreakpoint', () => {
  it('should return mobile for small widths', () => {
    expect(getBreakpoint(320)).toBe('mobile');
    expect(getBreakpoint(500)).toBe('mobile');
    expect(getBreakpoint(767)).toBe('mobile');
  });

  it('should return tablet for medium widths', () => {
    expect(getBreakpoint(768)).toBe('tablet');
    expect(getBreakpoint(900)).toBe('tablet');
    expect(getBreakpoint(1023)).toBe('tablet');
  });

  it('should return desktop for large widths', () => {
    expect(getBreakpoint(1024)).toBe('desktop');
    expect(getBreakpoint(1280)).toBe('desktop');
    expect(getBreakpoint(1920)).toBe('desktop');
  });
});

describe('BREAKPOINTS', () => {
  it('should have correct breakpoint values', () => {
    expect(BREAKPOINTS.mobile).toBe(0);
    expect(BREAKPOINTS.tablet).toBe(768);
    expect(BREAKPOINTS.desktop).toBe(1024);
  });
});
