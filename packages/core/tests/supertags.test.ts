import { describe, it, expect } from 'vitest';
import {
  resolveEffectiveTagFields,
  planTagTemplateInjection,
  getInheritedTagIds,
} from '../src/operations/supertags';
import { TagDefMeta } from '../src/types';

describe('Supertags Inheritance & Template Injection', () => {
  const mockTags: Record<string, TagDefMeta> = {
    tag_task: {
      color: '#22c55e',
      extends: [],
      fieldDefs: [
        { fieldDefId: 'status', default: 'Inbox', pinned: true, required: true },
        { fieldDefId: 'due_date', default: '' },
      ],
      showCheckbox: true,
      defaultContent: [],
    },
    tag_designtask: {
      color: '#3b82f6',
      extends: ['tag_task'],
      fieldDefs: [
        // Overrides status default to 'Doing' and adds figma_link
        { fieldDefId: 'status', default: 'Doing' },
        { fieldDefId: 'figma_link', default: '' },
      ],
      showCheckbox: true,
      defaultContent: [{ content: 'Design Specs Checklist' }],
    },
    tag_idea: {
      color: '#eab308',
      extends: [],
      fieldDefs: [
        { fieldDefId: 'impact', default: 'Medium' },
      ],
      showCheckbox: false,
    },
  };

  const getTagDef = (id: string) => mockTags[id];

  it('resolves inheritance chain', () => {
    const inherited = getInheritedTagIds('tag_designtask', getTagDef);
    expect(inherited).toEqual(['tag_task']);
  });

  it('inherits parent fields and overrides defaults in child', () => {
    const effective = resolveEffectiveTagFields(['tag_designtask'], getTagDef);
    expect(effective.length).toBe(3); // status, due_date, figma_link

    const statusField = effective.find((f) => f.fieldDefId === 'status');
    expect(statusField).toBeDefined();
    expect(statusField?.default).toBe('Doing'); // Child override
    expect(statusField?.pinned).toBe(true); // Inherited from parent

    const figmaField = effective.find((f) => f.fieldDefId === 'figma_link');
    expect(figmaField).toBeDefined();

    const dueField = effective.find((f) => f.fieldDefId === 'due_date');
    expect(dueField).toBeDefined();
  });

  it('unions fields across multiple tags without duplicate fieldDefIds', () => {
    const effective = resolveEffectiveTagFields(['tag_task', 'tag_idea'], getTagDef);
    const ids = effective.map((f) => f.fieldDefId);
    expect(ids).toContain('status');
    expect(ids).toContain('due_date');
    expect(ids).toContain('impact');
    expect(ids.length).toBe(3);
  });

  it('plans template injection avoiding existing fields', () => {
    const existingFieldDefIds = ['status'];
    const plan = planTagTemplateInjection(
      'tag_designtask',
      getTagDef,
      existingFieldDefIds,
      Date.now()
    );

    // 'status' is already present, so only due_date and figma_link should be injected
    expect(plan.fieldsToInject.map((f) => f.fieldDefId)).toEqual(['due_date', 'figma_link']);
    expect(plan.contentToInject.length).toBe(1);
    expect(plan.contentToInject[0].content).toBe('Design Specs Checklist');
    expect(plan.shouldEnableCheckbox).toBe(true);
  });
});
