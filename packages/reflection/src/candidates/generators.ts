import { StorageAdapter } from '@hecate/storage';
import { Candidate, ReflectionKind } from '../types';
import { EngineConfig, DEFAULT_CONFIG } from '../config';
import { getOpenLoops } from '../signals/loops';
import { findUnlinkedConnections } from '../signals/connections';
import { computeBalanceGaps, inferCategoryFromTags } from '../signals/balance';
import { computeTopicTrends } from '../signals/topics';
import { getUserContext } from '../signals/context';
import { isUnrevisited } from '../signals/revisit';
import { EVERGREEN_LIBRARY, filterEvergreenLibrary, getTimeOfDay } from '../evergreen/library';

export class CandidateGenerator {
  constructor(
    private adapter: StorageAdapter,
    private config: EngineConfig = DEFAULT_CONFIG
  ) {}

  async generateAll(now: number = Date.now()): Promise<Candidate[]> {
    const candidates: Candidate[] = [];

    // Fetch node signals for active nodes
    const signalRows = await this.adapter.query<any>(
      `SELECT ns.*, n.content, n.created_at, n.updated_at
       FROM node_signal ns
       JOIN node n ON n.id = ns.node_id
       WHERE n.deleted_at IS NULL AND n.kind != 'field' AND n.kind != 'workspace'`
    );

    const twoDaysMs = this.config.seedMinAgeDays * 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const stalledMs = this.config.stalledDays * 24 * 60 * 60 * 1000;

    // 1. seed_to_plan: Tracked node at seed, age >= 2 days, not stalled (< 14 days)
    for (const r of signalRows) {
      const lastAct = Number(r.last_activity_at || r.updated_at || now);
      const isStalled = now - lastAct >= stalledMs;

      if (r.rung === 'seed' && !isStalled) {
        const age = now - r.created_at;
        if (age >= twoDaysMs) {
          candidates.push({
            kind: 'seed_to_plan',
            sourceNodeIds: [r.node_id],
            category: r.category || 'creativity',
            durationMin: 15,
            facts: {
              title: r.content,
              tags: ['#idea'],
              ageDays: Math.floor(age / (1000 * 60 * 60 * 24)),
              childTitles: [],
            },
            baseScoreHints: {
              maturityGap: 1.0,
              importance: r.importance || 0.5,
            },
          });
        }
      }

      // 2. explore_to_plan: Tracked node at explored, not stalled (< 14 days)
      if (r.rung === 'explored' && !isStalled) {
        const age = now - r.created_at;
        candidates.push({
          kind: 'explore_to_plan',
          sourceNodeIds: [r.node_id],
          category: r.category || 'work',
          durationMin: 15,
          facts: {
            title: r.content,
            tags: ['#idea'],
            ageDays: Math.floor(age / (1000 * 60 * 60 * 24)),
            childTitles: [],
          },
          baseScoreHints: {
            maturityGap: 0.7,
            importance: r.importance || 0.5,
          },
        });
      }

      // 3. plan_to_start: Tracked node at planned, inactive 7-13 days (not stalled >= 14 days)
      if (r.rung === 'planned' && !isStalled) {
        const inactiveDays = Math.floor((now - r.last_activity_at) / (1000 * 60 * 60 * 24));
        if (now - r.last_activity_at >= sevenDaysMs) {
          candidates.push({
            kind: 'plan_to_start',
            sourceNodeIds: [r.node_id],
            category: r.category || 'work',
            durationMin: 10,
            facts: {
              title: r.content,
              daysInactive: inactiveDays,
            },
            baseScoreHints: {
              maturityGap: 0.4,
              importance: r.importance || 0.5,
            },
          });
        }
      }

      // 4. unblock: Tracked node not done, staleness >= 14 days
      if (r.rung && r.rung !== 'done' && now - r.last_activity_at >= stalledMs) {
        const daysStale = Math.floor((now - r.last_activity_at) / (1000 * 60 * 60 * 24));
        candidates.push({
          kind: 'unblock',
          sourceNodeIds: [r.node_id],
          category: r.category || 'work',
          durationMin: 10,
          facts: {
            title: r.content,
            daysStale,
          },
          baseScoreHints: {
            maturityGap: 0.5,
            importance: r.importance || 0.5,
          },
        });
      }

      // 7. revisit: S6 note (untracked knowledge notes)
      if (
        !r.rung &&
        isUnrevisited({
          createdAt: r.created_at,
          content: r.content,
          childCount: r.child_count,
          lastOpenedAt: r.last_opened_at,
          now,
        })
      ) {
        candidates.push({
          kind: 'revisit',
          sourceNodeIds: [r.node_id],
          category: r.category || 'learning',
          durationMin: 10,
          facts: {
            title: r.content,
            ageDays: Math.floor((now - r.created_at) / (1000 * 60 * 60 * 24)),
          },
          baseScoreHints: {
            maturityGap: 0.4,
            importance: r.importance || 0.5,
          },
        });
      }
    }

    // 5. close_loop: S3 open loops
    const openLoops = await getOpenLoops(this.adapter, now);
    if (openLoops.length > 0) {
      const topLoops = openLoops.slice(0, 3);
      candidates.push({
        kind: 'close_loop',
        sourceNodeIds: topLoops.map((l) => l.id),
        category: 'work',
        durationMin: 15,
        facts: {
          count: topLoops.length,
          loops: topLoops.map((l) => ({ id: l.id, title: l.content, reason: l.reason, dueIso: l.dueIso })),
        },
        baseScoreHints: {
          maturityGap: 0.6,
          importance: 0.6,
        },
      });
    }

    // 6. connect: S5 unlinked pairs
    const pairs = await findUnlinkedConnections(this.adapter, now);
    for (const pair of pairs.slice(0, 3)) {
      candidates.push({
        kind: 'connect',
        sourceNodeIds: [pair.nodeAId, pair.nodeBId],
        category: 'learning',
        durationMin: 10,
        facts: {
          a: { id: pair.nodeAId, title: pair.nodeATitle },
          b: { id: pair.nodeBId, title: pair.nodeBTitle },
          similarity: pair.similarity,
        },
        baseScoreHints: {
          maturityGap: 0.5,
          importance: 0.5,
        },
      });
    }

    // 8. pattern: S4 rising topic
    const topicTrends = await computeTopicTrends(this.adapter, now);
    const rising = topicTrends.find((t) => t.isRising && t.recentCount >= 4);
    if (rising) {
      candidates.push({
        kind: 'pattern',
        sourceNodeIds: [rising.id],
        category: 'learning',
        durationMin: 15,
        facts: {
          topic: rising.label,
          nodeCount: rising.recentCount,
        },
        baseScoreHints: {
          maturityGap: 0.6,
          importance: 0.6,
        },
      });
    }

    // 9. balance: S7 category gap >= 0.67 (only when user notes exist)
    if (signalRows.length > 0) {
      const balance = await computeBalanceGaps(this.adapter, now);
      if (balance.gaps[balance.maxGapCategory] >= 0.67) {
        const neglectedCat = balance.maxGapCategory;
        const evergreenForCat = filterEvergreenLibrary(EVERGREEN_LIBRARY, {
          category: neglectedCat,
          now,
        })[0];
        if (evergreenForCat) {
          candidates.push({
            kind: 'balance',
            sourceNodeIds: [],
            evergreenId: evergreenForCat.id,
            category: neglectedCat,
            durationMin: evergreenForCat.durationMin || 15,
            facts: {
              category: neglectedCat,
              title: evergreenForCat.title,
              steps: evergreenForCat.steps,
            },
            baseScoreHints: {
              maturityGap: balance.gaps[neglectedCat],
              importance: 0.5,
            },
          });
        }
      }
    }

    // 10. journal: Evening or after >= 3 Reflections done today with >= 1 note written today
    const ctx = await getUserContext(this.adapter, now);
    const hasNotesToday = signalRows.some(
      (r) =>
        Number(r.created_at) >= now - 24 * 60 * 60 * 1000 ||
        Number(r.updated_at) >= now - 24 * 60 * 60 * 1000
    );
    if (hasNotesToday && (ctx.localHour >= 18 || ctx.reflectionsDoneToday >= 3)) {
      candidates.push({
        kind: 'journal',
        sourceNodeIds: [],
        category: 'mindfulness',
        durationMin: 5,
        facts: {
          doneToday: ctx.reflectionsDoneToday,
          hour: ctx.localHour,
        },
        baseScoreHints: {
          maturityGap: 1.0,
          importance: 0.9,
        },
      });
    }

    // 11. evergreen: Library items
    const availableEvergreen = filterEvergreenLibrary(EVERGREEN_LIBRARY, { now });
    for (const eg of availableEvergreen.slice(0, 10)) {
      candidates.push({
        kind: 'evergreen',
        sourceNodeIds: [],
        evergreenId: eg.id,
        category: eg.category,
        durationMin: eg.durationMin,
        facts: {
          id: eg.id,
          title: eg.title,
          steps: eg.steps,
        },
        baseScoreHints: {
          maturityGap: 0.35,
          importance: 0.35,
        },
      });
    }

    return candidates;
  }
}
