import { StorageAdapter } from '@hecate/storage';

export interface TopicTrend {
  id: string;
  label: string;
  kind: 'tag' | 'keyword' | 'cluster';
  recentCount: number;
  baselineWeeklyAvg: number;
  trend: number;
  isRising: boolean;
  isFading: boolean;
}

/**
 * S4 Topic Trend (Section 5)
 */
export async function computeTopicTrends(adapter: StorageAdapter, now: number = Date.now()): Promise<TopicTrend[]> {
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyFiveDaysAgo = now - 35 * 24 * 60 * 60 * 1000;

  // Query tag-based topics
  const tags = await adapter.query<{ id: string; content: string }>(
    "SELECT id, content FROM node WHERE kind = 'tagDef' AND deleted_at IS NULL"
  );

  const results: TopicTrend[] = [];

  for (const tag of tags) {
    // Recent count (last 7 days)
    const recentRows = await adapter.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM node_tag nt
       JOIN node n ON n.id = nt.node_id
       WHERE nt.tag_def_id = ? AND n.deleted_at IS NULL AND n.created_at >= ?`,
      [tag.id, sevenDaysAgo]
    );
    const recentCount = Number(recentRows[0]?.count || 0);

    // Prior 4 weeks count
    const priorRows = await adapter.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM node_tag nt
       JOIN node n ON n.id = nt.node_id
       WHERE nt.tag_def_id = ? AND n.deleted_at IS NULL AND n.created_at >= ? AND n.created_at < ?`,
      [tag.id, thirtyFiveDaysAgo, sevenDaysAgo]
    );
    const priorCount = Number(priorRows[0]?.count || 0);
    const baselineWeeklyAvg = priorCount / 4;

    const trend = recentCount / Math.max(1, baselineWeeklyAvg);
    const isRising = trend >= 1.5 && recentCount >= 2;
    const isFading = trend <= 0.5 && priorCount >= 3;

    results.push({
      id: tag.id,
      label: tag.content,
      kind: 'tag',
      recentCount,
      baselineWeeklyAvg,
      trend,
      isRising,
      isFading,
    });
  }

  return results;
}
