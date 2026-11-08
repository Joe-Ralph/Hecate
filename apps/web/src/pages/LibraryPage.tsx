import React, { useState, useEffect } from 'react';
import {
  Tag,
  Database,
  Terminal,
  Plus,
  Edit3,
  ArrowLeft,
  ChevronRight,
  Search,
  ExternalLink,
} from 'lucide-react';
import { NodeRecord, TagDefMeta } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';
import { SupertagModal } from '../components/SupertagModal';
import { CommandModal } from '../components/CommandModal';
import { OutlinerNode } from '../components/OutlinerNode';

export interface LibraryPageProps {
  onOpenNodePicker?: (nodeId: string) => void;
  onOpenTagPicker?: (nodeId: string) => void;
  onOpenFieldPicker?: (nodeId: string) => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onOpenNodePicker,
  onOpenTagPicker,
  onOpenFieldPicker,
}) => {
  const store = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<'tags' | 'fields' | 'commands'>('tags');
  const [tags, setTags] = useState<NodeRecord[]>([]);
  const [fields, setFields] = useState<NodeRecord[]>([]);
  const [commands, setCommands] = useState<any[]>([]);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});

  // Drilldown to tag nodes view
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedTagNodes, setSelectedTagNodes] = useState<NodeRecord[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // Supertag Modal state
  const [editingTagId, setEditingTagId] = useState<string | null | undefined>(undefined);
  const [editingCommandId, setEditingCommandId] = useState<string | null | undefined>(undefined);

  // Load tags, fields, commands, and tag counts
  useEffect(() => {
    if (!store.db) return;
    async function load() {
      if (!store.db) return;
      const tagNodes = await store.db.tags.getAllTags();
      const fieldNodes = await store.db.adapter.query<any>(
        "SELECT * FROM node WHERE kind = 'fieldDef' AND deleted_at IS NULL ORDER BY content ASC"
      );
      const cmdList = await store.db.adapter.query<any>('SELECT * FROM command ORDER BY name ASC');

      const countRows = await store.db.adapter.query<any>(
        `SELECT nt.tag_def_id, COUNT(*) as count
         FROM node_tag nt
         JOIN node n ON n.id = nt.node_id
         WHERE n.deleted_at IS NULL
         GROUP BY nt.tag_def_id`
      );
      const counts: Record<string, number> = {};
      for (const r of countRows) {
        counts[r.tag_def_id] = r.count;
      }

      setTags(tagNodes);
      setFields(fieldNodes);
      setCommands(cmdList);
      setTagCounts(counts);
    }
    load();
  }, [store.version, store.db]);

  // Load nodes associated with selected tag
  useEffect(() => {
    if (!store.db || !selectedTagId) {
      setSelectedTagNodes([]);
      return;
    }
    async function loadTagNodes() {
      if (!store.db || !selectedTagId) return;
      const nodes = await store.db.tags.getNodesWithTag(selectedTagId);
      setSelectedTagNodes(nodes);
    }
    loadTagNodes();
  }, [selectedTagId, store.version, store.db]);

  const selectedTag = tags.find((t) => t.id === selectedTagId);
  const selectedTagMeta = (selectedTag?.meta as TagDefMeta) || {};

  const handleCreateTaggedNode = async () => {
    if (!store.db || !selectedTag) return;
    const created = await store.createNode({ content: '' });
    await store.applyTag(created.id, selectedTag.id);
    setFocusedNodeId(created.id);
  };

  // Filter tag nodes by search term
  const filteredTagNodes = selectedTagNodes.filter((node) => {
    if (!searchFilter.trim()) return true;
    return (node.content || '').toLowerCase().includes(searchFilter.trim().toLowerCase());
  });

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 font-sans text-[var(--text-primary)]">
      <div className="max-w-[760px] mx-auto space-y-6">
        {/* If a supertag is selected, show the Tag Nodes Drilldown View */}
        {selectedTag ? (
          <div className="space-y-6 animate-in fade-in duration-120">
            {/* Breadcrumb Back Button */}
            <div>
              <button
                type="button"
                onClick={() => {
                  setSelectedTagId(null);
                  setSearchFilter('');
                }}
                className="flex items-center space-x-1.5 text-[12px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Supertags</span>
              </button>

              <div className="pb-4 border-b border-[var(--border-subtle)] flex items-end justify-between">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1 font-medium">
                    Supertag Instances
                  </div>
                  <h1 className="text-[34px] font-semibold leading-[40px] tracking-[-0.01em] text-[var(--text-primary)] flex items-center space-x-3">
                    <span
                      className="w-4 h-4 rounded-[4px] shrink-0 inline-block"
                      style={{ backgroundColor: selectedTagMeta.color || 'var(--accent)' }}
                    />
                    <span>#{selectedTag.content}</span>
                  </h1>
                  <div className="text-[13px] text-[var(--text-muted)] mt-1.5 flex items-center space-x-2">
                    <span className="text-[var(--accent)] font-medium">
                      {selectedTagNodes.length} {selectedTagNodes.length === 1 ? 'node' : 'nodes'} associated
                    </span>
                    <span>•</span>
                    <span>{selectedTagMeta.fieldDefs?.length || 0} fields configured</span>
                    {selectedTagMeta.extends && selectedTagMeta.extends.length > 0 && (
                      <>
                        <span>•</span>
                        <span>Extends {selectedTagMeta.extends.join(', ')}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingTagId(selectedTag.id)}
                    className="h-9 px-3 flex items-center space-x-1.5 bg-[var(--bg-raised)] hover:bg-[var(--bg-active)] border border-[var(--border-strong)] hover:border-[var(--text-muted)] text-[var(--text-primary)] rounded-[8px] text-[13px] font-medium cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>Edit Schema</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => store.openNode(selectedTag.id)}
                    className="h-9 px-3 flex items-center space-x-1.5 bg-[var(--bg-raised)] hover:bg-[var(--bg-active)] border border-[var(--border-strong)] hover:border-[var(--accent)] text-[var(--accent)] rounded-[8px] text-[13px] font-medium cursor-pointer transition-colors"
                    title="Open as workspace panel"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Panel</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateTaggedNode}
                    className="h-9 px-3.5 flex items-center space-x-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-app)] rounded-[8px] text-[13px] font-medium cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                    <span>New #{selectedTag.content}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Filter Bar */}
            {selectedTagNodes.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={`Filter ${selectedTagNodes.length} #${selectedTag.content} nodes...`}
                  className="w-full h-8 pl-8 pr-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--accent)] rounded-[6px] text-[12px] text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none transition-colors"
                />
              </div>
            )}

            {/* List of Associated Nodes */}
            {selectedTagNodes.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-[var(--border-subtle)] rounded-[10px] space-y-3">
                <div className="w-10 h-10 rounded-full bg-[var(--bg-raised)] border border-[var(--border-strong)] flex items-center justify-center mx-auto text-[var(--accent)]">
                  <Tag className="w-5 h-5" />
                </div>
                <div className="text-[15px] font-medium text-[var(--text-primary)]">
                  No nodes tagged with #{selectedTag.content} yet
                </div>
                <div className="text-[13px] text-[var(--text-faint)] max-w-sm mx-auto">
                  Tag nodes in the outliner with #{selectedTag.content} or click the button below to create the first one.
                </div>
                <button
                  type="button"
                  onClick={handleCreateTaggedNode}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-app)] rounded-[6px] text-[12px] font-medium cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create #{selectedTag.content} node</span>
                </button>
              </div>
            ) : filteredTagNodes.length === 0 ? (
              <div className="p-8 text-center border border-[var(--border-subtle)] rounded-[10px] text-[var(--text-faint)] text-[13px]">
                No nodes matching &quot;{searchFilter}&quot;
              </div>
            ) : (
              <div className="space-y-1">
                {filteredTagNodes.map((node) => (
                  <OutlinerNode
                    key={node.id}
                    node={node}
                    depth={0}
                    focusedNodeId={focusedNodeId}
                    onFocusNode={(id) => setFocusedNodeId(id)}
                    onOpenNodePicker={onOpenNodePicker}
                    onOpenTagPicker={onOpenTagPicker}
                    onOpenFieldPicker={onOpenFieldPicker}
                    onEditSupertag={(tid) => setEditingTagId(tid)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Main Library Index */
          <>
            <div className="pb-4 border-b border-[var(--border-subtle)] flex items-end justify-between">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1 font-medium">
                  Workspace Schema & Definitions
                </div>
                <h1 className="text-[34px] font-semibold leading-[40px] tracking-[-0.01em] text-[var(--text-primary)]">
                  Library
                </h1>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => store.createSearchNode()}
                  className="h-9 px-3.5 flex items-center space-x-1.5 bg-[var(--bg-raised)] hover:bg-[var(--bg-active)] border border-[var(--border-strong)] hover:border-[var(--accent)] text-[var(--accent)] rounded-[8px] text-[13px] font-medium cursor-pointer transition-colors"
                >
                  <Search className="w-4 h-4" strokeWidth={2} />
                  <span>New Live Search</span>
                </button>

                {activeTab === 'commands' && (
                  <button
                    type="button"
                    onClick={() => setEditingCommandId(null)}
                    className="h-9 px-3.5 flex items-center space-x-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-app)] rounded-[8px] text-[13px] font-medium cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                    <span>New Command</span>
                  </button>
                )}

                {activeTab === 'tags' && (
                  <button
                    type="button"
                    onClick={() => setEditingTagId(null)}
                    className="h-9 px-3.5 flex items-center space-x-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-app)] rounded-[8px] text-[13px] font-medium cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                    <span>New Supertag</span>
                  </button>
                )}
              </div>
            </div>

            {/* Segmented Control Tabs */}
            <div className="flex items-center bg-[var(--bg-track)] border border-[var(--border-subtle)] rounded-[8px] p-0.5 w-fit">
              {[
                { id: 'tags', label: 'Supertags', icon: Tag, count: tags.length },
                { id: 'fields', label: 'Field Definitions', icon: Database, count: fields.length },
                { id: 'commands', label: 'Commands', icon: Terminal, count: commands.length },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-[6px] text-[13px] font-medium cursor-pointer transition-colors duration-120 ${
                      isActive
                        ? 'bg-[var(--bg-segment)] text-[var(--text-primary)] shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>{tab.label}</span>
                    <span className="font-mono text-[11px] text-[var(--text-faint)]">({tab.count})</span>
                  </button>
                );
              })}
            </div>

            {/* Supertags Tab */}
            {activeTab === 'tags' && (
              <div className="space-y-2.5">
                {tags.map((tag) => {
                  const meta = (tag.meta as TagDefMeta) || {};
                  const count = tagCounts[tag.id] || 0;
                  return (
                    <div
                      key={tag.id}
                      onClick={() => setSelectedTagId(tag.id)}
                      className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] rounded-[10px] cursor-pointer flex items-center justify-between transition-colors duration-120 group"
                    >
                      <div className="flex items-center space-x-3.5">
                        <div
                          className="w-3.5 h-3.5 rounded-[4px] shrink-0"
                          style={{ backgroundColor: meta.color || 'var(--accent)' }}
                        />
                        <div>
                          <div className="text-[15px] font-medium text-[var(--text-primary)] flex items-center space-x-2">
                            <span>#{tag.content}</span>
                            {meta.showCheckbox && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-[4px] bg-[var(--green-dim)] text-[var(--green)] border border-[var(--green)]/30">
                                checkbox
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] text-[var(--text-faint)] flex items-center space-x-2 mt-0.5">
                            <span className="text-[var(--accent)] font-medium">
                              {count} {count === 1 ? 'node' : 'nodes'} tagged
                            </span>
                            <span>•</span>
                            {meta.extends && meta.extends.length > 0 && (
                              <span>Extends: {meta.extends.join(', ')} • </span>
                            )}
                            <span>{meta.fieldDefs?.length || 0} fields configured</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-[12px] text-[var(--text-faint)] group-hover:text-[var(--accent)] flex items-center space-x-1 transition-colors">
                          <span>View nodes</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTagId(tag.id);
                          }}
                          className="px-2.5 py-1 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--accent)] text-[12px] text-[var(--accent)] flex items-center space-x-1 cursor-pointer transition-colors"
                          title="Edit supertag configuration"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Field Definitions Tab */}
            {activeTab === 'fields' && (
              <div className="space-y-2">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className="p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px] flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <Database className="w-4 h-4 text-[var(--green)]" strokeWidth={2} />
                      <div>
                        <div className="text-[14px] font-medium text-[var(--text-primary)]">
                          {field.content}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--text-faint)]">
                          Type: {(field.meta as any)?.type || 'text'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Commands Tab */}
            {activeTab === 'commands' && (
              <div className="space-y-2">
                {commands.map((cmd) => (
                  <div
                    key={cmd.id}
                    className="p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px] flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <Terminal className="w-4 h-4 text-[var(--accent)]" strokeWidth={2} />
                      <div>
                        <div className="text-[14px] font-medium text-[var(--text-primary)]">
                          {cmd.name}
                        </div>
                        <div className="text-[12px] text-[var(--text-muted)]">
                          {cmd.description || 'Custom command action'}
                        </div>
                      </div>
                    </div>
                    {cmd.shortcut && (
                      <kbd className="font-mono text-[11px] text-[var(--text-faint)] bg-[var(--bg-raised)] px-2 py-0.5 rounded-[4px] border border-[var(--border-subtle)]">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setEditingCommandId(cmd.id)}
                        className="px-2.5 py-1 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--accent)] text-[12px] text-[var(--accent)] cursor-pointer transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!store.db) return;
                          await store.db.adapter.execute('DELETE FROM command WHERE id = ?', [
                            cmd.id,
                          ]);
                          setCommands(commands.filter((c) => c.id !== cmd.id));
                        }}
                        aria-label={`Delete command ${cmd.name}`}
                        className="px-2 py-1 rounded-[6px] bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--red)] text-[12px] text-[var(--red)] cursor-pointer transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Supertag Edit/Create Modal */}
      <SupertagModal
        isOpen={editingTagId !== undefined}
        tagId={editingTagId}
        onClose={() => setEditingTagId(undefined)}
      />

      {/* Command Edit/Create Modal */}
      <CommandModal
        isOpen={editingCommandId !== undefined}
        commandId={editingCommandId}
        onClose={() => {
          setEditingCommandId(undefined);
          if (store.db) {
            store.db.adapter
              .query<any>('SELECT * FROM command ORDER BY name ASC')
              .then(setCommands);
          }
        }}
      />
    </div>
  );
};
