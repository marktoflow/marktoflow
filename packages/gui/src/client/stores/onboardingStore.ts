import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingState {
  completed: boolean;
  currentStep: number;
  totalSteps: number;
  skipped: boolean;
  tourActive: boolean;

  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetTour: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      completed: false,
      currentStep: 0,
      totalSteps: 6,
      skipped: false,
      tourActive: false,

      startTour: () => set({ tourActive: true, currentStep: 0, skipped: false }),

      nextStep: () => {
        const { currentStep, totalSteps } = get();
        if (currentStep < totalSteps - 1) {
          set({ currentStep: currentStep + 1 });
        } else {
          get().completeTour();
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },

      skipTour: () => set({ tourActive: false, skipped: true, completed: true }),

      completeTour: () => set({ tourActive: false, completed: true }),

      resetTour: () => set({ completed: false, currentStep: 0, skipped: false, tourActive: false }),
    }),
    { name: 'marktoflow-onboarding' }
  )
);
