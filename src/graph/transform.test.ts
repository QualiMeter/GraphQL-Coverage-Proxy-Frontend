import {describe, it, expect} from 'vitest';
import {graphEdges, layout} from './transform';
import {initialStore} from '../analytics/fixtures';
import {coverageFor} from '../analytics/model';

const currentSnapshot = initialStore.snapshots.find(item => item.id === 'customer-v2')!;

describe('graph transform', () => {
  it('keeps both Query to Customer field relations', () => {
    const edges = graphEdges(coverageFor(currentSnapshot, null, initialStore));
    expect(edges.filter(edge => edge.source === 'Query' && edge.target === 'Customer')
      .map(edge => edge.sourceHandle)).toEqual(['field:Query.customer', 'field:Query.customers']);
  });

  it('handles wrapped return types through targetType', () => {
    const edges = graphEdges(coverageFor(currentSnapshot, null, initialStore));
    expect(edges.some(edge => edge.source === 'Order' && edge.target === 'OrderItem'
      && edge.sourceHandle === 'field:Order.items')).toBe(true);
  });

  it('builds finite positions for each schema and its field relations', () => {
    for (const snapshot of initialStore.snapshots) {
      const graph = coverageFor(snapshot, null, initialStore);
      const nodes = layout(graph);
      const edges = graphEdges(graph);
      expect(nodes).toHaveLength(snapshot.types.length);
      expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length);
      expect(nodes.every(node => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true);
      expect(edges.every(edge => nodes.some(node => node.id === edge.source)
        && nodes.some(node => node.id === edge.target))).toBe(true);
    }
    const billing = initialStore.snapshots.find(item => item.id === 'billing-v1')!;
    expect(graphEdges(coverageFor(billing, null, initialStore))).toHaveLength(2);
  });
});
