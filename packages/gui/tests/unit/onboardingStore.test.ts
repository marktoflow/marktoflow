import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOnboardingStore } from '../../src/client/stores/onboardingStore';

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

describe('onboardingStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useOnboardingStore.setState({
      completed: false,
      currentStep: 0,
      totalSteps: 6,
      skipped: false,
      tourActive: false,
    });
  });

  describe('initial state', () => {
    it('should have correct defaults', () => {
      const state = useOnboardingStore.getState();
      expect(state.completed).toBe(false);
      expect(state.currentStep).toBe(0);
      expect(state.totalSteps).toBe(6);
      expect(state.skipped).toBe(false);
      expect(state.tourActive).toBe(false);
    });
  });

  describe('startTour', () => {
    it('should activate the tour and reset step', () => {
      useOnboardingStore.setState({ currentStep: 3, skipped: true, tourActive: false });

      useOnboardingStore.getState().startTour();

      const state = useOnboardingStore.getState();
      expect(state.tourActive).toBe(true);
      expect(state.currentStep).toBe(0);
      expect(state.skipped).toBe(false);
    });
  });

  describe('nextStep', () => {
    it('should increment currentStep', () => {
      useOnboardingStore.setState({ tourActive: true, currentStep: 0 });

      useOnboardingStore.getState().nextStep();

      expect(useOnboardingStore.getState().currentStep).toBe(1);
    });

    it('should increment through multiple steps', () => {
      useOnboardingStore.setState({ tourActive: true, currentStep: 0 });

      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().nextStep();

      expect(useOnboardingStore.getState().currentStep).toBe(3);
    });

    it('should call completeTour on last step', () => {
      useOnboardingStore.setState({ tourActive: true, currentStep: 5 });

      useOnboardingStore.getState().nextStep();

      const state = useOnboardingStore.getState();
      expect(state.tourActive).toBe(false);
      expect(state.completed).toBe(true);
    });
  });

  describe('prevStep', () => {
    it('should decrement currentStep', () => {
      useOnboardingStore.setState({ tourActive: true, currentStep: 3 });

      useOnboardingStore.getState().prevStep();

      expect(useOnboardingStore.getState().currentStep).toBe(2);
    });

    it('should not go below 0', () => {
      useOnboardingStore.setState({ tourActive: true, currentStep: 0 });

      useOnboardingStore.getState().prevStep();

      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });
  });

  describe('skipTour', () => {
    it('should deactivate tour, set skipped and completed', () => {
      useOnboardingStore.setState({ tourActive: true, currentStep: 2 });

      useOnboardingStore.getState().skipTour();

      const state = useOnboardingStore.getState();
      expect(state.tourActive).toBe(false);
      expect(state.skipped).toBe(true);
      expect(state.completed).toBe(true);
    });
  });

  describe('completeTour', () => {
    it('should deactivate tour and set completed', () => {
      useOnboardingStore.setState({ tourActive: true, currentStep: 5 });

      useOnboardingStore.getState().completeTour();

      const state = useOnboardingStore.getState();
      expect(state.tourActive).toBe(false);
      expect(state.completed).toBe(true);
    });
  });

  describe('resetTour', () => {
    it('should reset all state to defaults', () => {
      useOnboardingStore.setState({
        completed: true,
        currentStep: 4,
        skipped: true,
        tourActive: true,
      });

      useOnboardingStore.getState().resetTour();

      const state = useOnboardingStore.getState();
      expect(state.completed).toBe(false);
      expect(state.currentStep).toBe(0);
      expect(state.skipped).toBe(false);
      expect(state.tourActive).toBe(false);
    });
  });
});
