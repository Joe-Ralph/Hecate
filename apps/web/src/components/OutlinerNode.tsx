/**
 * OutlinerNode Component
 * One TipTap editor per focused node; static HTML when unfocused for 60fps performance.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { NodeRecord, parseTanaPaste, isTanaPaste } from '@hecate/core';
import { Bullet, Chevron, Checkbox, TagChip, ReferenceChip, FieldRow } from '@hecate/ui';
import { useWorkspaceStore } from '../store/workspaceStore';
import { Plus, Tag, MoreHorizontal, CornerDownRight } from 'lucide-react';

export interface OutlinerNodeProps {
  node: NodeRecord;
  depth?: number;
  focusedNodeId: string | null;
  onFocusNode: (id: string | null) => void;
  onOpenNodePicker?: (nodeId: string) => void;
  onOpenTagPicker?: (nodeId: string) => void;
}

export const OutlinerNode: React.FC<OutlinerNodeProps> = ({
  node,
  depth = 0,
  focusedNodeId,
  onFocusNode,
  onOpenNodePicker,
  onOpenTagPicker,
}) => {
  const isFocused = focusedNodeId === node.id;
  const store = useWorkspaceStore();

  const [children, setChildren] = useState<NodeRecord[]>([]);
  const [tags, setTags] = useState<NodeRecord[]>([]);
  const [fields, setFields] = useState<Array<{ fieldNode: NodeRecord; valueNode: NodeRecord; name: string }>>([]);
  const [hasLoadedChildren, setHasLoadedChildren] = useState(false);

  // Load children, tags, and fields when version or node changes
  useEffect(() => {
    if (!store.db) return;
    let isCancelled = false;

    async function loadData() {
      if (!store.db) return;
      const childNodes = await store.db.nodes.getChildren(node.id);
      const tagNodes = await store.db.tags.getTagsForNode(node.id);

      // Separate fields from content children
      const contentChildren: NodeRecord[] = [];
      const fieldList: Array<{ fieldNode: NodeRecord; valueNode: NodeRecord; name: string }> = [];

      for (const c of childNodes) {
        if (c.kind === 'field') {
          const valNodes = await store.db.nodes.getChildren(c.id);
          const val = valNodes[0] || { content: '' };
          // Look up fieldDef name
          const fieldDefId = c.meta?.fieldDefId;
          let fieldName = 'Field';
          if (fieldDefId) {
            const fdef = await store.db.nodes.getById(fieldDefId);
            if (fdef) fieldName = fdef.content;
          }
          fieldList.push({ fieldNode: c, valueNode: val as NodeRecord, name: fieldName });
        } else {
          contentChildren.push(c);
        }
      }

      if (!isCancelled) {
        setChildren(contentChildren);
        setTags(tagNodes);
        setFields(fieldList);
        setHasLoadedChildren(true);
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [node.id, store.version, store.db]);

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
    },
    editorProps: {
      handleKeyDown: (_view, event) => {
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
          store.deleteNode(node.id);
          onFocusNode(null);
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
        if (event.key === '[' && editor?.getText().endsWith('[')) {
          onOpenNodePicker?.(node.id);
        }
        if (event.key === '#') {
          onOpenTagPicker?.(node.id);
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const pasteText = event.clipboardData?.getData('text/plain');
        if (pasteText && isTanaPaste(pasteText)) {
          event.preventDefault();
          const parsed = parseTanaPaste(pasteText);
          async function insertParsed(nodes: any[], parentId: string) {
            for (const p of nodes) {
              const created = await store.createChildNode(parentId, p.content);
              if (p.isDone !== undefined) {
                await store.db?.nodes.updateDone(created.id, p.isDone);
              }
              for (const tag of p.tags) {
                const tagDef = await store.db?.tags.getTagByName(tag);
                if (tagDef) await store.applyTag(created.id, tagDef.id);
              }
              if (p.children && p.children.length > 0) {
                await insertParsed(p.children, created.id);
              }
            }
          }
          insertParsed(parsed, node.id);
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
      return <span className="text-[#555555] italic text-[13px]">Empty node</span>;
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
            title={targetId}
            onClick={(id, side) => store.openNode(id, side)}
          />
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const isCollapsed = Boolean(node.collapsed);
  const isDone = Boolean(node.done_at);

  return (
    <div className="relative font-sans text-[14px] leading-normal select-text group/node">
      {/* Node Row */}
      <div
        className={`flex items-start py-0.5 px-1 -mx-1 hover:bg-[#111111]/60 transition-colors duration-100 ${
          isFocused ? 'bg-[#111111] ring-1 ring-[#333333]' : ''
        }`}
      >
        {/* Controls Column (Chevron + Bullet + Checkbox) */}
        <div className="flex items-center space-x-1 pt-1 mr-1 select-none shrink-0">
          <Chevron
            expanded={!isCollapsed}
            hasChildren={children.length > 0}
            onClick={() => store.toggleCollapse(node.id)}
          />

          <Bullet
            hasChildren={children.length > 0}
            onClick={() => store.openNode(node.id)}
          />

          {/* Optional Checkbox */}
          {(node.kind === 'day' || tags.some((t) => (t.meta as any)?.showCheckbox) || isDone) && (
            <Checkbox
              checked={isDone}
              onChange={() => store.toggleDone(node.id)}
            />
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 pt-0.5">
          {isFocused ? (
            <div className="tiptap-editor text-[#ffffff]">
              <EditorContent editor={editor} />
            </div>
          ) : (
            <div
              onClick={handleStaticClick}
              className={`cursor-text min-h-[22px] break-words ${
                isDone ? 'line-through text-[#888888] opacity-60' : 'text-[#ffffff]'
              }`}
            >
              {renderFormattedContent(node.content)}
            </div>
          )}

          {/* Tag Chips Strip */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tags.map((t) => (
                <TagChip
                  key={t.id}
                  id={t.id}
                  name={t.content}
                  color={(t.meta as any)?.color}
                  onOpenDefinition={(tid) => store.openNode(tid)}
                  onRemove={(tid) => store.removeTag(node.id, tid)}
                />
              ))}
            </div>
          )}

          {/* Attached Field Rows */}
          {fields.length > 0 && (
            <div className="mt-1 space-y-0.5 pl-1 border-l border-[#222222]">
              {fields.map(({ fieldNode, valueNode, name }) => (
                <FieldRow
                  key={fieldNode.id}
                  name={name}
                  value={valueNode.content}
                  onChange={(newVal) => store.updateNodeContent(valueNode.id, newVal)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Hover Toolbar */}
        <div className="opacity-0 group-hover/node:opacity-100 flex items-center space-x-1 pl-2 pr-1 pt-0.5 transition-opacity duration-150 shrink-0">
          <button
            type="button"
            onClick={() => store.createChildNode(node.id).then((c) => onFocusNode(c.id))}
            className="p-1 text-[#555555] hover:text-[#ffffff] hover:bg-[#161616] cursor-pointer"
            title="Add child node"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onOpenTagPicker?.(node.id)}
            className="p-1 text-[#555555] hover:text-[#ffffff] hover:bg-[#161616] cursor-pointer"
            title="Add tag"
          >
            <Tag className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => store.deleteNode(node.id)}
            className="p-1 text-[#555555] hover:text-[#cc3333] hover:bg-[#161616] cursor-pointer"
            title="Delete node"
          >
            <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Children Subtree */}
      {!isCollapsed && children.length > 0 && (
        <div className="relative pl-6 mt-0.5 border-l border-[#222222] ml-2.5">
          {children.map((child) => (
            <OutlinerNode
              key={child.id}
              node={child}
              depth={depth + 1}
              focusedNodeId={focusedNodeId}
              onFocusNode={onFocusNode}
              onOpenNodePicker={onOpenNodePicker}
              onOpenTagPicker={onOpenTagPicker}
            />
          ))}
        </div>
      )}
    </div>
  );
};
