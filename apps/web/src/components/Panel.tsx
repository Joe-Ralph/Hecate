import React, { useState, useEffect } from 'react';
import {
  List,
  Table as TableIcon,
  Kanban,
  Calendar,
  X,
  ChevronRight,
  Link2,
  Plus,
} from 'lucide-react';
import { NodeRecord } from '@hecate/core';
import { TableView, CardsView, CalendarView } from '@hecate/ui';
import { OutlinerNode } from './OutlinerNode';
import { useWorkspaceStore, PanelState } from '../store/workspaceStore';

export interface PanelProps {
  panel: PanelState;
  panelIndex: number;
  totalPanels: number;
  onOpenNodePicker?: (nodeId: string) => void;
  onOpenTagPicker?: (nodeId: string) => void;
}

export const Panel: React.FC<PanelProps> = ({
  panel,
  panelIndex,
  totalPanels,
  onOpenNodePicker,
  onOpenTagPicker,
}) => {
  const store = useWorkspaceStore();
  const [rootNode, setRootNode] = useState<NodeRecord | null>(null);
  const [children, setChildren] = useState<NodeRecord[]>([]);
  const [backlinks, setBacklinks] = useState<NodeRecord[]>([]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // Load root node, children, and backlinks
  useEffect(() => {
    if (!store.db) return;
    let cancelled = false;

    async function load() {
      if (!store.db) return;
      const node = await store.db.nodes.getById(panel.nodeId);
      const childNodes = await store.db.nodes.getChildren(panel.nodeId);
      const links = await store.db.refs.getBacklinks(panel.nodeId);

      if (!cancelled) {
        setRootNode(node);
        setChildren(childNodes);
        setBacklinks(links);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [panel.nodeId, store.version, store.db]);

  const viewIcons = [
    { id: 'list', icon: List, label: 'List' },
    { id: 'table', icon: TableIcon, label: 'Table' },
    { id: 'cards', icon: Kanban, label: 'Cards' },
    { id: 'calendar', icon: Calendar, label: 'Calendar' },
  ] as const;

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col bg-[#0a0a0a] border-r border-[#222222] last:border-r-0 font-sans overflow-hidden">
      {/* Panel Top Navigation Bar */}
      <div className="h-10 px-4 border-b border-[#222222] bg-[#0c0c0c] flex items-center justify-between select-none shrink-0">
        {/* Breadcrumb Trail */}
        <div className="flex items-center space-x-1.5 text-[12px] truncate">
          <span className="text-[#555555] font-mono text-[11px] uppercase tracking-[1px]">
            {rootNode?.kind || 'NODE'}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#3a3a3a]" strokeWidth={2} />
          <span className="font-medium text-[#ffffff] truncate">
            {rootNode?.content || 'Untitled Node'}
          </span>
        </div>

        {/* View Switcher & Panel Controls */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-[#111111] border border-[#222222] p-0.5">
            {viewIcons.map((v) => {
              const Icon = v.icon;
              const isActive = panel.view === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => store.setPanelView(panelIndex, v.id)}
                  className={`p-1 cursor-pointer transition-colors duration-100 ${
                    isActive
                      ? 'bg-[#ffffff] text-[#000000]'
                      : 'text-[#888888] hover:text-[#ffffff]'
                  }`}
                  title={`${v.label} view`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              );
            })}
          </div>

          {totalPanels > 1 && (
            <button
              type="button"
              onClick={() => store.closePanel(panelIndex)}
              className="p-1 text-[#555555] hover:text-[#ffffff] hover:bg-[#161616] cursor-pointer"
              title="Close panel"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Page Title */}
        <div className="mb-6">
          <h2 className="text-2xl font-medium text-[#ffffff] leading-tight mb-1">
            {rootNode?.content || 'Untitled Node'}
          </h2>
        </div>

        {/* View Renderer */}
        {panel.view === 'list' && (
          <div className="space-y-0.5">
            {children.map((child) => (
              <OutlinerNode
                key={child.id}
                node={child}
                focusedNodeId={focusedNodeId}
                onFocusNode={setFocusedNodeId}
                onOpenNodePicker={onOpenNodePicker}
                onOpenTagPicker={onOpenTagPicker}
              />
            ))}

            {/* Empty prompt to add child */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() =>
                  store
                    .createChildNode(panel.nodeId)
                    .then((created) => setFocusedNodeId(created.id))
                }
                className="inline-flex items-center space-x-1.5 text-[12px] text-[#555555] hover:text-[#ffffff] py-1 cursor-pointer font-mono uppercase tracking-[1px]"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Add child node</span>
              </button>
            </div>
          </div>
        )}

        {panel.view === 'table' && (
          <TableView
            nodes={children}
            columns={[
              { id: 'created_at', name: 'Created' },
              { id: 'updated_at', name: 'Updated' },
            ]}
            onNodeClick={(id) => store.openNode(id)}
          />
        )}

        {panel.view === 'cards' && (
          <CardsView
            columns={[
              { id: 'todo', title: 'To Do', color: '#888888' },
              { id: 'doing', title: 'In Progress', color: '#3b82f6' },
              { id: 'done', title: 'Done', color: '#22c55e' },
            ]}
            nodes={children}
            getNodeColumnId={(n) => (n.done_at ? 'done' : 'todo')}
            onMoveNode={(nodeId, colId) => {
              store.toggleDone(nodeId);
            }}
            onNodeClick={(id) => store.openNode(id)}
            onAddCard={() => store.createChildNode(panel.nodeId)}
          />
        )}

        {panel.view === 'calendar' && (
          <CalendarView
            nodes={children}
            getNodeDate={(n) => {
              const match = n.content.match(/\[\[date:(\d{4}-\d{2}-\d{2})\]\]/);
              return match ? match[1] : null;
            }}
            onNodeClick={(id) => store.openNode(id)}
          />
        )}

        {/* Backlinks / References Section (REQ-1.5) */}
        {backlinks.length > 0 && (
          <div className="mt-12 pt-6 border-t border-[#222222]">
            <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-[2px] text-[#555555] mb-3">
              <Link2 className="w-3.5 h-3.5 text-[#888888]" strokeWidth={2} />
              <span>REFERENCES TO THIS NODE ({backlinks.length})</span>
            </div>

            <div className="space-y-1">
              {backlinks.map((bl) => (
                <div
                  key={bl.id}
                  onClick={() => store.openNode(bl.id)}
                  className="p-2.5 bg-[#111111] border border-[#222222] hover:border-[#444444] cursor-pointer flex items-center justify-between text-[13px] transition-colors duration-100"
                >
                  <span className="font-medium text-[#ffffff] truncate">
                    {bl.content || 'Untitled'}
                  </span>
                  <span className="text-[10px] font-mono text-[#555555] uppercase">
                    {bl.kind}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
