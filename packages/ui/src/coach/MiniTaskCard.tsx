import React, { useState } from 'react';
import { Play, Check, Clock, BookmarkPlus, ThumbsDown, Info } from 'lucide-react';
import { MiniTaskRecord } from '@hecate/core';
import { TimerModal } from './TimerModal';

export interface MiniTaskCardProps {
  task: MiniTaskRecord;
  onStartTimer: (task: MiniTaskRecord) => void;
  onDone: (task: MiniTaskRecord) => void;
  onSnooze: (task: MiniTaskRecord) => void;
  onDismiss: (task: MiniTaskRecord) => void;
  onSaveAsNode: (task: MiniTaskRecord) => void;
  className?: string;
}

export const MiniTaskCard: React.FC<MiniTaskCardProps> = ({
  task,
  onDone,
  onSnooze,
  onDismiss,
  onSaveAsNode,
  className = '',
}) => {
  const [showTimer, setShowTimer] = useState(false);
  const [feedbackInputOpen, setFeedbackInputOpen] = useState(false);

  return (
    <>
      <div className={`bg-[#111111] border border-[#333333] hover:border-[#555555] p-5 text-[#ffffff] font-sans relative transition-colors duration-150 ${className}`}>
        {/* Top Meta Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono uppercase tracking-[2px] text-[#888888] px-1.5 py-0.5 bg-[#161616] border border-[#222222]">
              {task.category}
            </span>
            <span className="text-[11px] font-mono text-[#555555] flex items-center space-x-1">
              <Clock className="w-3 h-3" strokeWidth={2} />
              <span>{task.duration_min} MIN</span>
            </span>
          </div>

          <div className="text-[10px] font-mono uppercase tracking-[1px] text-[#555555]">
            MINI-TASK
          </div>
        </div>

        {/* Task Title */}
        <h4 className="text-[17px] font-medium leading-snug mb-2 text-[#ffffff]">
          {task.title}
        </h4>

        {/* Rationale Quote */}
        {task.rationale && (
          <p className="text-[12px] text-[#888888] italic mb-4 pl-2 border-l border-[#333333]">
            "{task.rationale}"
          </p>
        )}

        {/* Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#222222]">
          <div className="flex items-center space-x-2">
            {/* Start Timer */}
            <button
              type="button"
              onClick={() => setShowTimer(true)}
              className="h-7 px-2.5 flex items-center space-x-1.5 bg-[#ffffff] text-[#000000] text-[10px] font-medium uppercase tracking-[1.5px] hover:bg-[#e0e0e0] active:scale-98 cursor-pointer transition-transform duration-100"
            >
              <Play className="w-3 h-3 fill-current" strokeWidth={2} />
              <span>START ({task.duration_min}M)</span>
            </button>

            {/* Mark Done */}
            <button
              type="button"
              onClick={() => onDone(task)}
              className="h-7 px-2.5 flex items-center space-x-1.5 bg-[#161616] border border-[#338833] hover:bg-[#338833]/15 text-[#338833] text-[10px] font-medium uppercase tracking-[1.5px] active:scale-98 cursor-pointer transition-colors duration-100"
            >
              <Check className="w-3 h-3" strokeWidth={2} />
              <span>DONE</span>
            </button>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Snooze */}
            <button
              type="button"
              onClick={() => onSnooze(task)}
              title="Snooze until tomorrow"
              className="h-7 px-2 flex items-center space-x-1 text-[#888888] hover:text-[#ffffff] hover:bg-[#1a1a1a] text-[10px] font-mono uppercase tracking-[1px] cursor-pointer"
            >
              <span>SNOOZE</span>
            </button>

            {/* Save as #task */}
            <button
              type="button"
              onClick={() => onSaveAsNode(task)}
              title="Save as #task node"
              className="h-7 px-2 flex items-center space-x-1 text-[#888888] hover:text-[#ffffff] hover:bg-[#1a1a1a] text-[10px] font-mono uppercase tracking-[1px] cursor-pointer"
            >
              <BookmarkPlus className="w-3 h-3" strokeWidth={2} />
              <span>SAVE</span>
            </button>

            {/* Not for me */}
            <button
              type="button"
              onClick={() => onDismiss(task)}
              title="Not for me (reduces suggestions in this category)"
              className="h-7 px-1.5 flex items-center text-[#555555] hover:text-[#cc3333] hover:bg-[#1a1a1a] cursor-pointer"
            >
              <ThumbsDown className="w-3 h-3" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {showTimer && (
        <TimerModal
          title={task.title}
          durationMin={task.duration_min}
          onComplete={() => onDone(task)}
          onClose={() => setShowTimer(false)}
        />
      )}
    </>
  );
};
