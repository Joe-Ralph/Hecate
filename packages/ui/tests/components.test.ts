import { describe, it, expect } from 'vitest';
import { COLORS, RADII, LAYOUT, TYPOGRAPHY } from '../src/tokens';

describe('Hecate UI Design System Invariants (Quiet, Warm, Dark)', () => {
  it('Warm dark color tokens are defined strictly per Section 2.1', () => {
    expect(COLORS.bg).toBe('#121110');
    expect(COLORS.bgSide).toBe('#161513');
    expect(COLORS.surface).toBe('#1c1a18');
    expect(COLORS.surface2).toBe('#1a1917');
    expect(COLORS.hover).toBe('#181614');
    expect(COLORS.hoverNav).toBe('#1f1d1a');
    expect(COLORS.active).toBe('#24211e');
    expect(COLORS.active2).toBe('#2a2723');
    expect(COLORS.border).toBe('#2a2825');
    expect(COLORS.borderStrong).toBe('#34312d');

    expect(COLORS.text).toBe('#ece8e1');
    expect(COLORS.text2).toBe('#d8d2c8');
    expect(COLORS.text3).toBe('#c9c3b9');
    expect(COLORS.muted).toBe('#9a948a');
    expect(COLORS.faint).toBe('#8a847a');

    expect(COLORS.accent).toBe('#c4b2ff');
    expect(COLORS.accentBg).toBe('#1b1726');
    expect(COLORS.accentBorder).toBe('#4a3f6e');
    expect(COLORS.success).toBe('#8fd18b');
    expect(COLORS.successBg).toBe('#1e2a1e');
  });

  it('Supertag palette matches Section 2.1', () => {
    expect(COLORS.supertags.task.text).toBe('#8fd18b');
    expect(COLORS.supertags.task.bg).toBe('#1e2a1e');
    expect(COLORS.supertags.book.text).toBe('#e8b86a');
    expect(COLORS.supertags.book.bg).toBe('#2c2418');
    expect(COLORS.supertags.person.text).toBe('#8cc4f0');
    expect(COLORS.supertags.person.bg).toBe('#1d2630');
  });

  it('Radii scale matches Section 2.3 strictly', () => {
    expect(RADII.checkbox).toBe(5);
    expect(RADII.chip).toBe(6);
    expect(RADII.field).toBe(6);
    expect(RADII.nav).toBe(8);
    expect(RADII.row).toBe(8);
    expect(RADII.button).toBe(10);
    expect(RADII.input).toBe(10);
    expect(RADII.card).toBe(10);
    expect(RADII.featuredCard).toBe(14);
  });

  it('Layout constants match Section 2.3 strictly', () => {
    expect(LAYOUT.sidebarWidth).toBe(232);
    expect(LAYOUT.sidebarCollapsedWidth).toBe(56);
    expect(LAYOUT.coachRailWidth).toBe(344);
    expect(LAYOUT.coachRailCollapsedWidth).toBe(40);
    expect(LAYOUT.topBarHeight).toBe(56);
    expect(LAYOUT.statusBarHeight).toBe(32);
    expect(LAYOUT.mainColumnMaxWidth).toBe(760);
    expect(LAYOUT.mainColumnSidePadding).toBe(32);
    expect(LAYOUT.commandPaletteWidth).toBe(640);
  });

  it('Typography hierarchy matches Section 2.2', () => {
    expect(TYPOGRAPHY.weights.regular).toBe(400);
    expect(TYPOGRAPHY.weights.medium).toBe(500);
    expect(TYPOGRAPHY.weights.semibold).toBe(600);
  });
});

import React from 'react';
import { renderToString } from 'react-dom/server';
import { ReferenceChip } from '../src/components/ReferenceChip';
import { ReflectionCard } from '../src/coach/ReflectionCard';
import { Reflection } from '@hecate/reflection';

describe('ReferenceChip and ReflectionCard Source Note UI', () => {
  it('ReferenceChip renders chip variant with proper badge styling and truncate', () => {
    const html = renderToString(
      React.createElement(ReferenceChip, {
        targetId: 'node-1',
        title: 'Review Hecate System Architecture',
        variant: 'chip',
      })
    );

    expect(html).toContain('Review Hecate System Architecture');
    expect(html).toContain('font-mono');
    expect(html).toContain('truncate');
    expect(html).toContain('min-w-0');
  });

  it('ReflectionCard displays single source note with actual title in header', () => {
    const reflection: Reflection = {
      id: 'ref-1',
      kind: 'close_loop',
      status: 'shown',
      slot: 1,
      title: 'Clear 1 overdue item (15 min)',
      rationale: 'You have 1 open loop waiting for a decision.',
      steps: ['Take action'],
      category: 'work',
      durationMin: 15,
      sourceNodeIds: ['node-overdue'],
      score: 0.9,
    };

    const html = renderToString(
      React.createElement(ReflectionCard, {
        reflection,
        sourceNodeTitles: { 'node-overdue': 'Important Architecture RFC' },
        onDone: () => {},
        onSkip: () => {},
        onSnooze: () => {},
        onSaveAsNode: () => {},
      })
    );

    expect(html).toContain('Important Architecture RFC');
    expect(html).not.toContain('Source Note');
    expect(html).not.toContain('General');
  });

  it('ReflectionCard handles multiple source notes cleanly without header clipping', () => {
    const reflection: Reflection = {
      id: 'ref-2',
      kind: 'connect',
      status: 'shown',
      slot: 0,
      title: "Link 'Node A' and 'Node B' (10 min)",
      rationale: 'These two notes appear related but are not yet linked.',
      steps: ['Read both notes', 'Add a reference between them'],
      category: 'learning',
      durationMin: 10,
      sourceNodeIds: ['node-a', 'node-b'],
      score: 0.95,
    };

    const html = renderToString(
      React.createElement(ReflectionCard, {
        reflection,
        isFeatured: true,
        sourceNodeTitles: {
          'node-a': 'Review Hecate System Architecture',
          'node-b': 'Sync Engine Protocol Specification',
        },
        onDone: () => {},
        onSkip: () => {},
        onSnooze: () => {},
        onSaveAsNode: () => {},
      })
    );

    // Header has the clean count badge
    expect(html).toContain('2 sources');
    // Body shows the dedicated Sources section with both real titles
    expect(html).toContain('Sources:');
    expect(html).toContain('Review Hecate System Architecture');
    expect(html).toContain('Sync Engine Protocol Specification');
    // Should NOT contain the buggy cut-off fallback
    expect(html).not.toContain('Source Note');
  });

  it('ReflectionCard displays General for evergreen reflections with no source notes', () => {
    const reflection: Reflection = {
      id: 'ref-3',
      kind: 'evergreen',
      status: 'shown',
      slot: 2,
      title: 'Take a 20-minute walk (20 min)',
      rationale: 'A small action to invest in health.',
      steps: ['Walk'],
      category: 'health',
      durationMin: 20,
      sourceNodeIds: [],
      score: 0.5,
    };

    const html = renderToString(
      React.createElement(ReflectionCard, {
        reflection,
        onDone: () => {},
        onSkip: () => {},
        onSnooze: () => {},
        onSaveAsNode: () => {},
      })
    );

    expect(html).toContain('General');
    expect(html).not.toContain('sources');
    expect(html).not.toContain('Sources:');
  });
});
