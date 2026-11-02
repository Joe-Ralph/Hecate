import React, { useState } from 'react';
import { NodeRecord, formatDate } from '@hecate/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CalendarViewProps {
  nodes: NodeRecord[];
  getNodeDate: (node: NodeRecord) => string | null; // returns YYYY-MM-DD
  onNodeClick?: (nodeId: string) => void;
  onDayClick?: (dateIso: string) => void;
  className?: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  nodes,
  getNodeDate,
  onNodeClick,
  onDayClick,
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
  for (const n of nodes) {
    const d = getNodeDate(n);
    if (d) {
      if (!nodesByDate.has(d)) nodesByDate.set(d, []);
      nodesByDate.get(d)!.push(n);
    }
  }

  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className={`w-full bg-[#0a0a0a] border border-[#222222] font-sans ${className}`}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#222222] bg-[#111111]">
        <div className="flex items-center space-x-3">
          <span className="text-[14px] font-medium uppercase tracking-[1.5px] text-[#ffffff]">
            {monthNames[month]} {year}
          </span>
          <button
            type="button"
            onClick={jumpToday}
            className="text-[10px] font-mono text-[#888888] hover:text-[#ffffff] px-2 py-0.5 border border-[#333333] hover:border-[#ffffff] cursor-pointer uppercase tracking-[1px]"
          >
            TODAY
          </button>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 text-[#888888] hover:text-[#ffffff] hover:bg-[#1a1a1a] cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 text-[#888888] hover:text-[#ffffff] hover:bg-[#1a1a1a] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Days of Week Row */}
      <div className="grid grid-cols-7 border-b border-[#222222] bg-[#111111] text-center text-[10px] font-mono uppercase tracking-[1.5px] text-[#555555] py-2">
        {daysOfWeek.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Calendar Grid Cells */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {/* Leading empty days */}
        {Array.from({ length: startingDay }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[100px] border-r border-b border-[#222222] bg-[#0c0c0c]/40" />
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
              className={`min-h-[100px] border-r border-b border-[#222222] p-1.5 flex flex-col justify-between hover:bg-[#111111] transition-colors duration-100 cursor-pointer ${
                isToday ? 'bg-[#141414]' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[11px] font-mono ${
                    isToday
                      ? 'text-[#ffffff] font-medium px-1 bg-[#222222]'
                      : 'text-[#555555]'
                  }`}
                >
                  {dayNum}
                </span>
                {dayNodes.length > 0 && (
                  <span className="text-[9px] font-mono text-[#555555]">
                    {dayNodes.length}
                  </span>
                )}
              </div>

              {/* Event chips */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {dayNodes.slice(0, 3).map((node) => (
                  <div
                    key={node.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNodeClick?.(node.id);
                    }}
                    className="px-1.5 py-0.5 bg-[#161616] border border-[#333333] hover:border-[#ffffff] text-[11px] text-[#ffffff] truncate font-sans cursor-pointer select-none"
                    title={node.content}
                  >
                    {node.content || 'Untitled'}
                  </div>
                ))}
                {dayNodes.length > 3 && (
                  <div className="text-[9px] font-mono text-[#888888] pl-1">
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
