import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, X, Check } from 'lucide-react';

export interface TimerModalProps {
  title: string;
  durationMin: number;
  onComplete: () => void;
  onClose: () => void;
}

export const TimerModal: React.FC<TimerModalProps> = ({
  title,
  durationMin,
  onComplete,
  onClose,
}) => {
  const totalSeconds = durationMin * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let interval: any = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (secondsLeft === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  const progress = Math.round(((totalSeconds - secondsLeft) / totalSeconds) * 100);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-[#333333] p-6 text-[#ffffff] font-sans shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#888888] hover:text-[#ffffff] cursor-pointer"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>

        <div className="text-[10px] font-mono uppercase tracking-[2px] text-[#888888] mb-2">
          FOCUS TIMER · {durationMin} MIN
        </div>

        <h3 className="text-[18px] font-medium leading-snug mb-6 text-[#ffffff]">
          {title}
        </h3>

        {/* Digital Time Readout */}
        <div className="font-mono text-5xl font-medium tracking-tight text-center my-6 py-4 bg-[#111111] border border-[#222222]">
          {formatTime(secondsLeft)}
        </div>

        {/* 2px Determinate Progress Track */}
        <div className="w-full h-[2px] bg-[#222222] mb-6">
          <div
            className="h-full bg-[#ffffff] transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-[#222222]">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className="h-8 px-3 flex items-center space-x-1.5 bg-[#ffffff] text-[#000000] text-[11px] font-medium uppercase tracking-[1.5px] hover:bg-[#e0e0e0] active:scale-98 cursor-pointer transition-transform duration-100"
            >
              {isActive ? (
                <>
                  <Pause className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>PAUSE</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>RESUME</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSecondsLeft(totalSeconds);
                setIsActive(false);
              }}
              className="h-8 px-3 flex items-center space-x-1.5 bg-[#161616] border border-[#333333] hover:border-[#ffffff] text-[#888888] hover:text-[#ffffff] text-[11px] font-medium uppercase tracking-[1.5px] active:scale-98 cursor-pointer transition-colors duration-100"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
              <span>RESET</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onComplete();
              onClose();
            }}
            className="h-8 px-3 flex items-center space-x-1.5 bg-[#111111] border border-[#338833] hover:bg-[#338833]/10 text-[#338833] text-[11px] font-medium uppercase tracking-[1.5px] active:scale-98 cursor-pointer transition-colors duration-100"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2} />
            <span>MARK DONE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
