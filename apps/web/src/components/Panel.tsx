import React, { useState, useEffect } from 'react';
import {
  List,
  Table as TableIcon,
  Kanban,
  Calendar,
  X,
  ChevronRight,
  Pin,
  MoreHorizontal,
  Plus,
  Tag,
  Move,
  Copy,
  Trash2,
} from 'lucide-react';
import { NodeRecord, formatDate, FieldOption } from '@hecate/core';
import { TableView, CardsView, CalendarView, CaptureBar, TableColumn } from '@hecate/ui';
import { OutlinerNode } from './OutlinerNode';
import { QueryBuilder } from './QueryBuilder';
import { useWorkspaceStore, PanelState } from '../store/workspaceStore';

export interface PanelProps {
  panel: PanelState;
  panelIndex: number;
  totalPanels: number;
  onOpenNodePicker?: (nodeId: string) => void;
  onOpenTagPicker?: (nodeId: string) => void;
  onOpenFieldPicker?: (nodeId: string) => void;
  onEditSupertag?: (tagDefId: string) => void;
  onClosePanel?: (panelIndex: number) => void;
  onOpenMovePicker?: () => void;
}

export const Panel: React.FC<PanelProps> = ({
  panel,
  panelIndex,
  totalPanels,
  onOpenNodePicker,
  onOpenTagPicker,
  onOpenFieldPicker,
  onEditSupertag,
  onClosePanel,
  onOpenMovePicker,
}) => {
  const store = useWorkspaceStore();
  const [rootNode, setRootNode] = useState<NodeRecord | null>(null);
  const [children, setChildren] = useState<NodeRecord[]>([]);
  const [backlinks, setBacklinks] = useState<NodeRecord[]>([]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<Array<{ id: string; content: string }>>([]);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const isSearchPanel = rootNode?.kind === 'search';

  // Field metadata for Table/Cards/Calendar views (REQ-5.3)
  const [fieldColumns, setFieldColumns] = useState<TableColumn[]>([]);
  const [cellValues, setCellValues] = useState<Record<string, Record<string, string>>>({});
  const [groupFieldDef, setGroupFieldDef] = useState<{
    id: string;
    options: FieldOption[];
  } | null>(null);
  const [dateFieldDefId, setDateFieldDefId] = useState<string | null>(null);
  const zoomPath = panel.zoomPath || [];
  const effectiveRootId =
    zoomPath.length > 0 ? zoomPath[zoomPath.length - 1] : panel.nodeId;
  const [availableTags, setAvailableTags] = useState<
    Array<{ id: string; name: string; color?: string; fieldCount?: number }>
  >([]);

  useEffect(() => {
    if (!store.db) return;
    store.db.tags.getAllTags().then((tags) => {
      setAvailableTags(
        tags.map((t) => ({
          id: t.id,
          name: t.content,
          color: (t.meta as any)?.color,
          fieldCount: (t.meta as any)?.fieldDefs?.length || 0,
        }))
      );
    });
  }, [store.db, store.version]);

  useEffect(() => {
    if (!store.db) return;
    let cancelled = false;

    async function load() {
      if (!store.db) return;
      const node = await store.db.nodes.getById(effectiveRootId);
      const isTagPanel = node?.kind === 'tagDef';
      const isSearch = node?.kind === 'search';

      let childNodes: NodeRecord[];
      if (isSearch) {
        // Live search: $thisNode resolves to the node this search lives on
        try {
          childNodes = await store.db.search.executeSearch(
            node?.meta?.query || { op: 'AND', clauses: [] },
            node?.parent_id ?? undefined
          );
          if (!cancelled) setSearchError(null);
        } catch (err: any) {
          childNodes = [];
          if (!cancelled) setSearchError(err?.message || String(err));
        }
      } else {
        childNodes = isTagPanel
          ? await store.db.tags.getNodesWithTag(effectiveRootId)
          : await store.db.nodes.getChildren(effectiveRootId);
      }
      const links = await store.db.refs.getBacklinks(effectiveRootId);

      const crumbNodes = await Promise.all(
        [panel.nodeId, ...zoomPath].map((id) => store.db!.nodes.getById(id))
      );

      if (!cancelled) {
        setRootNode(node);
        setChildren(childNodes);
        setBacklinks(links);
        setCrumbs(
          crumbNodes
            .filter((n): n is NodeRecord => Boolean(n))
            .map((n) => ({ id: n.id, content: n.content }))
        );
      }
    }

    // Debounce live-search re-evaluation on writes (100 ms per REQ-5.1)
    const timer = setTimeout(load, isSearchPanel ? 100 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [panel.nodeId, effectiveRootId, zoomPath.join('/'), store.version, store.db]);

  // Load field values for all visible children (drives Table/Cards/Calendar views)
  useEffect(() => {
    if (!store.db) return;
    let cancelled = false;

    async function loadFields() {
      if (!store.db) return;
      const cols = new Map<string, { name: string; type: string; options: FieldOption[] }>();
      const values: Record<string, Record<string, string>> = {};

      for (const child of children) {
        values[child.id] = {};
        const kids = await store.db.nodes.getChildren(child.id);
        for (const f of kids.filter((k) => k.kind === 'field')) {
          const defId = f.meta?.fieldDefId;
          if (!defId) continue;
          if (!cols.has(defId)) {
            const def = await store.db.nodes.getById(defId);
            cols.set(defId, {
              name: def?.content || 'Field',
              type: def?.meta?.type || 'text',
              options: def?.meta?.options || [],
            });
          }
          const vals = await store.db.nodes.getChildren(f.id);
          values[child.id][defId] = vals[0]?.content || '';
        }
      }

      if (!cancelled) {
        setFieldColumns(
          Array.from(cols.entries()).map(([id, c]) => ({ id, name: c.name, fieldDefId: id }))
        );
        setCellValues(values);
        const optionsField = Array.from(cols.entries()).find(([, c]) => c.type === 'options');
        setGroupFieldDef(optionsField ? { id: optionsField[0], options: optionsField[1].options } : null);
        const dateField = Array.from(cols.entries()).find(([, c]) => c.type === 'date');
        setDateFieldDefId(dateField ? dateField[0] : null);
      }
    }

    loadFields();
    return () => {
      cancelled = true;
    };
  }, [children.map((c) => c.id).join(','), store.version, store.db]);

  const tableCellValues = Object.fromEntries(
    children.map((c) => [
      c.id,
      {
        created_at: new Date(c.created_at).toLocaleDateString(),
        updated_at: new Date(c.updated_at).toLocaleDateString(),
        ...cellValues[c.id],
      },
    ])
  );

  const viewIcons = [
    { id: 'list', icon: List, label: 'List' },
    { id: 'table', icon: TableIcon, label: 'Table' },
    { id: 'cards', icon: Kanban, label: 'Cards' },
    { id: 'calendar', icon: Calendar, label: 'Calendar' },
  ] as const;

  const handleCapture = async (content: string) => {
    if (!store.db) return;

    const tagMatches = content.match(/#([a-zA-Z0-9_\-]+)/g);
    let cleanContent = content;
    const tagNames: string[] = [];
    if (tagMatches) {
      for (const m of tagMatches) {
        tagNames.push(m.slice(1));
        cleanContent = cleanContent.replace(m, '').trim();
      }
    }

    const isTagPanel = rootNode?.kind === 'tagDef';
    const created = await store.createNode({
      parent_id: isTagPanel ? null : effectiveRootId,
      content: cleanContent || content,
    });
    if (isTagPanel) {
      await store.applyTag(created.id, rootNode!.id);
    }

    for (const tName of tagNames) {
      let tagDef = await store.db.tags.getTagByName(tName);
      if (!tagDef) {
        tagDef = await store.db.tags.createTag(tName, {
          color: 'var(--accent)',
          showCheckbox: tName.toLowerCase() === 'task',
        });
      }
      if (tagDef) {
        await store.applyTag(created.id, tagDef.id);
      }
    }
  };

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col bg-[var(--bg-app)] border-r border-[var(--border-subtle)] last:border-r-0 font-sans overflow-hidden">
      {/* 56px Top Bar (Section 3.3) */}
      <div className="h-14 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-app)] flex items-center justify-between select-none shrink-0">
        {/* Breadcrumb Trail */}
        <div className="flex items-center space-x-2 text-[13px] truncate">
          <button
            type="button"
            onClick={() => store.jumpToToday()}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors shrink-0"
          >
            Home
          </button>
          {crumbs.map((c, idx) => (
            <React.Fragment key={c.id}>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-faint)] shrink-0" strokeWidth={2} />
              {idx === crumbs.length - 1 ? (
                <span className="font-medium text-[var(--text-primary)] truncate">
                  {c.content || 'Untitled Node'}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => store.zoomToDepth(panelIndex, idx)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors truncate"
                >
                  {c.content || 'Untitled Node'}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* View Switcher in --surface-2 track & Panel Controls */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-[var(--bg-track)] border border-[var(--border-subtle)] rounded-[8px] p-0.5">
            {viewIcons.map((v) => {
              const Icon = v.icon;
              const isActive = panel.view === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => store.setPanelView(panelIndex, v.id)}
                  aria-label={`${v.label} view`}
                  title={`${v.label} view`}
                  className={`px-2.5 py-1 rounded-[6px] flex items-center space-x-1.5 text-[12px] font-medium cursor-pointer transition-colors duration-120 ${
                    isActive
                      ? 'bg-[var(--bg-segment)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                  <span className="hidden md:inline">{v.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => rootNode && store.togglePinNode(rootNode.id)}
            aria-label="Pin node"
            title={rootNode?.meta?.pinned ? 'Unpin node' : 'Pin node'}
            className={`p-1.5 rounded-[6px] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors ${
              rootNode?.meta?.pinned ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Pin className="w-4 h-4" strokeWidth={2} />
          </button>

          {totalPanels > 1 && (
            <button
              type="button"
              onClick={() => store.closePanel(panelIndex)}
              aria-label="Close panel"
              title="Close panel"
              className="p-1.5 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: max-width 760px with 32px side padding */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-[760px] mx-auto space-y-6">
          {/* Page Title */}
          <div className="pb-4 border-b border-[var(--border-subtle)]">
            <h1 className="text-[34px] font-semibold leading-[40px] tracking-[-0.01em] text-[var(--text-primary)] flex items-center space-x-2.5">
              {rootNode?.kind === 'tagDef' ? (
                <>
                  <span
                    className="w-4 h-4 rounded-[4px] shrink-0"
                    style={{ backgroundColor: (rootNode.meta as any)?.color || 'var(--accent)' }}
                  />
                  <span>#{rootNode.content}</span>
                </>
              ) : (
                <span>{rootNode?.content || 'Untitled'}</span>
              )}
            </h1>
            <div className="text-[13px] text-[var(--text-muted)] mt-1.5 flex items-center space-x-3">
              <span>
                {rootNode?.kind === 'tagDef'
                  ? `${children.length} ${children.length === 1 ? 'node tagged' : 'nodes tagged'}`
                  : `${children.length} items`}
              </span>
              {backlinks.length > 0 && (
                <>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setShowBacklinks((v) => !v)}
                    className="text-[var(--accent)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                  >
                    {backlinks.length} references
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Live Search query editor */}
          {isSearchPanel && (
            <>
              <QueryBuilder
                query={rootNode?.meta?.query || { op: 'AND', clauses: [] }}
                onChange={(q) => rootNode && store.updateSearchQuery(rootNode.id, q)}
              />
              {searchError && (
                <div className="p-3 bg-[var(--bg-raised)] border border-[var(--red)] rounded-[8px] text-[12px] font-mono text-[var(--red)]">
                  {searchError}
                </div>
              )}
            </>
          )}

          {/* Views */}
          {panel.view === 'list' && (
            <div className="space-y-1">
              {children.map((child) => (
                <OutlinerNode
                  key={child.id}
                  node={child}
                  depth={0}
                  focusedNodeId={focusedNodeId}
                  onFocusNode={(id) => {
                    setFocusedNodeId(id);
                    store.setFocusedNode(id);
                  }}
                  onZoomNode={(id) => store.zoomInto(panelIndex, id)}
                  onOpenNodePicker={onOpenNodePicker}
                  onOpenTagPicker={onOpenTagPicker}
                  onOpenFieldPicker={onOpenFieldPicker}
                  onEditSupertag={onEditSupertag}
                />
              ))}

              {children.length === 0 && !isSearchPanel && (
                <div className="py-8 text-center text-[var(--text-muted)] text-[14px]">
                  No children yet. Capture a note below or press <kbd className="font-mono text-[12px] bg-[var(--bg-raised)] px-1.5 py-0.5 rounded-[4px] border border-[var(--border-subtle)]">C</kbd>.
                </div>
              )}

              {children.length === 0 && isSearchPanel && !searchError && (
                <div className="py-8 text-center text-[var(--text-muted)] text-[14px]">
                  No results. Add clauses above to build your live search.
                </div>
              )}

              {/* Docked Capture Bar */}
              {!isSearchPanel && (
                <div className="pt-4">
                  <CaptureBar
                    onCapture={handleCapture}
                    availableTags={availableTags}
                    placeholder={`Add to ${rootNode?.content || 'this note'}…`}
                  />
                </div>
              )}
            </div>
          )}

          {panel.view === 'table' && (
            <TableView
              nodes={children}
              columns={[
                { id: 'created_at', name: 'Created' },
                { id: 'updated_at', name: 'Updated' },
                ...fieldColumns,
              ]}
              cellValues={tableCellValues}
              onNodeClick={(id) => store.openNode(id)}
              onCellEdit={(nodeId, colId, val) => {
                if (colId === 'created_at' || colId === 'updated_at') return;
                store.setFieldValue(nodeId, colId, val);
              }}
            />
          )}
          {panel.view === 'cards' && (
            <CardsView
              columns={
                groupFieldDef
                  ? [
                      ...groupFieldDef.options.map((o) => ({
                        id: o.label,
                        title: o.label,
                        color: o.color,
                      })),
                      { id: '__none', title: 'No status', color: 'var(--text-muted)' },
                    ]
                  : [
                      { id: 'todo', title: 'To Do', color: 'var(--text-muted)' },
                      { id: 'doing', title: 'In Progress', color: '#3b82f6' },
                      { id: 'done', title: 'Done', color: 'var(--green)' },
                    ]
              }
              nodes={children}
              getNodeColumnId={(n) =>
                groupFieldDef
                  ? cellValues[n.id]?.[groupFieldDef.id] || '__none'
                  : n.done_at
                    ? 'done'
                    : 'todo'
              }
              onMoveNode={(nodeId, colId) =>
                groupFieldDef
                  ? store.setFieldValue(nodeId, groupFieldDef.id, colId === '__none' ? '' : colId)
                  : store.toggleDone(nodeId)
              }
              onNodeClick={(id) => store.openNode(id)}
              onAddCard={() => store.createChildNode(effectiveRootId)}
            />
          )}
          {panel.view === 'calendar' && (
            <CalendarView
              nodes={children}
              getNodeDate={(n) => {
                const fieldVal = dateFieldDefId ? cellValues[n.id]?.[dateFieldDefId] : null;
                const m = (fieldVal || n.content).match(
                  /\[\[date:(\d{4}-\d{2}-\d{2})\]\]|(\d{4}-\d{2}-\d{2})/
                );
                return m ? m[1] || m[2] : null;
              }}
              onNodeClick={(id) => store.openNode(id)}
              onNodeReschedule={async (nodeId, dateIso) => {
                if (dateFieldDefId) {
                  await store.setFieldValue(nodeId, dateFieldDefId, `[[date:${dateIso}]]`);
                } else {
                  const n = await store.db?.nodes.getById(nodeId);
                  if (!n) return;
                  const hasDate = /\[\[date:\d{4}-\d{2}-\d{2}\]\]/.test(n.content);
                  const updated = hasDate
                    ? n.content.replace(/\[\[date:\d{4}-\d{2}-\d{2}\]\]/, `[[date:${dateIso}]]`)
                    : `${n.content} [[date:${dateIso}]]`.trim();
                  await store.updateNodeContent(nodeId, updated);
                }
              }}
            />
          )}

          {/* References (backlinks) — editable in place */}
          {showBacklinks && backlinks.length > 0 && (
            <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Referenced by
              </div>
              <div className="space-y-1">
                {backlinks.map((source) => (
                  <OutlinerNode
                    key={source.id}
                    node={source}
                    depth={0}
                    focusedNodeId={focusedNodeId}
                    onFocusNode={(id) => {
                    setFocusedNodeId(id);
                    store.setFocusedNode(id);
                  }}
                    onZoomNode={(id) => store.openNode(id)}
                    onOpenNodePicker={onOpenNodePicker}
                    onOpenTagPicker={onOpenTagPicker}
                    onOpenFieldPicker={onOpenFieldPicker}
                    onEditSupertag={onEditSupertag}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Bulk action bar for multi-selection (REQ-1.7) */}
      {store.selectedNodeIds.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5 flex items-center space-x-2 shrink-0 flex-wrap gap-y-2 select-none">
          <span className="text-[12px] font-mono text-[var(--accent)] mr-1">
            {store.selectedNodeIds.length} selected
          </span>
          {[
            {
              label: 'Tag',
              icon: Tag,
              onClick: () => onOpenTagPicker?.(store.selectedNodeIds[0]),
            },
            { label: 'Move', icon: Move, onClick: () => onOpenMovePicker?.() },
            {
              label: 'Set date today',
              icon: Calendar,
              onClick: async () => {
                const due = await store.db?.tags.createFieldDef('Due', { type: 'date' });
                if (due) {
                  for (const id of store.selectedNodeIds) {
                    await store.setFieldValue(id, due.id, `[[date:${formatDate(new Date())}]]`);
                  }
                }
                store.clearSelection();
              },
            },
            {
              label: 'Copy as Tana Paste',
              icon: Copy,
              onClick: () => store.copyNodesAsTanaPaste(store.selectedNodeIds),
            },
            {
              label: 'Delete',
              icon: Trash2,
              onClick: async () => {
                for (const id of store.selectedNodeIds) {
                  await store.requestDeleteNode(id);
                }
                store.clearSelection();
              },
            },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="h-7 px-2.5 flex items-center space-x-1.5 bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--accent)] rounded-[6px] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
            >
              <action.icon className="w-3.5 h-3.5" />
              <span>{action.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => store.clearSelection()}
            className="ml-auto p-1 rounded-[4px] text-[var(--text-faint)] hover:text-[var(--text-primary)] cursor-pointer"
            aria-label="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
