/**
 * OutlinerNode Component
 * One TipTap editor per focused node; static HTML when unfocused for 60fps performance.
 * Quiet, warm, dark design system compliant with rich fields & supertag integration.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { NodeRecord, parseTanaPaste, isTanaPaste, FieldType, FieldOption, generateKeyBetween, resolveEffectiveTagFields, BUILTIN_COMMANDS, CommandRecord } from '@hecate/core';
import { Bullet, Chevron, Checkbox, TagChip, ReferenceChip, FieldRow } from '@hecate/ui';
import { useWorkspaceStore } from '../store/workspaceStore';
import { Plus, Tag, MoreHorizontal, Database, Terminal } from 'lucide-react';

export interface OutlinerNodeProps {
  node: NodeRecord;
  depth?: number;
  focusedNodeId: string | null;
  onFocusNode: (id: string | null) => void;
  onZoomNode?: (nodeId: string) => void;
  onOpenNodePicker?: (nodeId: string) => void;
  onOpenTagPicker?: (nodeId: string) => void;
  onOpenFieldPicker?: (nodeId: string) => void;
  onEditSupertag?: (tagDefId: string) => void;
}

export const OutlinerNode: React.FC<OutlinerNodeProps> = ({
  node,
  depth = 0,
  focusedNodeId,
  onFocusNode,
  onZoomNode,
  onOpenNodePicker,
  onOpenTagPicker,
  onOpenFieldPicker,
  onEditSupertag,
}) => {
  const isFocused = focusedNodeId === node.id;
  const store = useWorkspaceStore();

  const [children, setChildren] = useState<NodeRecord[]>([]);
  const [tags, setTags] = useState<NodeRecord[]>([]);
  const [fields, setFields] = useState<
    Array<{
      fieldNode: NodeRecord;
      valueNode: NodeRecord;
      name: string;
      type: FieldType;
      options: FieldOption[];
      required?: boolean;
      targetTag?: string;
      min?: number;
      max?: number;
    }>
  >([]);

  // Load children, tags, and fields when version or node changes
  useEffect(() => {
    if (!store.db) return;
    let isCancelled = false;

    async function loadData() {
      if (!store.db) return;
      const childNodes = await store.db.nodes.getChildren(node.id);
      const tagNodes = await store.db.tags.getTagsForNode(node.id);

      // Required flags come from the effective supertag field configs (REQ-4.6)
      const allTags = await store.db.tags.getAllTags();
      const tagMap = new Map(allTags.map((t) => [t.id, t.meta as any]));
      const effectiveConfigs = resolveEffectiveTagFields(
        tagNodes.map((t) => t.id),
        (id) => tagMap.get(id)
      );
      const requiredMap = new Map(effectiveConfigs.map((c) => [c.fieldDefId, !!c.required]));

      const contentChildren: NodeRecord[] = [];
      const fieldList: Array<{
        fieldNode: NodeRecord;
        valueNode: NodeRecord;
        name: string;
        type: FieldType;
        options: FieldOption[];
        required?: boolean;
        targetTag?: string;
        min?: number;
        max?: number;
      }> = [];

      for (const c of childNodes) {
        if (c.kind === 'field') {
          const valNodes = await store.db.nodes.getChildren(c.id);
          const val = valNodes[0] || { content: '' };
          const fieldDefId = c.meta?.fieldDefId;
          let fieldName = 'Field';
          let fieldType: FieldType = 'text';
          let fieldOptions: FieldOption[] = [];
          let targetTag: string | undefined;
          let min: number | undefined;
          let max: number | undefined;

          if (fieldDefId) {
            const fdef = await store.db.nodes.getById(fieldDefId);
            if (fdef) {
              fieldName = fdef.content;
              const fmeta = fdef.meta || {};
              fieldType = fmeta.type || 'text';
              fieldOptions = fmeta.options || [];
              targetTag = fmeta.targetTag;
              min = fmeta.min;
              max = fmeta.max;
            }
          }

          // Ensure proper type resolution for standard names
          const lowerName = fieldName.toLowerCase();
          if (lowerName === 'due' || lowerName === 'date' || lowerName.includes('date')) {
            fieldType = 'date';
          } else if (lowerName === 'status' && fieldOptions.length === 0) {
            fieldType = 'options';
            fieldOptions = [
              { id: 'inbox', label: 'Inbox', color: 'var(--text-muted)' },
              { id: 'doing', label: 'Doing', color: '#3b82f6' },
              { id: 'done', label: 'Done', color: 'var(--green)' },
            ];
          } else if (lowerName === 'priority' && fieldOptions.length === 0) {
            fieldType = 'options';
            fieldOptions = [
              { id: 'high', label: 'High', color: 'var(--red)' },
              { id: 'medium', label: 'Medium', color: 'var(--gold)' },
              { id: 'low', label: 'Low', color: 'var(--text-muted)' },
            ];
          }

          fieldList.push({
            fieldNode: c,
            valueNode: val as NodeRecord,
            name: fieldName,
            type: fieldType,
            options: fieldOptions,
            required: fieldDefId ? requiredMap.get(fieldDefId) : false,
            targetTag,
            min,
            max,
          });
        } else {
          contentChildren.push(c);
        }
      }

      if (!isCancelled) {
        setChildren(contentChildren);
        setTags(tagNodes);
        setFields(fieldList);
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [node.id, store.version, store.db]);

  // Supertag inline autocomplete state
  const [availableTags, setAvailableTags] = useState<NodeRecord[]>([]);
  const [hashState, setHashState] = useState<{
    active: boolean;
    prefix: string;
    from: number;
    to: number;
  }>({
    active: false,
    prefix: '',
    from: 0,
    to: 0,
  });
  const [activeTagIndex, setActiveTagIndex] = useState(0);

  const hashStateRef = useRef(hashState);
  hashStateRef.current = hashState;

  const activeTagIndexRef = useRef(activeTagIndex);
  activeTagIndexRef.current = activeTagIndex;

  const availableTagsRef = useRef(availableTags);
  availableTagsRef.current = availableTags;

  // Inline [[ node reference autocomplete state
  const [bracketState, setBracketState] = useState<{
    active: boolean;
    query: string;
    from: number;
    to: number;
  }>({
    active: false,
    query: '',
    from: 0,
    to: 0,
  });
  const [activeRefIndex, setActiveRefIndex] = useState(0);
  const [refResults, setRefResults] = useState<Array<{ id: string; title: string; tags?: string[] }>>([]);

  const bracketStateRef = useRef(bracketState);
  bracketStateRef.current = bracketState;

  const activeRefIndexRef = useRef(activeRefIndex);
  activeRefIndexRef.current = activeRefIndex;

  const refResultsRef = useRef(refResults);
  refResultsRef.current = refResults;

  // Title cache for resolving references in static rendering
  const [refTitles, setRefTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!node.content || !store.db) return;
    const regex = /\[\[node:([A-Za-z0-9_-]+)\]\]/g;
    let m: RegExpExecArray | null;
    const ids: string[] = [];
    while ((m = regex.exec(node.content)) !== null) {
      ids.push(m[1]);
    }
    for (const tid of ids) {
      if (!refTitles[tid]) {
        store.db.nodes.getById(tid).then((target) => {
          if (target) {
            setRefTitles((prev) => ({ ...prev, [tid]: target.content || 'Untitled Node' }));
          }
        });
      }
    }
  }, [node.content, store.db, store.version]);

  useEffect(() => {
    if (store.db) {
      store.db.tags.getAllTags().then(setAvailableTags);
    }
  }, [store.db, store.version, isFocused]);

  // Query nodes when bracket [[ autocomplete is active
  useEffect(() => {
    if (!bracketState.active || !store.db) {
      setRefResults([]);
      return;
    }
    let isMounted = true;
    const q = bracketState.query.trim().toLowerCase();

    store.db.search.globalSearch(q).then(async (nodes) => {
      if (!isMounted) return;
      const items = await Promise.all(
        nodes
          .filter((n) => n.id !== node.id)
          .slice(0, 15)
          .map(async (n) => {
            const nodeTags = await store.db!.tags.getTagsForNode(n.id);
            return {
              id: n.id,
              title: n.content || 'Untitled Node',
              tags: nodeTags.map((t) => t.content),
            };
          })
      );
      if (isMounted) {
        const sorted = items.sort((a, b) => {
          const aStarts = a.title.toLowerCase().startsWith(q);
          const bStarts = b.title.toLowerCase().startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.title.localeCompare(b.title);
        });
        setRefResults(sorted);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [bracketState.active, bracketState.query, store.db, node.id]);

  const getFilteredTags = () => {
    const prefix = (hashStateRef.current.prefix || '').toLowerCase().trim();
    const all = availableTagsRef.current || [];
    if (!prefix) return all;
    return all
      .filter((t) => t.content.toLowerCase().includes(prefix))
      .sort((a, b) => {
        const aStarts = a.content.toLowerCase().startsWith(prefix);
        const bStarts = b.content.toLowerCase().startsWith(prefix);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.content.localeCompare(b.content);
      });
  };

  const checkHashTrigger = (editorInstance: any) => {
    if (!editorInstance) return;
    const { from } = editorInstance.state.selection;
    const textBefore = editorInstance.state.doc.textBetween(0, from, '\n');

    // Trigger on # anywhere after beginning of line OR whitespace
    const match = textBefore.match(/(?:^|\s)#([a-zA-Z0-9_\-]*)$/);
    if (match) {
      const prefix = match[1];
      const hashIndex = from - prefix.length - 1;
      setHashState({
        active: true,
        prefix,
        from: hashIndex,
        to: from,
      });
      setActiveTagIndex(0);
    } else {
      setHashState((prev) => (prev.active ? { active: false, prefix: '', from: 0, to: 0 } : prev));
    }
  };

  const applySelectedTag = async (tagDefId: string) => {
    const { from, to } = hashStateRef.current;
    if (editor && from >= 0 && to >= from) {
      editor.chain().focus().deleteRange({ from, to }).run();
    }
    setHashState({ active: false, prefix: '', from: 0, to: 0 });
    await store.applyTag(node.id, tagDefId);
  };

  const createAndApplyTag = async (tagName: string) => {
    if (!store.db || !tagName.trim()) return;
    const clean = tagName.trim().replace(/^#/, '');
    let tag = await store.db.tags.getTagByName(clean);
    if (!tag) {
      tag = await store.db.tags.createTag(clean, {
        color: 'var(--accent)',
        showCheckbox: clean.toLowerCase() === 'task',
      });
    }
    await applySelectedTag(tag.id);
  };

  const checkBracketTrigger = (editorInstance: any) => {
    if (!editorInstance) return;
    const { from } = editorInstance.state.selection;
    const textBefore = editorInstance.state.doc.textBetween(0, from, '\n');

    // Trigger on [[ followed by anything except ]
    const match = textBefore.match(/(?:^|\s)\[\[([^\]]*)$/);
    if (match) {
      const query = match[1];
      const matchStart = textBefore.lastIndexOf('[[');
      setBracketState({
        active: true,
        query,
        from: matchStart,
        to: from,
      });
      setActiveRefIndex(0);
    } else {
      setBracketState((prev) => (prev.active ? { active: false, query: '', from: 0, to: 0 } : prev));
    }
  };

  const applySelectedRef = async (targetId: string) => {
    const { from, to } = bracketStateRef.current;
    if (editor && from >= 0 && to >= from) {
      editor.chain().focus().deleteRange({ from, to }).insertContent(`[[node:${targetId}]] `).run();
    }
    setBracketState({ active: false, query: '', from: 0, to: 0 });
  };

  const createAndApplyRef = async (title: string) => {
    if (!title.trim()) return;
    const created = await store.createNode({ content: title.trim() });
    await applySelectedRef(created.id);
  };

  // TipTap editor instance (active only when focused)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
      }),
      Placeholder.configure({
        placeholder: 'Empty node...',
      }),
    ],
    content: node.content,
    autofocus: 'end',
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      store.updateNodeContent(node.id, text);
      checkHashTrigger(editor);
      checkBracketTrigger(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      checkHashTrigger(editor);
      checkBracketTrigger(editor);
    },
    editorProps: {
      handleKeyDown: (_view, event) => {
        // Handle inline supertag autocomplete navigation
        if (hashStateRef.current.active) {
          const filtered = getFilteredTags();
          const prefix = hashStateRef.current.prefix.trim();
          const canCreate = Boolean(
            prefix && !filtered.some((t) => t.content.toLowerCase() === prefix.toLowerCase())
          );
          const totalCount = filtered.length + (canCreate ? 1 : 0);

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveTagIndex((prev) => (prev + 1) % Math.max(1, totalCount));
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveTagIndex((prev) => (prev - 1 + totalCount) % Math.max(1, totalCount));
            return true;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            const currIdx = activeTagIndexRef.current;
            if (currIdx < filtered.length) {
              applySelectedTag(filtered[currIdx].id);
            } else if (canCreate) {
              createAndApplyTag(prefix);
            }
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setHashState({ active: false, prefix: '', from: 0, to: 0 });
            return true;
          }
        }

        // Handle inline [[ reference autocomplete navigation
        if (bracketStateRef.current.active) {
          const query = bracketStateRef.current.query.trim();
          const filtered = refResultsRef.current;
          const canCreate = Boolean(
            query && !filtered.some((r) => r.title.toLowerCase() === query.toLowerCase())
          );
          const totalCount = filtered.length + (canCreate ? 1 : 0);

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveRefIndex((prev) => (prev + 1) % Math.max(1, totalCount));
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveRefIndex((prev) => (prev - 1 + totalCount) % Math.max(1, totalCount));
            return true;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            const currIdx = activeRefIndexRef.current;
            if (currIdx < filtered.length) {
              applySelectedRef(filtered[currIdx].id);
            } else if (canCreate) {
              createAndApplyRef(query);
            }
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setBracketState({ active: false, query: '', from: 0, to: 0 });
            return true;
          }
        }

        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          store.createSiblingNode(node.id).then((sibling) => {
            onFocusNode(sibling.id);
          });
          return true;
        }
        if (event.key === 'Tab') {
          event.preventDefault();
          if (event.shiftKey) {
            store.outdentNode(node.id);
          } else {
            store.indentNode(node.id);
          }
          return true;
        }
        if (event.key === 'Backspace' && !editor?.getText()) {
          event.preventDefault();
          store.requestDeleteNode(node.id);
          onFocusNode(null);
          return true;
        }
        // Shift+Up/Down: extend multi-selection among siblings (REQ-1.7)
        if (
          event.shiftKey &&
          !event.altKey &&
          !event.metaKey &&
          !event.ctrlKey &&
          (event.key === 'ArrowUp' || event.key === 'ArrowDown')
        ) {
          event.preventDefault();
          (async () => {
            if (!store.db) return;
            const siblings = (await store.db.nodes.getChildren(node.parent_id)).filter(
              (c) => c.kind === 'content'
            );
            const ids = siblings.map((s) => s.id);
            const idx = ids.indexOf(node.id);
            const targetIdx = event.key === 'ArrowUp' ? idx - 1 : idx + 1;
            if (targetIdx < 0 || targetIdx >= ids.length) return;
            const anchor = store.selectionAnchorId || node.id;
            const a = ids.indexOf(anchor);
            const b = targetIdx;
            if (a === -1) return;
            const [start, end] = a < b ? [a, b] : [b, a];
            store.setSelection(ids.slice(start, end + 1), anchor);
          })();
          return true;
        }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          store.toggleDone(node.id);
          return true;
        }
        if (event.key === 'ArrowUp' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          store.toggleCollapse(node.id);
          return true;
        }
        if (event.key === 'ArrowDown' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          store.toggleCollapse(node.id);
          return true;
        }
        if (event.altKey && event.shiftKey && event.key === 'ArrowUp') {
          event.preventDefault();
          store.moveSibling(node.id, 'up');
          return true;
        }
        if (event.altKey && event.shiftKey && event.key === 'ArrowDown') {
          event.preventDefault();
          store.moveSibling(node.id, 'down');
          return true;
        }
        if (event.key === '>') {
          onOpenFieldPicker?.(node.id);
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const pasteText = event.clipboardData?.getData('text/plain');
        if (pasteText && isTanaPaste(pasteText)) {
          event.preventDefault();
          const parsed = parseTanaPaste(pasteText);
          // Shared insertion path: refs, tags (created if missing), fields, children
          store.insertParsedNodes(parsed, node.id);
          return true;
        }
        return false;
      },
    },
  });

  const handleStaticClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFocusNode(node.id);
  };

  // Render inline references and chips
  const renderFormattedContent = (text: string) => {
    if (!text) {
      return <span className="text-[var(--text-muted)] italic">Empty node</span>;
    }

    const parts = text.split(/(\[\[node:[A-Za-z0-9_-]+\]\])/g);
    return parts.map((part, idx) => {
      const match = part.match(/\[\[node:([A-Za-z0-9_-]+)\]\]/);
      if (match) {
        const targetId = match[1];
        return (
          <ReferenceChip
            key={idx}
            targetId={targetId}
            title={refTitles[targetId] || targetId}
            onClick={(id, side) => store.openNode(id, side)}
            loadPreview={async (id) => {
              if (!store.db) return { content: '', children: [] };
              const target = await store.db.nodes.getById(id);
              const targetChildren = await store.db.nodes.getChildren(id);
              return {
                content: target?.content || 'Untitled Node',
                children: targetChildren
                  .filter((c) => c.kind === 'content')
                  .map((c) => c.content)
                  .slice(0, 5),
              };
            }}
          />
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const isCollapsed = Boolean(node.collapsed);
  const isDone = Boolean(node.done_at);
  const isSelected = store.selectedNodeIds.includes(node.id);
  const [dropZone, setDropZone] = useState<'before' | 'after' | 'into' | null>(null);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [customCommands, setCustomCommands] = useState<CommandRecord[]>([]);
  const commandMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!commandMenuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (commandMenuRef.current && !commandMenuRef.current.contains(e.target as Node)) {
        setCommandMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [commandMenuOpen]);

  const handleShiftSelect = async () => {
    const { selectedNodeIds, selectionAnchorId } = store;
    if (!selectionAnchorId || selectionAnchorId === node.id) {
      store.setSelection([node.id], node.id);
      return;
    }
    if (!store.db) return;
    const anchor = await store.db.nodes.getById(selectionAnchorId);
    if (anchor && anchor.parent_id === node.parent_id) {
      const siblings = (await store.db.nodes.getChildren(node.parent_id)).filter(
        (c) => c.kind === 'content'
      );
      const ids = siblings.map((s) => s.id);
      const a = ids.indexOf(selectionAnchorId);
      const b = ids.indexOf(node.id);
      if (a !== -1 && b !== -1) {
        const [start, end] = a < b ? [a, b] : [b, a];
        store.setSelection(ids.slice(start, end + 1), selectionAnchorId);
        return;
      }
    }
    // Different parents: additive toggle
    if (selectedNodeIds.includes(node.id)) {
      store.setSelection(selectedNodeIds.filter((id) => id !== node.id), selectionAnchorId);
    } else {
      store.setSelection([...selectedNodeIds, node.id], selectionAnchorId);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    const draggedId = e.dataTransfer.getData('application/x-hecate-node');
    setDropZone(null);
    if (!draggedId || draggedId === node.id || !store.db) return;
    e.preventDefault();
    try {
      if (dropZone === 'into') {
        const kids = await store.db.nodes.getChildren(node.id);
        const lastPos = kids.length > 0 ? kids[kids.length - 1].position : null;
        await store.moveNodeTo(draggedId, node.id, generateKeyBetween(lastPos, null));
      } else {
        const siblings = await store.db.nodes.getChildren(node.parent_id);
        const idx = siblings.findIndex((s) => s.id === node.id);
        if (idx === -1) return;
        if (dropZone === 'before') {
          const prevPos = idx > 0 ? siblings[idx - 1].position : null;
          await store.moveNodeTo(draggedId, node.parent_id, generateKeyBetween(prevPos, node.position));
        } else {
          const nextPos = idx < siblings.length - 1 ? siblings[idx + 1].position : null;
          await store.moveNodeTo(draggedId, node.parent_id, generateKeyBetween(node.position, nextPos));
        }
      }
    } catch (err) {
      console.warn('Move rejected:', err);
    }
  };
  const showCheckbox =
    node.kind === 'day' ||
    tags.some((t) => t.content === 'task' || (t.meta as any)?.showCheckbox) ||
    isDone;

  const currentFilteredTags = getFilteredTags();
  const currentPrefix = hashState.prefix.trim();
  const canCreateCurrent = Boolean(
    currentPrefix && !currentFilteredTags.some((t) => t.content.toLowerCase() === currentPrefix.toLowerCase())
  );

  return (
    <div className="relative font-sans select-text group/node">
      {/* Node Row with 8px radius */}
      <div
        onMouseDown={(e) => {
          if (e.shiftKey) e.preventDefault();
        }}
        onClick={(e) => {
          if (e.shiftKey) {
            e.stopPropagation();
            handleShiftSelect();
          }
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('application/x-hecate-node')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientY - rect.top) / rect.height;
          setDropZone(ratio < 0.33 ? 'before' : ratio > 0.67 ? 'after' : 'into');
        }}
        onDragLeave={() => setDropZone(null)}
        onDrop={handleDrop}
        className={`flex items-start py-1 px-2 rounded-[8px] hover:bg-[var(--bg-hover)] transition-colors duration-120 ${
          isFocused ? 'bg-[var(--bg-hover)] ring-1 ring-[var(--accent)]/40' : ''
        } ${isSelected ? 'bg-[var(--bg-accent-soft)] ring-1 ring-[var(--accent)]/60' : ''} ${
          dropZone === 'before'
            ? 'border-t-2 border-[var(--accent)]'
            : dropZone === 'after'
              ? 'border-b-2 border-[var(--accent)]'
              : dropZone === 'into'
                ? 'ring-2 ring-[var(--accent)]'
                : ''
        }`}
      >
        {/* Controls Column (Chevron + Bullet + Checkbox) */}
        <div className="flex items-center space-x-0.5 pt-0.5 mr-1.5 select-none shrink-0">
          <Chevron
            expanded={!isCollapsed}
            hasChildren={children.length > 0}
            onClick={() => store.toggleCollapse(node.id)}
          />

          <Bullet
            hasChildren={children.length > 0}
            isCollapsed={isCollapsed}
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-hecate-node', node.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) {
                store.openNode(node.id, true);
              } else if (onZoomNode) {
                onZoomNode(node.id);
              } else {
                store.openNode(node.id);
              }
            }}
          />

          {showCheckbox && (
            <Checkbox
              checked={isDone}
              onChange={() => store.toggleDone(node.id)}
            />
          )}
        </div>

        {/* Content Body: 16px / 26px for root, 15px / 24px for child notes */}
        <div className="flex-1 min-w-0 relative">
          {isFocused ? (
            <div className="tiptap-editor text-[var(--text-primary)] relative">
              <EditorContent editor={editor} />

              {/* Inline Supertag Autocomplete Dropdown */}
              {hashState.active && (
                <div
                  className="absolute z-50 left-0 top-full mt-1 w-64 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] font-sans text-[var(--text-primary)] select-none animate-in fade-in zoom-in-95 duration-100"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div className="px-2 py-1 text-[10px] font-mono text-[var(--text-faint)] uppercase tracking-wider border-b border-[var(--border-subtle)] mb-1 flex items-center justify-between">
                    <span>Supertags</span>
                    {currentPrefix && <span className="text-[var(--accent)]">#{currentPrefix}</span>}
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {currentFilteredTags.map((t, idx) => {
                      const isSelected = idx === activeTagIndex;
                      const meta = (t.meta as any) || {};
                      const color = meta.color || 'var(--accent)';
                      const fieldCount = meta.fieldDefs?.length || 0;

                      return (
                        <div
                          key={t.id}
                          onMouseEnter={() => setActiveTagIndex(idx)}
                          onClick={(e) => {
                            e.stopPropagation();
                            applySelectedTag(t.id);
                          }}
                          className={`px-2.5 py-1.5 rounded-[6px] cursor-pointer flex items-center justify-between text-[13px] transition-colors ${
                            isSelected
                              ? 'bg-[var(--bg-active)] text-[var(--text-primary)] ring-1 ring-[var(--accent)]/40'
                              : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: color }} />
                            <span className="font-medium">#{t.content}</span>
                          </div>
                          {fieldCount > 0 && (
                            <span className="text-[11px] font-mono text-[var(--text-faint)]">
                              {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {canCreateCurrent && (
                      <div
                        onMouseEnter={() => setActiveTagIndex(currentFilteredTags.length)}
                        onClick={(e) => {
                          e.stopPropagation();
                          createAndApplyTag(currentPrefix);
                        }}
                        className={`px-2.5 py-1.5 rounded-[6px] cursor-pointer flex items-center space-x-2 text-[13px] text-[var(--accent)] transition-colors ${
                          activeTagIndex === currentFilteredTags.length
                            ? 'bg-[var(--bg-active)] ring-1 ring-[var(--accent)]/40'
                            : 'hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create #{currentPrefix}</span>
                      </div>
                    )}

                    {currentFilteredTags.length === 0 && !canCreateCurrent && (
                      <div className="px-2.5 py-2 text-[12px] text-[var(--text-faint)] text-center">
                        No supertags found
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inline Reference [[ Autocomplete Dropdown */}
              {bracketState.active && (
                <div
                  className="absolute z-50 left-0 top-full mt-1 w-72 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] font-sans text-[var(--text-primary)] select-none animate-in fade-in zoom-in-95 duration-100"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div className="px-2 py-1 text-[10px] font-mono text-[var(--text-faint)] uppercase tracking-wider border-b border-[var(--border-subtle)] mb-1 flex items-center justify-between">
                    <span>Link Note</span>
                    {bracketState.query.trim() && (
                      <span className="text-[var(--accent)]">[[{bracketState.query.trim()}]]</span>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {refResults.map((r, idx) => {
                      const isSelected = idx === activeRefIndex;
                      return (
                        <div
                          key={r.id}
                          onMouseEnter={() => setActiveRefIndex(idx)}
                          onClick={(e) => {
                            e.stopPropagation();
                            applySelectedRef(r.id);
                          }}
                          className={`px-2.5 py-1.5 rounded-[6px] cursor-pointer flex items-center justify-between text-[13px] transition-colors ${
                            isSelected
                              ? 'bg-[var(--bg-active)] text-[var(--text-primary)] ring-1 ring-[var(--accent)]/40'
                              : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <span className="font-medium truncate mr-2">{r.title}</span>
                          {r.tags && r.tags.length > 0 && (
                            <div className="flex items-center space-x-1 shrink-0">
                              {r.tags.slice(0, 2).map((t) => (
                                <span
                                  key={t}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-active)] text-[var(--accent)] border border-[var(--border-strong)]"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {Boolean(
                      bracketState.query.trim() &&
                        !refResults.some(
                          (r) => r.title.toLowerCase() === bracketState.query.trim().toLowerCase()
                        )
                    ) && (
                      <div
                        onMouseEnter={() => setActiveRefIndex(refResults.length)}
                        onClick={(e) => {
                          e.stopPropagation();
                          createAndApplyRef(bracketState.query.trim());
                        }}
                        className={`px-2.5 py-1.5 rounded-[6px] cursor-pointer flex items-center space-x-2 text-[13px] text-[var(--accent)] transition-colors ${
                          activeRefIndex === refResults.length
                            ? 'bg-[var(--bg-active)] ring-1 ring-[var(--accent)]/40'
                            : 'hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create note &quot;{bracketState.query.trim()}&quot;</span>
                      </div>
                    )}

                    {refResults.length === 0 &&
                      !Boolean(
                        bracketState.query.trim() &&
                          !refResults.some(
                            (r) => r.title.toLowerCase() === bracketState.query.trim().toLowerCase()
                          )
                      ) && (
                        <div className="px-2.5 py-2 text-[12px] text-[var(--text-faint)] text-center">
                          No matching notes found
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={handleStaticClick}
              className={`cursor-text break-words transition-opacity duration-240 ${
                depth === 0 ? 'text-[16px] leading-[26px]' : 'text-[15px] leading-[24px]'
              } ${
                isDone
                  ? 'line-through text-[var(--text-muted)] opacity-50'
                  : depth === 0
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {renderFormattedContent(node.content)}
            </div>
          )}

          {/* Supertag Chips */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tags.map((t) => (
                <TagChip
                  key={t.id}
                  id={t.id}
                  name={t.content}
                  color={(t.meta as any)?.color}
                  onOpenDefinition={(tid) => (onEditSupertag ? onEditSupertag(tid) : store.openNode(tid))}
                  onViewInstances={(tid) => store.openNode(tid)}
                  onRemove={(tid) => store.removeTag(node.id, tid)}
                />
              ))}
            </div>
          )}

          {/* Field Pills + Add Field Button (collapsed: pinned fields only, REQ-4.3) */}
          {(fields.length > 0 || tags.length > 0) && (
            <div className="flex flex-wrap items-center mt-1.5">
              {fields
                .filter(({ fieldNode }) => !isCollapsed || fieldNode.meta?.pinned)
                .map(({ fieldNode, valueNode, name, type, options, required, targetTag, min, max }) => (
                <FieldRow
                  key={fieldNode.id}
                  name={name}
                  type={type}
                  options={options}
                  value={valueNode.content}
                  required={required}
                  min={min}
                  max={max}
                  onChange={(newVal) => store.updateNodeContent(valueNode.id, newVal)}
                  onSearchNodes={async (q) => {
                    if (!store.db) return [];
                    let nodes = await store.db.search.globalSearch(q);
                    if (targetTag) {
                      const allowed = new Set(
                        (await store.db.tags.getNodesWithTag(targetTag)).map((n) => n.id)
                      );
                      nodes = nodes.filter((n) => allowed.has(n.id));
                    }
                    return Promise.all(
                      nodes
                        .filter((n) => n.id !== node.id)
                        .slice(0, 20)
                        .map(async (n) => {
                          const nodeTags = await store.db!.tags.getTagsForNode(n.id);
                          return {
                            id: n.id,
                            title: n.content || 'Untitled Node',
                            tags: nodeTags.map((t) => t.content),
                          };
                        })
                    );
                  }}
                  onCreateNode={async (title) => {
                    const created = await store.createNode({ content: title });
                    if (targetTag) {
                      await store.applyTag(created.id, targetTag);
                    }
                    return { id: created.id, title: created.content };
                  }}
                  onOpenNode={(targetId, openInSidePanel) => {
                    store.openNode(targetId, openInSidePanel);
                  }}
                  resolveNodeTitle={async (targetId) => {
                    if (!store.db) return null;
                    const n = await store.db.nodes.getById(targetId);
                    return n ? n.content || 'Untitled Node' : null;
                  }}
                />
              ))}

              <button
                type="button"
                onClick={() => onOpenFieldPicker?.(node.id)}
                className="h-6 px-2 inline-flex items-center space-x-1 border border-dashed border-[var(--border-subtle)] hover:border-[var(--text-muted)] rounded-[6px] text-[11px] text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors cursor-pointer bg-transparent my-0.5"
                title="Add field to this node (>)"
              >
                <span>+ Field</span>
              </button>
            </div>
          )}
        </div>

        {/* Collapsed Count indicator */}
        {isCollapsed && children.length > 0 && (
          <span className="text-[11px] font-mono text-[var(--text-faint)] ml-2 shrink-0 self-center">
            {children.length} hidden
          </span>
        )}

        {/* Hover Toolbar */}
        <div className="opacity-0 group-hover/node:opacity-100 flex items-center space-x-1 pl-2 pr-1 pt-0.5 transition-opacity duration-120 shrink-0">
          <button
            type="button"
            onClick={() => store.createChildNode(node.id).then((c) => onFocusNode(c.id))}
            aria-label="Add child node"
            title="Add child node"
            className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => {
              onFocusNode(node.id);
              if (editor) {
                editor.commands.focus('end');
                editor.commands.insertContent(' #');
              } else {
                onOpenTagPicker?.(node.id);
              }
            }}
            aria-label="Add supertag"
            title="Add tag (#)"
            className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onOpenFieldPicker?.(node.id)}
            aria-label="Add field"
            title="Add field (>)"
            className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--green)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" strokeWidth={2} />
          </button>

          {/* Run command menu (REQ-6.2) */}
          <div ref={commandMenuRef} className="relative">
            <button
              type="button"
              onClick={async () => {
                const next = !commandMenuOpen;
                setCommandMenuOpen(next);
                if (next && store.db) {
                  const rows = await store.db.adapter.query<any>(
                    'SELECT * FROM command ORDER BY name ASC'
                  );
                  setCustomCommands(
                    rows.map((r) => ({
                      ...r,
                      steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps,
                    }))
                  );
                }
              }}
              aria-label="Run command"
              title="Run command"
              className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" strokeWidth={2} />
            </button>

            {commandMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-56 max-h-72 overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1 text-[10px] font-mono text-[var(--text-faint)] uppercase tracking-wider border-b border-[var(--border-subtle)] mb-1">
                  Commands
                </div>
                {BUILTIN_COMMANDS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCommandMenuOpen(false);
                      store.runBuiltinCommand(node.id, c.id);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {c.name}
                  </button>
                ))}
                {customCommands
                  .filter((cc) => !cc.scope || tags.some((t) => t.id === cc.scope))
                  .map((cc) => (
                    <button
                      key={cc.id}
                      type="button"
                      onClick={() => {
                        setCommandMenuOpen(false);
                        store.runCustomCommand(node.id, cc);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-[12px] text-[var(--accent)] hover:bg-[var(--bg-hover)] cursor-pointer"
                    >
                      {cc.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => store.requestDeleteNode(node.id)}
            aria-label="Delete node"
            title="Delete node"
            className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Children Subtree */}
      {!isCollapsed && children.length > 0 && (
        <div className="relative pl-6 mt-0.5 border-l border-[var(--border-subtle)] ml-4">
          {children.map((child) => (
            <OutlinerNode
              key={child.id}
              node={child}
              depth={depth + 1}
              focusedNodeId={focusedNodeId}
              onFocusNode={onFocusNode}
              onZoomNode={onZoomNode}
              onOpenNodePicker={onOpenNodePicker}
              onOpenTagPicker={onOpenTagPicker}
              onOpenFieldPicker={onOpenFieldPicker}
              onEditSupertag={onEditSupertag}
            />
          ))}
        </div>
      )}
    </div>
  );
};
