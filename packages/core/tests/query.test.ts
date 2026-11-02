import { describe, it, expect } from 'vitest';
import { compileQueryToSql, SearchQuery } from '../src/query';

describe('Query Compiler', () => {
  it('compiles tag filter with descendants', () => {
    const query: SearchQuery = {
      clauses: [
        {
          type: 'hasTag',
          tagId: 'tag_task',
          includeDescendants: true,
        },
      ],
    };

    const getDescendants = (id: string) => (id === 'tag_task' ? ['tag_bug', 'tag_feature'] : []);
    const compiled = compileQueryToSql(query, { getTagDescendants: getDescendants });

    expect(compiled.sql).toContain('node.id IN (SELECT node_id FROM node_tag WHERE tag_def_id IN (?, ?, ?))');
    expect(compiled.params).toContain('tag_task');
    expect(compiled.params).toContain('tag_bug');
    expect(compiled.params).toContain('tag_feature');
  });

  it('resolves contextual $thisNode token for references clause', () => {
    const query: SearchQuery = {
      clauses: [
        {
          type: 'references',
          nodeId: '$thisNode',
        },
      ],
    };

    const compiled = compileQueryToSql(query, { contextNodeId: '01H_MAYA_ID' });
    expect(compiled.sql).toContain('node.id IN (SELECT source_node_id FROM ref WHERE target_node_id = ?)');
    expect(compiled.params).toContain('01H_MAYA_ID');
  });

  it('compiles field comparisons', () => {
    const query: SearchQuery = {
      clauses: [
        {
          type: 'field',
          fieldDefId: 'field_status',
          cmp: 'eq',
          value: 'Doing',
        },
      ],
    };

    const compiled = compileQueryToSql(query);
    expect(compiled.sql).toContain("f.kind = 'field'");
    expect(compiled.sql).toContain("v.content = ?");
    expect(compiled.params).toContain('field_status');
    expect(compiled.params).toContain('Doing');
  });

  it('compiles nested boolean logic AND / OR', () => {
    const query: SearchQuery = {
      op: 'OR',
      clauses: [
        { type: 'done', value: true },
        { type: 'text', q: 'Hecate' },
      ],
    };

    const compiled = compileQueryToSql(query);
    expect(compiled.sql).toContain('node.done_at IS NOT NULL');
    expect(compiled.sql).toContain('node.content LIKE ?');
    expect(compiled.sql).toContain(' OR ');
  });
});
