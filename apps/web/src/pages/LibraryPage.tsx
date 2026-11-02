import React, { useState, useEffect } from 'react';
import { Tag, Database, Terminal, Plus, ExternalLink } from 'lucide-react';
import { NodeRecord, TagDefMeta } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export const LibraryPage: React.FC = () => {
  const store = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<'tags' | 'fields' | 'commands'>('tags');
  const [tags, setTags] = useState<NodeRecord[]>([]);
  const [fields, setFields] = useState<NodeRecord[]>([]);
  const [commands, setCommands] = useState<any[]>([]);

  useEffect(() => {
    if (!store.db) return;
    async function load() {
      if (!store.db) return;
      const tagNodes = await store.db.tags.getAllTags();
      const fieldNodes = await store.db.adapter.query<any>(
        "SELECT * FROM node WHERE kind = 'fieldDef' AND deleted_at IS NULL ORDER BY content ASC"
      );
      const cmdList = await store.db.adapter.query<any>('SELECT * FROM command ORDER BY name ASC');

      setTags(tagNodes);
      setFields(fieldNodes);
      setCommands(cmdList);
    }
    load();
  }, [store.version, store.db]);

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto font-sans text-[#ffffff]">
      <div className="mb-6 pb-4 border-b border-[#222222]">
        <div className="text-[10px] font-mono uppercase tracking-[2px] text-[#555555] mb-1">
          WORKSPACE SCHEMA & EXTENSIONS
        </div>
        <h1 className="text-3xl font-medium tracking-tight text-[#ffffff]">Library</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-[#222222] mb-6">
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
              className={`flex items-center space-x-2 px-4 py-2 text-[12px] font-medium font-mono uppercase tracking-[1px] cursor-pointer transition-colors duration-100 ${
                isActive
                  ? 'border-b-2 border-[#ffffff] text-[#ffffff] bg-[#111111]'
                  : 'text-[#888888] hover:text-[#ffffff]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2} />
              <span>{tab.label}</span>
              <span className="text-[10px] text-[#555555]">({tab.count})</span>
            </button>
          );
        })}
      </div>

      {/* Supertags Tab */}
      {activeTab === 'tags' && (
        <div className="space-y-2">
          {tags.map((tag) => {
            const meta = (tag.meta as TagDefMeta) || {};
            return (
              <div
                key={tag.id}
                onClick={() => store.openNode(tag.id)}
                className="p-4 bg-[#111111] border border-[#222222] hover:border-[#444444] cursor-pointer flex items-center justify-between transition-colors duration-100 group"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="w-3 h-3"
                    style={{ backgroundColor: meta.color || '#888888' }}
                  />
                  <div>
                    <div className="text-[14px] font-medium text-[#ffffff]">
                      #{tag.content}
                    </div>
                    {meta.extends && meta.extends.length > 0 && (
                      <div className="text-[11px] font-mono text-[#555555]">
                        Extends: {meta.extends.join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <span className="text-[11px] font-mono text-[#555555]">
                    {meta.fieldDefs?.length || 0} fields
                  </span>
                  <ExternalLink className="w-4 h-4 text-[#555555] group-hover:text-[#ffffff]" strokeWidth={2} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fields Tab */}
      {activeTab === 'fields' && (
        <div className="space-y-2">
          {fields.map((f) => {
            let meta: any = {};
            try {
              meta = JSON.parse(f.meta);
            } catch {}
            return (
              <div
                key={f.id}
                onClick={() => store.openNode(f.id)}
                className="p-4 bg-[#111111] border border-[#222222] hover:border-[#444444] cursor-pointer flex items-center justify-between transition-colors duration-100 group"
              >
                <div>
                  <div className="text-[14px] font-medium text-[#ffffff]">
                    {f.content}
                  </div>
                  <div className="text-[11px] font-mono text-[#555555]">
                    Type: {meta.type || 'text'}
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-[#555555] group-hover:text-[#ffffff]" strokeWidth={2} />
              </div>
            );
          })}
        </div>
      )}

      {/* Commands Tab */}
      {activeTab === 'commands' && (
        <div className="space-y-2">
          {commands.length === 0 ? (
            <div className="p-8 text-center text-[#555555] font-mono text-[12px] uppercase tracking-[1px] bg-[#111111] border border-[#222222]">
              No custom commands defined yet.
            </div>
          ) : (
            commands.map((cmd) => (
              <div
                key={cmd.id}
                className="p-4 bg-[#111111] border border-[#222222] flex items-center justify-between"
              >
                <div>
                  <div className="text-[14px] font-medium text-[#ffffff]">
                    {cmd.name}
                  </div>
                  <div className="text-[11px] text-[#888888]">
                    {cmd.description}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
