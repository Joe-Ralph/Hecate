import React, { useState } from 'react';
import { NodeRecord, formatDate } from '@hecate/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CalendarViewProps {
  nodes?: NodeRecord[];
  getNodeDate?: (node: NodeRecord) => string | null; // returns YYYY-MM-DD
  onNodeClick?: (nodeId: string) => void;
  onDayClick?: (dateIso: string) => void;
  onNodeReschedule?: (nodeId: string, dateIso: string) => void;
  className?: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  nodes = [],
  getNodeDate = (n) => {
    const match = n.content.match(/\[\[date:(\d{4}-\d{2}-\d{2})\]\]/);
    return match ? match[1] : null;
  },
  onNodeClick,
  onDayClick,
  onNodeReschedule,
  className = '',
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startingDay = firstDay.getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const jumpToday = () => setCurrentDate(new Date());

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
  ];

  // Group nodes by date
  const nodesByDate = new Map<string, NodeRecord[]>();
  for (const n of nodes || []) {
    const d = getNodeDate ? getNodeDate(n) : null;
    if (d) {
      if (!nodesByDate.has(d)) nodesByDate.set(d, []);
      nodesByDate.get(d)!.push(n);
    }
  }

  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className={`w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] font-sans ${className}`}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="flex items-center space-x-3">
          <span className="text-[14px] font-medium uppercase tracking-[1.5px] text-[var(--text-primary)]">
            {monthNames[month]} {year}
          </span>
          <button
            type="button"
            onClick={jumpToday}
            className="text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-0.5 border border-[var(--border-strong)] hover:border-[var(--text-primary)] cursor-pointer uppercase tracking-[1px]"
          >
            TODAY
          </button>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Days of Week Row */}
      <div className="grid grid-cols-7 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center text-[10px] font-mono uppercase tracking-[1.5px] text-[var(--text-faint)] py-2">
        {daysOfWeek.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Calendar Grid Cells */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {/* Leading empty days */}
        {Array.from({ length: startingDay }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[100px] border-r border-b border-[var(--border-subtle)] bg-[var(--bg-track)]/40" />
        ))}

        {/* Days of the month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const dayDate = new Date(year, month, dayNum);
          const dateIso = formatDate(dayDate);
          const dayNodes = nodesByDate.get(dateIso) || [];
          const isToday = formatDate(new Date()) === dateIso;

          return (
            <div
              key={dayNum}
              onClick={() => onDayClick?.(dateIso)}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('application/x-hecate-node')) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(e) => {
                const draggedId = e.dataTransfer.getData('application/x-hecate-node');
                if (draggedId) {
                  e.preventDefault();
                  e.stopPropagation();
                  onNodeReschedule?.(draggedId, dateIso);
                }
              }}
              className={`min-h-[100px] border-r border-b border-[var(--border-subtle)] p-1.5 flex flex-col justify-between hover:bg-[var(--bg-surface)] transition-colors duration-100 cursor-pointer ${
                isToday ? 'bg-[var(--bg-active)]' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[11px] font-mono ${
                    isToday
                      ? 'text-[var(--text-primary)] font-medium px-1 bg-[var(--border-subtle)]'
                      : 'text-[var(--text-faint)]'
                  }`}
                >
                  {dayNum}
                </span>
                {dayNodes.length > 0 && (
                  <span className="text-[9px] font-mono text-[var(--text-faint)]">
                    {dayNodes.length}
                  </span>
                )}
              </div>

              {/* Event chips */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {dayNodes.slice(0, 3).map((node) => (
                  <div
                    key={node.id}
                    draggable={Boolean(onNodeReschedule)}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      e.dataTransfer.setData('application/x-hecate-node', node.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNodeClick?.(node.id);
                    }}
                    className="px-1.5 py-0.5 bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--text-primary)] text-[11px] text-[var(--text-primary)] truncate font-sans cursor-pointer select-none"
                    title={node.content}
                  >
                    {node.content || 'Untitled'}
                  </div>
                ))}
                {dayNodes.length > 3 && (
                  <div className="text-[9px] font-mono text-[var(--text-muted)] pl-1">
                    +{dayNodes.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
