import { memo } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { cn } from '../../utils/cn';

const tourSteps = [
  { title: 'Welcome to Marktoflow!', description: 'A visual workflow designer for building automation pipelines. Let us show you around.', target: 'body' },
  { title: 'Sidebar', description: 'Browse your workflows and drag tools onto the canvas to build steps.', target: '[data-tour="sidebar"]' },
  { title: 'Canvas', description: 'This is where you design your workflow. Connect nodes to define the flow of execution.', target: '[data-tour="canvas"]' },
  { title: 'Toolbar', description: 'Use the toolbar to add steps, undo/redo, auto-layout, and execute your workflow.', target: '[data-tour="toolbar"]' },
  { title: 'AI Assistant', description: 'Type natural language prompts to generate or modify workflows using AI.', target: '[data-tour="prompt"]' },
  { title: 'You\'re Ready!', description: 'Start building your first workflow or explore the template gallery for inspiration.', target: 'body' },
];

function OnboardingTourComponent() {
  const { tourActive, currentStep, totalSteps, nextStep, prevStep, skipTour, completeTour } = useOnboardingStore();

  if (!tourActive) return null;

  const step = tourSteps[currentStep];
  const isLast = currentStep === totalSteps - 1;
  const isFirst = currentStep === 0;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" />
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[61] w-full max-w-md bg-bg-panel border border-border-default rounded-xl shadow-2xl overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="text-base font-medium text-text-primary">{step.title}</h3>
            </div>
            <button onClick={skipTour} className="p-1 rounded hover:bg-bg-hover text-text-muted"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-sm text-text-secondary mb-4">{step.description}</p>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={cn('w-2 h-2 rounded-full transition-colors', i === currentStep ? 'bg-primary' : i < currentStep ? 'bg-primary/40' : 'bg-bg-surface')} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button onClick={prevStep} className="flex items-center gap-1 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary rounded hover:bg-bg-hover">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              <button onClick={isLast ? completeTour : nextStep} className="flex items-center gap-1 px-4 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary/90">
                {isLast ? 'Get Started' : 'Next'} {!isLast && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const OnboardingTour = memo(OnboardingTourComponent);
