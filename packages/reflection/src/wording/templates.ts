import { Candidate } from '../types';

export interface WordingResult {
  title: string;
  rationale: string;
  steps: string[];
  durationMin: number;
}

export function generateTemplateWording(candidate: Candidate): WordingResult {
  const n = candidate.durationMin;
  const f = candidate.facts || {};
  const titleText = (f.title || '').trim() || 'your note';

  switch (candidate.kind) {
    case 'seed_to_plan': {
      return {
        title: `Brainstorm a plan for ${titleText} (${n} min)`,
        rationale: `Your idea '${titleText}' has no plan yet.`,
        steps: [
          'State the goal in one sentence',
          'List 5 unknowns or questions',
          'Pick the smallest first step',
        ],
        durationMin: n,
      };
    }

    case 'explore_to_plan': {
      return {
        title: `Turn ${titleText} into 3 next actions (${n} min)`,
        rationale: `You have notes on '${titleText}', but no actionable next steps yet.`,
        steps: [
          'Re-read your notes',
          'Write 3 actions starting with a verb',
          'Tag one as the first',
        ],
        durationMin: n,
      };
    }

    case 'plan_to_start': {
      return {
        title: `Start ${titleText} with one action (${n} min)`,
        rationale: `Your plan for '${titleText}' is waiting for its first step.`,
        steps: ['Open the plan', `Do the first action for ${n} minutes`],
        durationMin: n,
      };
    }

    case 'unblock': {
      const days = f.daysStale || 14;
      return {
        title: `Decide what's next for ${titleText} (${n} min)`,
        rationale: `'${titleText}' has been quiet for ${days} days.`,
        steps: ['Is it still wanted?', 'Pick: next step, park, or archive'],
        durationMin: n,
      };
    }

    case 'close_loop': {
      const count = f.count || f.loops?.length || 1;
      return {
        title: `Clear ${count} overdue ${count === 1 ? 'item' : 'items'} (${n} min)`,
        rationale: `You have ${count} open ${count === 1 ? 'loop' : 'loops'} waiting for a decision.`,
        steps: ['For each: do it, reschedule it, or drop it'],
        durationMin: n,
      };
    }

    case 'connect': {
      const aTitle = f.a?.title || 'Note A';
      const bTitle = f.b?.title || 'Note B';
      return {
        title: `Link '${aTitle}' and '${bTitle}' (${n} min)`,
        rationale: 'These two notes appear related but are not yet linked.',
        steps: ['Read both notes', 'Add a reference between them', 'Write one sentence on how they relate'],
        durationMin: n,
      };
    }

    case 'revisit': {
      return {
        title: `Recall what you wrote about ${titleText} (${n} min)`,
        rationale: `You haven't opened '${titleText}' in over 3 weeks.`,
        steps: ['Write 3 lines from memory', 'Compare with the original note'],
        durationMin: n,
      };
    }

    case 'pattern': {
      const topic = f.topic || 'this theme';
      return {
        title: `What is behind '${topic}'? (${n} min)`,
        rationale: `You've captured several notes around '${topic}' recently.`,
        steps: ['List the related notes', 'Write the underlying question or theme'],
        durationMin: n,
      };
    }

    case 'balance': {
      const cat = candidate.category || 'health';
      return {
        title: f.title ? `${f.title} (${n} min)` : `Focus on ${cat} (${n} min)`,
        rationale: `A small action to invest in ${cat}.`,
        steps: f.steps && f.steps.length > 0 ? f.steps : ['Take a quiet moment', 'Do one small deliberate act'],
        durationMin: n,
      };
    }

    case 'journal': {
      return {
        title: 'Three lines before you wrap up (5 min)',
        rationale: 'A quick evening checkpoint to close your loops.',
        steps: ['What went well today?', 'What was hard or incomplete?', 'One thing for tomorrow'],
        durationMin: 5,
      };
    }

    case 'evergreen':
    default: {
      return {
        title: f.title ? `${f.title} (${n} min)` : `Daily mindful practice (${n} min)`,
        rationale: 'A daily practice for your well-being.',
        steps: f.steps && f.steps.length > 0 ? f.steps : ['Take a break', 'Follow through with presence'],
        durationMin: n,
      };
    }
  }
}
