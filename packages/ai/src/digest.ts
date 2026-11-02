/**
 * Knowledge Digest Builder
 * Sanitizes and formats workspace nodes into a compact, privacy-preserving digest.
 */

import { HecateDatabase } from '@hecate/storage';
import { DigestPayload, DigestRow } from './types';
import { formatDate } from '@hecate/core';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const URL_QUERY_REGEX = /(\bhttps?:\/\/[^\s?#]+)\?[^\s#]*/g;
const NODE_REF_TOKEN_REGEX = /\[\[node:[A-Za-z0-9_-]+\]\]/g;
const MAX_DIGEST_NODES = 300;
const MAX_NODE_CHAR_LENGTH = 400;

export function sanitizeText(text: string): string {
  if (!text) return '';
  let sanitized = text;

  // Replace emails
  sanitized = sanitized.replace(EMAIL_REGEX, '[email]');

  // Replace phone numbers
  sanitized = sanitized.replace(PHONE_REGEX, '[phone]');

  // Strip URL queries
  sanitized = sanitized.replace(URL_QUERY_REGEX, '$1');

  // Strip node IDs
  sanitized = sanitized.replace(NODE_REF_TOKEN_REGEX, '[link]');

  // Truncate length
  if (sanitized.length > MAX_NODE_CHAR_LENGTH) {
    sanitized = sanitized.slice(0, MAX_NODE_CHAR_LENGTH) + '…';
  }

  return sanitized.trim();
}

export async function buildKnowledgeDigest(
  db: HecateDatabase,
  windowDays: number = 7,
  now: number = Date.now()
): Promise<DigestPayload> {
  const settings = await db.settings.getSettings();
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;

  // 1. Identify excluded tag IDs (including #private and tags with aiExclude=true)
  const allTags = await db.tags.getAllTags();
  const excludedTagIds = new Set<string>();
  for (const t of allTags) {
    const meta: any = t.meta || {};
    if (t.content === 'private' || meta.aiExclude === true) {
      excludedTagIds.add(t.id);
    }
  }

  // 2. Fetch candidate nodes
  const rawNodes = await db.adapter.query<any>(
    `SELECT * FROM node
     WHERE kind IN ('content', 'day')
       AND deleted_at IS NULL
       AND (updated_at >= ? OR created_at >= ?)
     ORDER BY updated_at DESC
     LIMIT ?`,
    [cutoff, cutoff, MAX_DIGEST_NODES * 2]
  );

  const digestRows: DigestRow[] = [];

  for (const node of rawNodes) {
    if (digestRows.length >= MAX_DIGEST_NODES) break;

    // Check node-level meta exclusion
    let meta: any = {};
    if (node.meta) {
      try {
        meta = JSON.parse(node.meta);
      } catch {}
    }
    if (meta.aiExclude === true) continue;

    // Check attached tags
    const tags = await db.tags.getTagsForNode(node.id);
    const hasExcludedTag = tags.some((t) => excludedTagIds.has(t.id));
    if (hasExcludedTag) continue;

    // Scope check
    if (settings.aiScope === 'dailyOnly' && node.kind !== 'day') {
      continue;
    }
    if (settings.aiScope === 'taggedOnly') {
      const allowedTagNames = new Set(settings.aiScopeTags || []);
      const matchesScope = tags.some((t) => allowedTagNames.has(t.content));
      if (!matchesScope) continue;
    }

    // Retrieve child fields
    const fieldRows = await db.adapter.query<any>(
      `SELECT f.meta as field_meta, v.content as field_value
       FROM node f
       JOIN node v ON v.parent_id = f.id
       WHERE f.parent_id = ? AND f.kind = 'field' AND f.deleted_at IS NULL`,
      [node.id]
    );

    const fields: Record<string, string> = {};
    for (const fr of fieldRows) {
      if (fr.field_meta && fr.field_value) {
        try {
          const fm = JSON.parse(fr.field_meta);
          // Omit files
          if (fm.type === 'file') continue;
          const cleanVal = sanitizeText(fr.field_value);
          if (cleanVal) {
            fields[fm.fieldDefId || 'field'] = cleanVal;
          }
        } catch {}
      }
    }

    const cleanContent = sanitizeText(node.content);
    if (!cleanContent && Object.keys(fields).length === 0) continue;

    digestRows.push({
      tags: tags.map((t) => t.content),
      text: cleanContent,
      fields,
    });
  }

  // 3. Recent tasks and category statistics
  const recentTasksRecords = await db.ai.getRecentTasks(14);
  const recentTasks = recentTasksRecords.map((t) => t.title);
  const categoryStats = await db.ai.getCategoryStats();

  return {
    digest: digestRows,
    windowDays,
    recentTasks,
    categoryStats,
    locale: 'en',
    today: formatDate(new Date(now)),
  };
}
