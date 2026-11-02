import { describe, it, expect } from 'vitest';
import { COLORS, TYPOGRAPHY } from '../src/tokens';

describe('Hecate UI Design System Invariants', () => {
  it('Terminal Brutalism color tokens are defined strictly per spec', () => {
    expect(COLORS.bg).toBe('#0a0a0a');
    expect(COLORS.surface).toBe('#111111');
    expect(COLORS.inset).toBe('#161616');
    expect(COLORS.border).toBe('#222222');
    expect(COLORS.borderEmp).toBe('#333333');
    expect(COLORS.primary).toBe('#ffffff');
    expect(COLORS.secondary).toBe('#888888');
    expect(COLORS.muted).toBe('#555555');
  });

  it('Status colors are defined strictly for semantic indication', () => {
    expect(COLORS.status.done).toBe('#338833');
    expect(COLORS.status.danger).toBe('#cc3333');
    expect(COLORS.status.warning).toBe('#aa7722');
  });

  it('Typography weights are strictly limited to 400 and 500', () => {
    expect(TYPOGRAPHY.weights.regular).toBe(400);
    expect(TYPOGRAPHY.weights.medium).toBe(500);
    expect((TYPOGRAPHY.weights as any).bold).toBeUndefined();
  });
});
