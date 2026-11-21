import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  LayoutGrid,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  ActiveTab,
  DrawDuration,
  DrawRecord,
  PickerVisualMode,
  SoundPreset,
  Student,
} from '../types/classroom';
import { soundEngine } from '../utils/sound';
import { ConfettiOverlay } from './ConfettiOverlay';

interface RandomPickerProps {
  students: Student[];
  allowRepeat: boolean;
  onAllowRepeatChange: (next: boolean) => void;
  soundPreset: SoundPreset;
  onSoundPresetChange: (preset: SoundPreset) => void;
  history: DrawRecord[];
  onRecordDraw: (student: Student) => void;
  onRestoreRecord: (recordId: string) => void;
  onResetHistory: () => void;
  onNavigate: (tab: ActiveTab) => void;
  isProjectorMode: boolean;
}

const DURATION_MS: Record<DrawDuration, number> = {
  fast: 1650,
  normal: 3100,
  dramatic: 4900,
};

export function RandomPicker({
  students,
  allowRepeat,
  onAllowRepeatChange,
  soundPreset,
  onSoundPresetChange,
  history,
  onRecordDraw,
  onRestoreRecord,
  onResetHistory,
  onNavigate,
  isProjectorMode,
}: RandomPickerProps) {
  const [visualMode, setVisualMode] = useState<PickerVisualMode>('reel');
  const [duration, setDuration] = useState<DrawDuration>('normal');
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [winner, setWinner] = useState<Student | null>(null);
  const [reelNeighbors, setReelNeighbors] = useState<{ prev: string; next: string }>({
    prev: '',
    next: '',
  });
  const [burstKey, setBurstKey] = useState(0);

  const timerRef = useRef<number | null>(null);
  const soundPresetRef = useRef(soundPreset);
  soundPresetRef.current = soundPreset;

  const drawnIds = useMemo(() => new Set(history.map((h) => h.studentId)), [history]);

  const availablePool = useMemo(() => {
    if (allowRepeat) return students;
    return students.filter((s) => !drawnIds.has(s.id));
  }, [students, allowRepeat, drawnIds]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Reset display if roster changes completely
  useEffect(() => {
    if (winner && !students.some((s) => s.id === winner.id)) {
      setWinner(null);
      setActiveStudent(null);
    }
  }, [students, winner]);

  const startDraw = useCallback(() => {
    if (isDrawing || availablePool.length === 0) return;

    // Select final winner fairly upfront using uniform randomness
    const chosenIndex = Math.floor(Math.random() * availablePool.length);
    const chosenStudent = availablePool[chosenIndex];

    // If only 1 student remains in pool, still do a brief drumroll across class or quick reveal
    const displayPool = availablePool.length >= 3 ? availablePool : students;
    const totalMs = DURATION_MS[duration];

    // Build decelerating step schedule (ease-out cubic spacing)
    const stepDelays: number[] = [];
    let accumulated = 0;
    let stepIndex = 0;
    const minDelay = 48;
    const maxDelay = duration === 'fast' ? 240 : duration === 'normal' ? 360 : 480;

    while (accumulated < totalMs) {
      const progress = Math.min(1, accumulated / totalMs);
      const eased = Math.pow(progress, 2.35);
      const delay = Math.round(minDelay + (maxDelay - minDelay) * eased);
      stepDelays.push(delay);
      accumulated += delay;
      stepIndex++;
      if (stepIndex > 90) break;
    }

    setIsDrawing(true);
    setWinner(null);

    let currentIdx = Math.floor(Math.random() * displayPool.length);

    const runStep = (step: number) => {
      if (step >= stepDelays.length) {
        // Land on the final chosen student
        const finalIdx = displayPool.findIndex((s) => s.id === chosenStudent.id);
        const prevName =
          displayPool[(finalIdx - 1 + displayPool.length) % displayPool.length]?.name ?? '';
        const nextName = displayPool[(finalIdx + 1) % displayPool.length]?.name ?? '';

        setActiveStudent(chosenStudent);
        setReelNeighbors({ prev: prevName, next: nextName });
        setWinner(chosenStudent);
        setIsDrawing(false);
        setBurstKey((k) => k + 1);
        soundEngine.playWinnerFanfare(soundPresetRef.current);
        onRecordDraw(chosenStudent);
        return;
      }

      // Advance index avoiding immediate repeat when pool > 1
      if (displayPool.length > 1) {
        if (visualMode === 'grid') {
          let nextIdx = Math.floor(Math.random() * displayPool.length);
          if (nextIdx === currentIdx) {
            nextIdx = (currentIdx + 1) % displayPool.length;
          }
          // On the penultimate step, ensure we don't land on winner prematurely
          if (step === stepDelays.length - 1 && displayPool[nextIdx].id === chosenStudent.id) {
            nextIdx = (nextIdx + 1) % displayPool.length;
          }
          currentIdx = nextIdx;
        } else {
          currentIdx = (currentIdx + 1) % displayPool.length;
          if (step === stepDelays.length - 1 && displayPool[currentIdx].id === chosenStudent.id) {
            currentIdx = (currentIdx + 1) % displayPool.length;
          }
        }
      }

      const candidate = displayPool[currentIdx];
      const prevName =
        displayPool[(currentIdx - 1 + displayPool.length) % displayPool.length]?.name ?? '';
      const nextName = displayPool[(currentIdx + 1) % displayPool.length]?.name ?? '';

      setActiveStudent(candidate);
      setReelNeighbors({ prev: prevName, next: nextName });

      const progress = step / stepDelays.length;
      soundEngine.playTick(soundPresetRef.current, progress);

      timerRef.current = window.setTimeout(() => {
        runStep(step + 1);
      }, stepDelays[step]);
    };

    runStep(0);
  }, [availablePool, duration, isDrawing, onRecordDraw, students, visualMode]);

  // Keyboard shortcut: Spacebar to draw
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (!isDrawing && availablePool.length > 0) {
        startDraw();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [availablePool.length, isDrawing, startDraw]);

  const handleResetAndClear = () => {
    if (isDrawing) return;
    setWinner(null);
    setActiveStudent(null);
    onResetHistory();
  };

  if (students.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold text-slate-900">尚未建立學生名單</h2>
        <p className="mt-2 text-sm text-slate-500">
          請先匯入或貼上班級學生姓名，即可開始使用隨機抽籤功能。
        </p>
        <button
          type="button"
          onClick={() => onNavigate('roster')}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1D4ED8] transition-colors cursor-pointer"
        >
          前往匯入名單
        </button>
      </div>
    );
  }

  const poolExhausted = !allowRepeat && availablePool.length === 0;

  return (
    <div
      className={`grid grid-cols-1 gap-8 items-start ${
        isProjectorMode ? 'lg:grid-cols-12' : 'lg:grid-cols-12'
      }`}
    >
      {/* Left Main Interactive Stage (~66% width) */}
      <section
        className={`relative overflow-hidden bg-white border border-slate-200 rounded-xl flex flex-col justify-between ${
          isProjectorMode ? 'lg:col-span-9 min-h-[620px]' : 'lg:col-span-8 min-h-[540px]'
        }`}
      >
        <ConfettiOverlay burstKey={burstKey} />

        {/* Stage Header: Clean unboxed metadata + Visual mode switcher */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
            <span className="font-medium text-slate-800">
              可抽名單 {availablePool.length} / {students.length} 人
            </span>
            <span aria-hidden="true">·</span>
            <span>{allowRepeat ? '可重複抽取' : '不重複抽取'}</span>
            <span aria-hidden="true">·</span>
            <span>已抽出 {history.length} 次</span>
          </div>

          <div
            role="tablist"
            aria-label="抽籤顯示模式"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={visualMode === 'reel'}
              disabled={isDrawing}
              onClick={() => setVisualMode('reel')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                visualMode === 'reel'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              滾輪抽籤
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={visualMode === 'grid'}
              disabled={isDrawing}
              onClick={() => setVisualMode('grid')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                visualMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              班級方陣
            </button>
          </div>
        </div>

        {/* Stage Body */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
          {visualMode === 'reel' ? (
            <div className="w-full max-w-xl mx-auto flex flex-col items-center">
              {poolExhausted && !winner ? (
                <div className="text-center py-8">
                  <p className="text-lg font-semibold text-slate-800">
                    全班 {students.length} 位同學皆已抽完
                  </p>
                  <p className="mt-1.5 text-sm text-slate-500">
                    請點擊下方按鈕重置名單，開始新一輪抽籤。
                  </p>
                </div>
              ) : (
                <div className="w-full">
                  {/* Top neighbor (faded reel drum illusion) */}
                  <div className="h-10 flex items-center justify-center overflow-hidden">
                    <span className="text-lg sm:text-xl font-medium text-slate-300 select-none tracking-wide">
                      {isDrawing || winner ? reelNeighbors.prev : ''}
                    </span>
                  </div>

                  {/* Center Focal Spotlight Frame */}
                  <div
                    className={`relative my-2 rounded-2xl border transition-all duration-200 px-6 py-10 sm:py-14 text-center ${
                      winner
                        ? 'border-[#D97706] bg-amber-50/40 shadow-sm'
                        : isDrawing
                        ? 'border-[#2563EB] bg-blue-50/30'
                        : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    {/* Subtle hairline guide markers left/right */}
                    <div
                      aria-hidden="true"
                      className={`absolute left-3 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full transition-colors ${
                        winner
                          ? 'bg-[#D97706]'
                          : isDrawing
                          ? 'bg-[#2563EB]'
                          : 'bg-slate-200'
                      }`}
                    />
                    <div
                      aria-hidden="true"
                      className={`absolute right-3 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full transition-colors ${
                        winner
                          ? 'bg-[#D97706]'
                          : isDrawing
                          ? 'bg-[#2563EB]'
                          : 'bg-slate-200'
                      }`}
                    />

                    <div className="text-xs font-medium text-slate-500 mb-3 h-4">
                      {winner
                        ? `第 ${history[0]?.round ?? history.length} 輪中選學生 · 座號 ${String(
                            winner.seatNo ?? 0
                          ).padStart(2, '0')}`
                        : isDrawing
                        ? '隨機抽取中...'
                        : '準備就緒'}
                    </div>

                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.div
                        key={activeStudent?.id ?? 'idle'}
                        initial={
                          isDrawing
                            ? { y: 18, opacity: 0.4, scale: 0.96 }
                            : { scale: 0.92, opacity: 0 }
                        }
                        animate={{
                          y: 0,
                          opacity: 1,
                          scale: winner ? 1.04 : 1,
                        }}
                        exit={isDrawing ? { y: -18, opacity: 0.2 } : { opacity: 0 }}
                        transition={{
                          duration: isDrawing ? 0.06 : 0.28,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className={`font-bold tracking-tight select-none leading-tight ${
                          isProjectorMode
                            ? 'text-6xl sm:text-7xl'
                            : 'text-5xl sm:text-6xl'
                        } ${
                          winner
                            ? 'text-slate-950'
                            : activeStudent
                            ? 'text-slate-800'
                            : 'text-slate-300'
                        }`}
                      >
                        {activeStudent ? activeStudent.name : '點擊開始抽籤'}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Bottom neighbor */}
                  <div className="h-10 flex items-center justify-center overflow-hidden">
                    <span className="text-lg sm:text-xl font-medium text-slate-300 select-none tracking-wide">
                      {isDrawing || winner ? reelNeighbors.next : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Classroom Grid Spotlight Mode */
            <div className="w-full space-y-5">
              {/* Winner announcement banner inside grid mode */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 min-h-[44px]">
                {winner ? (
                  <div className="flex items-baseline gap-3">
                    <span className="text-xs font-medium text-[#D97706]">本次中選</span>
                    <span className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                      {winner.name}
                    </span>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      座號 {String(winner.seatNo ?? 0).padStart(2, '0')}
                    </span>
                  </div>
                ) : isDrawing ? (
                  <span className="text-sm font-medium text-[#2563EB]">
                    正在掃描班級座位...
                  </span>
                ) : (
                  <span className="text-sm text-slate-500">
                    點擊「開始抽籤」，亮點將於可抽同學之間跳動並鎖定中選者。
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {students.map((student) => {
                  const isAlreadyDrawn = !allowRepeat && drawnIds.has(student.id);
                  const isCurrentHighlight = activeStudent?.id === student.id;
                  const isWinnerCard = winner?.id === student.id;

                  return (
                    <motion.div
                      key={student.id}
                      animate={{
                        scale: isWinnerCard ? 1.06 : isCurrentHighlight ? 1.03 : 1,
                      }}
                      transition={{ duration: 0.12 }}
                      className={`rounded-lg border px-3 py-3 text-center transition-colors ${
                        isWinnerCard
                          ? 'border-[#D97706] bg-amber-50 text-slate-950 ring-2 ring-[#D97706]/30'
                          : isCurrentHighlight && isDrawing
                          ? 'border-[#2563EB] bg-[#2563EB] text-white'
                          : isAlreadyDrawn
                          ? 'border-slate-100 bg-slate-50 text-slate-400'
                          : 'border-slate-200 bg-white text-slate-800'
                      }`}
                    >
                      <div
                        className={`font-mono text-[11px] tabular-nums ${
                          isCurrentHighlight && isDrawing
                            ? 'text-blue-100'
                            : isWinnerCard
                            ? 'text-[#B45309]'
                            : 'text-slate-400'
                        }`}
                      >
                        {String(student.seatNo ?? 0).padStart(2, '0')}
                        {isAlreadyDrawn && !isWinnerCard ? ' · 已抽' : ''}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold truncate">
                        {student.name}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Stage Footer CTA */}
        <div className="relative z-10 border-t border-slate-100 bg-slate-50/50 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            {poolExhausted
              ? '所有同學皆已完成本輪抽籤'
              : '快捷鍵：按空白鍵（Space）即可開始抽籤'}
          </div>

          <div className="flex items-center gap-3">
            {poolExhausted ? (
              <button
                type="button"
                onClick={handleResetAndClear}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                重置名單開始新一輪
              </button>
            ) : (
              <button
                type="button"
                disabled={isDrawing}
                onClick={startDraw}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-7 py-3 text-sm font-semibold text-white hover:bg-[#1D4ED8] active:scale-[0.99] disabled:bg-blue-400 disabled:cursor-not-allowed transition-all whitespace-nowrap cursor-pointer"
              >
                <Shuffle className="h-4 w-4" />
                {isDrawing ? '抽籤中...' : winner ? '再抽一位' : '開始抽籤'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Right Control Deck & History (~34% width) */}
      <aside
        className={`space-y-6 ${
          isProjectorMode ? 'lg:col-span-3' : 'lg:col-span-4'
        }`}
      >
        {/* Settings Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <h2 className="text-base font-semibold text-slate-900">抽籤設定</h2>

          {/* Repeat Mode */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-600">
              重複抽取規則
            </span>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                disabled={isDrawing}
                onClick={() => onAllowRepeatChange(false)}
                className={`rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  !allowRepeat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                不重複抽取
              </button>
              <button
                type="button"
                disabled={isDrawing}
                onClick={() => onAllowRepeatChange(true)}
                className={`rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  allowRepeat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                可重複抽取
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {allowRepeat
                ? '每位同學皆保留於名單中，可能再次被抽中。'
                : '中選同學將暫時移出本輪名單，直到重置。'}
            </p>
          </div>

          {/* Animation Pace */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-600">
              動畫節奏
            </span>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { key: 'fast', label: '快速 1.6s' },
                  { key: 'normal', label: '標準 3s' },
                  { key: 'dramatic', label: '懸疑 5s' },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={isDrawing}
                  onClick={() => setDuration(item.key)}
                  className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    duration === item.key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sound Preset */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">音效模式</span>
              {soundPreset !== 'muted' && (
                <button
                  type="button"
                  onClick={() => soundEngine.playWinnerFanfare(soundPreset)}
                  className="text-xs text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer"
                >
                  試聽音效
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { key: 'marimba', label: '木琴' },
                  { key: 'wheel', label: '轉盤' },
                  { key: 'muted', label: '靜音' },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSoundPresetChange(item.key)}
                  className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    soundPreset === item.key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.key === 'muted' ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* History Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-base font-semibold text-slate-900">抽籤紀錄</h3>
              <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                本輪已抽 {history.length} 筆
              </p>
            </div>
            {history.length > 0 && (
              <button
                type="button"
                disabled={isDrawing}
                onClick={handleResetAndClear}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-red-600 transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重置本輪
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              尚未抽出任何學生，紀錄將即時顯示於此。
            </p>
          ) : (
            <ol className="mt-3 max-h-[260px] overflow-y-auto divide-y divide-slate-100 pr-1">
              {history.map((record) => (
                <li
                  key={record.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-slate-400 tabular-nums w-6 shrink-0">
                      #{String(record.round).padStart(2, '0')}
                    </span>
                    <span className="font-medium text-slate-800 truncate">
                      {record.studentName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {record.drawnAt}
                    </span>
                    {!allowRepeat && (
                      <button
                        type="button"
                        disabled={isDrawing}
                        onClick={() => onRestoreRecord(record.id)}
                        title="將此學生放回可抽名單（例如請假）"
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-[#2563EB] transition-colors cursor-pointer"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        <span className="sr-only">放回名單</span>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
