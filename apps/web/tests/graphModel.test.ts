import { describe, expect, it } from 'vitest';
import { CommunityMap } from '../src/components/graph/communities';
import { GraphData } from '../src/components/graph/layout';
import { communityViews, createGraphModel } from '../src/components/graph/model';

function fixture(): { data: GraphData; communities: CommunityMap } {
  const data: GraphData = {
    nodes: ['a', 'b', 'c'].map((id) => ({ id, title: id, kind: 'content', tagIds: [], tagNames: [], hasChildren: false, degree: 1 })),
    links: [
      { source: 'a', target: 'b', kind: 'reference' },
      { source: 'b', target: 'c', kind: 'reference' },
    ],
    childrenOf: new Map([['a', ['b']]]),
  };
  const communities: CommunityMap = {
    communityOf: new Map([['a', 'one'], ['b', 'one'], ['c', 'two']]),
    communities: [
      { id: 'one', nodeIds: ['a', 'b'], label: 'One' },
      { id: 'two', nodeIds: ['c'], label: 'Two' },
    ],
  };
  return { data, communities };
}

describe('Graph render model', () => {
  it('deduplicates indexes and aggregates cross-community edges', () => {
    const { data, communities } = fixture();
    const model = createGraphModel(data, communities);
    expect(model.edges).toHaveLength(3);
    expect(model.adjacency.get('a')).toEqual(new Set(['b']));
    expect(model.communityEdges).toEqual([{ source: 'one', target: 'two', count: 1 }]);
  });

  it('derives live community centers and bounds from positions', () => {
    const { data, communities } = fixture();
    const model = createGraphModel(data, communities);
    const views = communityViews(model, new Map([
      ['a', { x: 0, y: 10 }],
      ['b', { x: 20, y: 30 }],
      ['c', { x: 100, y: 100 }],
    ]));
    expect(views.get('one')?.center).toEqual({ x: 10, y: 20 });
    expect(views.get('one')?.bounds).toEqual({ minX: 0, maxX: 20, minY: 10, maxY: 30 });
  });
});
