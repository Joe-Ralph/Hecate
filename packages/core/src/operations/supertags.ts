/**
 * Supertag inheritance, field resolution, and template injection logic.
 */

import { TagDefMeta, TagFieldDefConfig, DefaultContentItem, NodeKind } from '../types';
import { wouldCauseTagCycle } from '../invariants';

export interface ResolvedTagField extends TagFieldDefConfig {
  sourceTagId: string;
}

/**
 * Resolves all inherited tag IDs for a given tag (breadth-first, cycle-safe).
 */
export function getInheritedTagIds(
  tagId: string,
  getTagDef: (id: string) => TagDefMeta | undefined
): string[] {
  const result: string[] = [];
  const queue = [tagId];
  const visited = new Set<string>([tagId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const def = getTagDef(current);
    if (!def || !def.extends) continue;

    for (const parentId of def.extends) {
      if (!visited.has(parentId)) {
        visited.add(parentId);
        result.push(parentId);
        queue.push(parentId);
      }
    }
  }

  return result;
}

/**
 * Computes the effective list of fields for a set of tags applied to a node.
 * - Follows inheritance chains (child overrides parent)
 * - De-duplicates by fieldDefId
 * - Tag application order resolves conflicts across multiple top-level tags (first applied wins)
 */
export function resolveEffectiveTagFields(
  tagIds: string[],
  getTagDef: (id: string) => TagDefMeta | undefined
): ResolvedTagField[] {
  const fieldMap = new Map<string, ResolvedTagField>();

  for (const tagId of tagIds) {
    const def = getTagDef(tagId);
    if (!def) continue;

    // Collect chain: [ancestors..., tagId] so tagId overrides ancestors
    const ancestors = getInheritedTagIds(tagId, getTagDef).reverse();
    const chain = [...ancestors, tagId];

    for (const currentTagId of chain) {
      const currentDef = getTagDef(currentTagId);
      if (!currentDef || !currentDef.fieldDefs) continue;

      for (const f of currentDef.fieldDefs) {
        if (!fieldMap.has(f.fieldDefId)) {
          fieldMap.set(f.fieldDefId, { ...f, sourceTagId: currentTagId });
        } else {
          // If already in map from an ancestor or previous tag:
          // If this is a descendant in the same branch, override properties!
          const existing = fieldMap.get(f.fieldDefId)!;
          if (chain.includes(existing.sourceTagId)) {
            fieldMap.set(f.fieldDefId, {
              fieldDefId: f.fieldDefId,
              pinned: f.pinned !== undefined ? f.pinned : existing.pinned,
              default: f.default !== undefined ? f.default : existing.default,
              required: f.required !== undefined ? f.required : existing.required,
              sourceTagId: currentTagId,
            });
          }
        }
      }
    }
  }

  return Array.from(fieldMap.values());
}

export interface InjectedFieldPlan {
  fieldDefId: string;
  initialValue: any;
  pinned: boolean;
}

export interface InjectedContentNodePlan {
  content: string;
  kind: NodeKind;
  children?: InjectedContentNodePlan[];
}

export interface TemplateInjectionPlan {
  fieldsToInject: InjectedFieldPlan[];
  contentToInject: InjectedContentNodePlan[];
  shouldEnableCheckbox: boolean;
}

/**
 * Computes fields and default content to inject when a tag is applied to a node.
 * Avoids re-injecting already existing fields.
 */
export function planTagTemplateInjection(
  tagId: string,
  getTagDef: (id: string) => TagDefMeta | undefined,
  existingFieldDefIds: string[],
  now: number = Date.now(),
  getFieldAutoInit?: (fieldDefId: string) => { autoInit?: string; defaultValue?: any }
): TemplateInjectionPlan {
  const def = getTagDef(tagId);
  if (!def) {
    return { fieldsToInject: [], contentToInject: [], shouldEnableCheckbox: false };
  }

  const effectiveFields = resolveEffectiveTagFields([tagId], getTagDef);
  const existingSet = new Set(existingFieldDefIds);

  const fieldsToInject: InjectedFieldPlan[] = [];

  for (const f of effectiveFields) {
    if (existingSet.has(f.fieldDefId)) continue;

    let initVal = f.default !== undefined ? f.default : '';
    if (getFieldAutoInit) {
      const fieldMeta = getFieldAutoInit(f.fieldDefId);
      if (fieldMeta) {
        if (fieldMeta.autoInit === 'today') {
          const d = new Date(now);
          const iso = d.toISOString().split('T')[0];
          initVal = `[[date:${iso}]]`;
        } else if (fieldMeta.autoInit === 'default' && fieldMeta.defaultValue !== undefined) {
          initVal = fieldMeta.defaultValue;
        }
      }
    }

    fieldsToInject.push({
      fieldDefId: f.fieldDefId,
      initialValue: initVal,
      pinned: !!f.pinned,
    });
  }

  // Collect default content from tag and ancestors
  const contentToInject: InjectedContentNodePlan[] = [];
  const ancestors = getInheritedTagIds(tagId, getTagDef).reverse();
  const chain = [...ancestors, tagId];

  for (const tid of chain) {
    const tdef = getTagDef(tid);
    if (tdef && tdef.defaultContent) {
      for (const item of tdef.defaultContent) {
        contentToInject.push(mapDefaultContentItem(item));
      }
    }
  }

  const shouldEnableCheckbox = Boolean(def.showCheckbox);

  return {
    fieldsToInject,
    contentToInject,
    shouldEnableCheckbox,
  };
}

function mapDefaultContentItem(item: DefaultContentItem): InjectedContentNodePlan {
  return {
    content: item.content,
    kind: item.kind || 'content',
    children: item.children ? item.children.map(mapDefaultContentItem) : [],
  };
}
