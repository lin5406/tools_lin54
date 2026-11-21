import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeftRight,
  Check,
  CircleDot,
  Copy,
  Download,
  LayoutGrid,
  Minus,
  Plus,
  Printer,
  Shuffle,
} from 'lucide-react';
import type {
  ActiveTab,
  Group,
  GroupVisualMode,
  RemainderMode,
  SoundPreset,
  Student,
} from '../types/classroom';
import { soundEngine } from '../utils/sound';

interface GroupMakerProps {
  students: Student[];
  soundPreset: SoundPreset;
  onNavigate: (tab: ActiveTab) => void;
}

const GROUP_ACCENTS = [
  { topBar: 'bg-[#2563EB]', text: 'text-[#1D4ED8]', nodeBg: '#EFF6FF', nodeBorder: '#2563EB' },
  { topBar: 'bg-[#059669]', text: 'text-[#047857]', nodeBg: '#ECFDF5', nodeBorder: '#059669' },
  { topBar: 'bg-[#D97706]', text: 'text-[#B45309]', nodeBg: '#FFFBEB', nodeBorder: '#D97706' },
  { topBar: 'bg-[#0284C7]', text: 'text-[#0369A1]', nodeBg: '#F0F9FF', nodeBorder: '#0284C7' },
  { topBar: 'bg-[#E11D48]', text: 'text-[#BE123C]', nodeBg: '#FFF1F2', nodeBorder: '#E11D48' },
  { topBar: 'bg-[#4F46E5]', text: 'text-[#4338CA]', nodeBg: '#EEF2FF', nodeBorder: '#4F46E5' },
  { topBar: 'bg-[#0D9488]', text: 'text-[#0F766E]', nodeBg: '#F0FDFA', nodeBorder: '#0D9488' },
  { topBar: 'bg-[#7C3AED]', text: 'text-[#6D28D9]', nodeBg: '#F5F3FF', nodeBorder: '#7C3AED' },
];

function fisherYatesShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildGroups(
  students: Student[],
  groupSize: number,
  remainderMode: RemainderMode,
  assignLeader: boolean
): Group[] {
  if (students.length === 0) return [];
  const safeSize = Math.max(2, Math.min(groupSize, students.length));
  const shuffled = fisherYatesShuffle(students);

  const buckets: Student[][] = [];

  if (remainderMode === 'separate' || shuffled.length <= safeSize) {
    for (let i = 0; i < shuffled.length; i += safeSize) {
      buckets.push(shuffled.slice(i, i + safeSize));
    }
  } else {
    // Distribute remainder evenly across full groups so no single student is left isolated
    const fullGroups = Math.max(1, Math.floor(shuffled.length / safeSize));
    const remainder = shuffled.length % safeSize;

    // If remainder is almost a full group (e.g. size 4, remainder 3), or standard distribution:
    if (remainder > 0 && remainder >= Math.ceil(safeSize / 2) && fullGroups < remainder) {
      for (let i = 0; i < shuffled.length; i += safeSize) {
        buckets.push(shuffled.slice(i, i + safeSize));
      }
    } else {
      for (let g = 0; g < fullGroups; g++) {
        buckets.push([]);
      }
      shuffled.forEach((student, idx) => {
        buckets[idx % fullGroups].push(student);
      });
    }
  }

  return buckets.map((members, idx) => ({
    id: `group_${idx + 1}`,
    index: idx + 1,
    label: `第 ${idx + 1} 組`,
    members,
    leaderId: assignLeader && members.length > 0 ? members[0].id : null,
    colorIndex: idx % GROUP_ACCENTS.length,
  }));
}

export function GroupMaker({ students, soundPreset, onNavigate }: GroupMakerProps) {
  const [groupSize, setGroupSize] = useState(4);
  const [remainderMode, setRemainderMode] = useState<RemainderMode>('distribute');
  const [assignLeader, setAssignLeader] = useState(true);
  const [visualMode, setVisualMode] = useState<GroupVisualMode>('cards');
  const [groups, setGroups] = useState<Group[]>([]);
  const [shuffleKey, setShuffleKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<{
    groupId: string;
    studentId: string;
    studentName: string;
  } | null>(null);

  const maxGroupSize = Math.max(2, Math.min(12, students.length || 12));
  const clampedSize = Math.min(groupSize, maxGroupSize);

  const generate = useCallback(
    (playSound: boolean) => {
      const next = buildGroups(students, clampedSize, remainderMode, assignLeader);
      setGroups(next);
      setSelectedSwap(null);
      setShuffleKey((k) => k + 1);
      if (playSound) {
        soundEngine.playGroupShuffle(soundPreset);
      }
    },
    [students, clampedSize, remainderMode, assignLeader, soundPreset]
  );

  // Auto-generate when roster or configuration changes
  useEffect(() => {
    generate(false);
  }, [students, clampedSize, remainderMode, assignLeader]); // eslint-disable-line react-hooks/exhaustive-deps

  const remainderCount = students.length > 0 ? students.length % clampedSize : 0;

  const previewSummary = useMemo(() => {
    if (groups.length === 0) return '';
    const sizes = groups.map((g) => g.members.length);
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    if (min === max) {
      return `共分為 ${groups.length} 組，每組 ${min} 人`;
    }
    return `共分為 ${groups.length} 組（每組 ${min}–${max} 人）`;
  }, [groups]);

  const handleStudentClick = (groupId: string, student: Student) => {
    if (!selectedSwap) {
      setSelectedSwap({
        groupId,
        studentId: student.id,
        studentName: student.name,
      });
      return;
    }

    if (selectedSwap.studentId === student.id) {
      setSelectedSwap(null);
      return;
    }

    // Swap the two students between their groups
    setGroups((prev) => {
      const g1Idx = prev.findIndex((g) => g.id === selectedSwap.groupId);
      const g2Idx = prev.findIndex((g) => g.id === groupId);
      if (g1Idx === -1 || g2Idx === -1) return prev;

      const next = prev.map((g) => ({ ...g, members: [...g.members] }));
      const m1Idx = next[g1Idx].members.findIndex((m) => m.id === selectedSwap.studentId);
      const m2Idx = next[g2Idx].members.findIndex((m) => m.id === student.id);
      if (m1Idx === -1 || m2Idx === -1) return prev;

      const s1 = next[g1Idx].members[m1Idx];
      const s2 = next[g2Idx].members[m2Idx];
      next[g1Idx].members[m1Idx] = s2;
      next[g2Idx].members[m2Idx] = s1;

      if (next[g1Idx].leaderId === s1.id) next[g1Idx].leaderId = s2.id;
      if (next[g2Idx].leaderId === s2.id) next[g2Idx].leaderId = s1.id;

      return next;
    });
    setSelectedSwap(null);
  };

  const handleCopyText = async () => {
    if (groups.length === 0) return;
    const text = groups
      .map((g) => {
        const names = g.members
          .map((m) => (g.leaderId === m.id ? `${m.name}（組長）` : m.name))
          .join('、');
        return `${g.label}（${g.members.length}人）：${names}`;
      })
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback copy via temporary textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleDownloadCsv = () => {
    if (groups.length === 0) return;
    const rows = ['組別,座號,姓名,角色'];
    groups.forEach((g) => {
      g.members.forEach((m) => {
        const role = g.leaderId === m.id ? '組長' : '組員';
        rows.push(`${g.label},${m.seatNo ?? ''},${m.name},${role}`);
      });
    });
    const blob = new Blob(['\uFEFF' + rows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `班級分組名單_${groups.length}組.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (students.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold text-slate-900">尚未建立學生名單</h2>
        <p className="mt-2 text-sm text-slate-500">
          請先匯入或貼上班級學生姓名，即可自動進行視覺化分組。
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Control Deck (~30% width) */}
      <aside className="lg:col-span-4 xl:col-span-3 bg-white border border-slate-200 rounded-xl p-6 space-y-6 no-print">
        <div className="border-b border-slate-100 pb-4">
          <h1 className="text-lg font-semibold text-slate-900">分組設定</h1>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            全班 {students.length} 人 · {previewSummary}
          </p>
        </div>

        {/* Group Size Stepper & Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="group-size-slider" className="text-xs font-medium text-slate-700">
              每組人數
            </label>
            <span className="font-mono text-sm font-semibold text-[#2563EB] tabular-nums">
              {clampedSize} 人 / 組
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGroupSize((v) => Math.max(2, v - 1))}
              disabled={clampedSize <= 2}
              aria-label="減少每組人數"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
            >
              <Minus className="h-4 w-4" />
            </button>
            <div className="flex-1 text-center font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {clampedSize}
            </div>
            <button
              type="button"
              onClick={() => setGroupSize((v) => Math.min(maxGroupSize, v + 1))}
              disabled={clampedSize >= maxGroupSize}
              aria-label="增加每組人數"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <input
            id="group-size-slider"
            type="range"
            min={2}
            max={maxGroupSize}
            value={clampedSize}
            onChange={(e) => setGroupSize(Number(e.target.value))}
            className="w-full accent-[#2563EB] cursor-pointer"
          />
          <div className="flex justify-between font-mono text-[11px] text-slate-400 tabular-nums">
            <span>2人</span>
            <span>{Math.round((2 + maxGroupSize) / 2)}人</span>
            <span>{maxGroupSize}人</span>
          </div>
        </div>

        {/* Remainder Strategy */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">餘數分配方式</span>
            {remainderCount > 0 && (
              <span className="text-[11px] text-slate-500 tabular-nums">
                餘 {remainderCount} 人
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setRemainderMode('distribute')}
              className={`rounded-md px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                remainderMode === 'distribute'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              平均併入各組
            </button>
            <button
              type="button"
              onClick={() => setRemainderMode('separate')}
              className={`rounded-md px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                remainderMode === 'separate'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              餘數獨立一組
            </button>
          </div>
        </div>

        {/* Assign Leader Toggle */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="block text-xs font-medium text-slate-700">隨機指派組長</span>
            <span className="text-[11px] text-slate-500">每組自動標記 1 位組長</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={assignLeader}
            onClick={() => setAssignLeader((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
              assignLeader ? 'bg-[#2563EB]' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                assignLeader ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Primary Shuffle CTA */}
        <button
          type="button"
          onClick={() => generate(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1D4ED8] active:scale-[0.99] transition-all cursor-pointer"
        >
          <Shuffle className="h-4 w-4" />
          重新隨機分組
        </button>

        {/* Export & Share Actions */}
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <span className="block text-xs font-medium text-slate-500">輸出分組結果</span>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700">已複製文字至剪貼簿</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  複製文字（適合貼上 LINE / 公告）
                </>
              )}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                匯出 CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                列印分組表
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Right Visual Grouping Stage (~70% width) */}
      <section className="lg:col-span-8 xl:col-span-9 space-y-5 print-full">
        {/* Stage Toolbar */}
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 no-print">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-900 tabular-nums">
              {previewSummary}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            {selectedSwap ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-[#2563EB]">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                已選取「{selectedSwap.studentName}」，請點擊另一位學生互換組別
                <button
                  type="button"
                  onClick={() => setSelectedSwap(null)}
                  className="ml-1 underline text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  取消
                </button>
              </span>
            ) : (
              <span className="text-slate-500">點擊任兩位學生即可手動互換組別</span>
            )}
          </div>

          {/* Visual Mode Switcher */}
          <div
            role="tablist"
            aria-label="分組視覺化檢視模式"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={visualMode === 'cards'}
              onClick={() => setVisualMode('cards')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                visualMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              分組卡片
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={visualMode === 'map'}
              onClick={() => setVisualMode('map')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                visualMode === 'map'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CircleDot className="h-3.5 w-3.5" />
              教室圓桌圖
            </button>
          </div>
        </div>

        {/* Visual Representation */}
        {visualMode === 'cards' ? (
          <div
            key={`cards-${shuffleKey}`}
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {groups.map((group, idx) => {
              const accent = GROUP_ACCENTS[group.colorIndex];
              return (
                <motion.article
                  key={group.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.24,
                    delay: Math.min(idx * 0.035, 0.28),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="overflow-hidden bg-white border border-slate-200 rounded-xl flex flex-col"
                >
                  {/* Clean top 2px color hairline indicator */}
                  <div className={`h-1 w-full ${accent.topBar}`} />

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-baseline justify-between border-b border-slate-100 pb-3">
                      <h3 className={`text-base font-semibold tracking-tight ${accent.text}`}>
                        {group.label}
                      </h3>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {group.members.length} 人
                      </span>
                    </div>

                    <ul className="mt-3 space-y-1.5">
                      {group.members.map((member) => {
                        const isLeader = group.leaderId === member.id;
                        const isSelected = selectedSwap?.studentId === member.id;

                        return (
                          <li key={member.id}>
                            <button
                              type="button"
                              onClick={() => handleStudentClick(group.id, member)}
                              className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-50 ring-1 ring-[#2563EB] text-[#1D4ED8]'
                                  : 'hover:bg-slate-50 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-mono text-[11px] text-slate-400 tabular-nums w-5 text-right shrink-0">
                                  {String(member.seatNo ?? 0).padStart(2, '0')}
                                </span>
                                <span className="text-sm font-medium truncate">
                                  {member.name}
                                </span>
                              </div>
                              {isLeader && (
                                <span className="text-[11px] font-medium text-[#B45309] shrink-0 ml-2">
                                  組長
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </motion.article>
              );
            })}
          </div>
        ) : (
          /* Spatial Classroom Cluster Table Map View */
          <div
            key={`map-${shuffleKey}`}
            className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8"
          >
            {/* Classroom Podium / Whiteboard orientation guide */}
            <div className="mx-auto mb-8 max-w-xs border-b-2 border-slate-300 pb-2 text-center text-xs font-medium text-slate-500 tracking-wide">
              講台 / 黑板方向
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {groups.map((group, idx) => {
                const accent = GROUP_ACCENTS[group.colorIndex];
                const count = group.members.length;
                const radius = count <= 4 ? 92 : count <= 6 ? 98 : 106;

                return (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      duration: 0.28,
                      delay: Math.min(idx * 0.04, 0.3),
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="relative h-[270px] rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-center overflow-hidden"
                  >
                    {/* SVG radial connecting spokes */}
                    <svg
                      viewBox="0 0 280 270"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      aria-hidden="true"
                    >
                      {group.members.map((m, mIdx) => {
                        const angle = (mIdx / count) * Math.PI * 2 - Math.PI / 2;
                        const x2 = 140 + Math.cos(angle) * radius;
                        const y2 = 135 + Math.sin(angle) * (radius * 0.88);
                        return (
                          <line
                            key={m.id}
                            x1={140}
                            y1={135}
                            x2={x2}
                            y2={y2}
                            stroke={accent.nodeBorder}
                            strokeOpacity={0.28}
                            strokeWidth={1.5}
                            strokeDasharray="3 3"
                          />
                        );
                      })}
                    </svg>

                    {/* Center Table Node */}
                    <div
                      style={{
                        backgroundColor: accent.nodeBg,
                        borderColor: accent.nodeBorder,
                      }}
                      className="relative z-10 flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 text-center shadow-2xs"
                    >
                      <span className={`text-sm font-bold ${accent.text}`}>
                        {group.label}
                      </span>
                      <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                        {group.members.length} 人
                      </span>
                    </div>

                    {/* Orbiting Student Seat Nodes */}
                    {group.members.map((member, mIdx) => {
                      const angle = (mIdx / count) * Math.PI * 2 - Math.PI / 2;
                      const offsetX = Math.cos(angle) * radius;
                      const offsetY = Math.sin(angle) * (radius * 0.88);
                      const isLeader = group.leaderId === member.id;
                      const isSelected = selectedSwap?.studentId === member.id;

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleStudentClick(group.id, member)}
                          style={{
                            transform: `translate(${offsetX}px, ${offsetY}px)`,
                          }}
                          className={`absolute z-20 rounded-lg border px-2.5 py-1.5 text-center transition-colors cursor-pointer max-w-[96px] ${
                            isSelected
                              ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-sm'
                              : isLeader
                              ? 'border-[#D97706] bg-amber-50 text-slate-900 hover:bg-amber-100/70'
                              : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                          }`}
                        >
                          <div className="text-xs font-semibold truncate leading-tight">
                            {member.name}
                          </div>
                          {isLeader && (
                            <div
                              className={`text-[10px] leading-tight mt-0.5 ${
                                isSelected ? 'text-blue-100' : 'text-[#B45309]'
                              }`}
                            >
                              組長
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
