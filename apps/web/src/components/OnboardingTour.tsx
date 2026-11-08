import React, { useState } from 'react';
import { Type, Link2, Tag, Search, X, ArrowRight } from 'lucide-react';

export interface OnboardingTourProps {
  onFinish: () => void;
}

const STEPS = [
  {
    icon: Type,
    title: 'Capture everything as nodes',
    body: 'Hecate is an outliner: every thought is a node. Press Enter for a new node, Tab to indent, Shift+Tab to outdent. The capture bar at the bottom adds notes to the current page.',
  },
  {
    icon: Link2,
    title: 'Link notes with references',
    body: 'Type [[ anywhere to reference another node. References stay in sync forever — edit the original and every mention updates. Cmd+Click a reference to open it in a side panel.',
  },
  {
    icon: Tag,
    title: 'Add structure with supertags',
    body: 'Type # to apply a supertag like #task or #book. Supertags inject typed fields (Status, Due, Author…) and templates. Configure them in the Library (G then L).',
  },
  {
    icon: Search,
    title: 'Find and query everything',
    body: 'Cmd+K searches all nodes with full-text search. Create a Live Search from the palette or Library for a saved query that updates as you work. Browse daily notes in the Calendar (G then C).',
  },
];

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onFinish }) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] shadow-2xl text-[var(--text-primary)] font-sans p-6 relative animate-in fade-in duration-140">
        <button
          type="button"
          onClick={onFinish}
          aria-label="Skip tour"
          className="absolute top-4 right-4 p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--accent)] mb-4">
          Welcome to Hecate — {step + 1} of {STEPS.length}
        </div>

        <div className="w-11 h-11 rounded-[10px] bg-[var(--bg-accent-soft)] border border-[var(--border-accent)] flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-[var(--accent)]" strokeWidth={2} />
        </div>

        <h3 className="text-[20px] font-semibold mb-2">{current.title}</h3>
        <p className="text-[14px] leading-relaxed text-[var(--text-muted)] mb-6">
          {current.body}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex space-x-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i === step ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => (isLast ? onFinish() : setStep(step + 1))}
            className="h-9 px-4 flex items-center space-x-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-app)] rounded-[8px] text-[13px] font-medium cursor-pointer transition-colors"
          >
            <span>{isLast ? 'Start capturing' : 'Next'}</span>
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
};
