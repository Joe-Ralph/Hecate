/**
 * Hecate Core Data Types
 * Strict domain representations with zero DOM or platform imports.
 */

export type NodeKind =
  | 'content'
  | 'field'
  | 'fieldValue'
  | 'tagDef'
  | 'fieldDef'
  | 'search'
  | 'day'
  | 'workspace';

export interface NodeRecord {
  id: string;
  parent_id: string | null;
  position: string;
  kind: NodeKind;
  content: string;
  collapsed: number; // 0 or 1
  done_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  meta: Record<string, any> | null;
}

export interface NodeTagRecord {
  node_id: string;
  tag_def_id: string;
}

export type RefKind = 'inline' | 'field';

export interface RefRecord {
  source_node_id: string;
  target_node_id: string;
  kind: RefKind;
}

export interface TagFieldDefConfig {
  fieldDefId: string;
  pinned?: boolean;
  default?: any;
  required?: boolean;
}

export interface DefaultContentItem {
  content: string;
  kind?: NodeKind;
  children?: DefaultContentItem[];
}

export interface TagDefMeta {
  color: string;
  extends: string[];
  icon?: string;
  fieldDefs: TagFieldDefConfig[];
  defaultContent?: DefaultContentItem[];
  showCheckbox: boolean;
  buildTitle?: string;
  aiExclude?: boolean;
}

export type FieldType =
  | 'text'
  | 'options'
  | 'date'
  | 'nodeRef'
  | 'boolean'
  | 'url'
  | 'file'
  | 'number';

export interface FieldOption {
  id: string;
  label: string;
  color?: string;
}

export interface FieldDefMeta {
  type: FieldType;
  options?: FieldOption[];
  targetTag?: string;
  min?: number;
  max?: number;
  multi?: boolean;
  autoInit?: 'none' | 'today' | 'currentUser' | 'default';
  defaultValue?: any;
}

export type MiniTaskCategory =
  | 'learning'
  | 'health'
  | 'relationships'
  | 'finance'
  | 'creativity'
  | 'mindfulness'
  | 'rest'
  | 'home';

export type MiniTaskStatus =
  | 'suggested'
  | 'started'
  | 'done'
  | 'snoozed'
  | 'dismissed'
  | 'saved';

export interface MiniTaskRecord {
  id: string;
  title: string;
  rationale: string;
  category: MiniTaskCategory;
  duration_min: number;
  status: MiniTaskStatus;
  source_summary_id: string | null;
  created_at: number;
  due_at: number | null;
  done_at: number | null;
  snoozed_until: number | null;
  feedback: string | null;
}

export interface AiSummaryRecord {
  id: string;
  window_start: number;
  window_end: number;
  text: string;
  topics: string[];
  node_count: number;
  created_at: number;
  provider: string;
  model: string;
}

export type CommandStep =
  | { type: 'setField'; fieldDefId: string; value: any }
  | { type: 'addTag'; tagId: string }
  | { type: 'removeTag'; tagId: string }
  | { type: 'setDone'; done: boolean }
  | { type: 'shiftDate'; fieldDefId: string; days: number }
  | { type: 'moveTo'; targetParentId: string };

export interface CommandRecord {
  id: string;
  name: string;
  description: string | null;
  steps: CommandStep[];
  scope: string | null; // tagDefId or null
}

export interface SettingsMap {
  theme?: 'dark' | 'light' | 'system';
  fontSize?: number;
  accentColor?: string;
  aiEnabled?: boolean;
  aiProvider?: 'anthropic' | 'openai-compatible' | 'ollama' | 'mock';
  aiApiKey?: string;
  aiEndpoint?: string;
  aiModel?: string;
  aiScope?: 'all' | 'dailyOnly' | 'taggedOnly';
  aiScopeTags?: string[];
  aiWindowDays?: number;
  aiMaxTasks?: number;
  aiExcludedTags?: string[];
  aiNotificationTime?: string | null;
  [key: string]: any;
}
