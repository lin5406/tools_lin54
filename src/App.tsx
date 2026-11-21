/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { ActiveTab, DrawRecord, SoundPreset, Student } from './types/classroom';
import { createStudentsFromNames, SAMPLE_CLASS_NAMES } from './utils/rosterParser';
import { RandomPicker } from './components/RandomPicker';
import { GroupMaker } from './components/GroupMaker';
import { RosterManager } from './components/RosterManager';

const STORAGE_KEYS = {
  students: 'classroom_hub_students_v1',
  history: 'classroom_hub_history_v1',
  allowRepeat: 'classroom_hub_allow_repeat_v1',
  soundPreset: 'classroom_hub_sound_preset_v1',
};

function loadInitialStudents(): Student[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.students);
    if (raw) {
      const parsed = JSON.parse(raw) as Student[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return createStudentsFromNames(SAMPLE_CLASS_NAMES);
}

function loadInitialHistory(): DrawRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    if (raw) {
      const parsed = JSON.parse(raw) as DrawRecord[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }
  return [];
}

function loadInitialBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
}

function loadInitialSound(): SoundPreset {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.soundPreset);
    if (raw === 'marimba' || raw === 'wheel' || raw === 'muted') {
      return raw;
    }
  } catch {
    // Ignore
  }
  return 'marimba';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('picker');
  const [students, setStudents] = useState<Student[]>(loadInitialStudents);
  const [history, setHistory] = useState<DrawRecord[]>(loadInitialHistory);
  const [allowRepeat, setAllowRepeat] = useState<boolean>(() =>
    loadInitialBoolean(STORAGE_KEYS.allowRepeat, false)
  );
  const [soundPreset, setSoundPreset] = useState<SoundPreset>(loadInitialSound);
  const [isProjectorMode, setIsProjectorMode] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(students));
    } catch {
      // Ignore quota errors
    }
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
    } catch {
      // Ignore
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.allowRepeat, String(allowRepeat));
    } catch {
      // Ignore
    }
  }, [allowRepeat]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.soundPreset, soundPreset);
    } catch {
      // Ignore
    }
  }, [soundPreset]);

  // Listen for browser fullscreen exit
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsProjectorMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleProjectorMode = useCallback(() => {
    setIsProjectorMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.requestFullscreen?.().catch(() => {
          // Gracefully use expanded layout even if iframe disallows native fullscreen
        });
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      return next;
    });
  }, []);

  const handleReplaceStudents = useCallback((next: Student[]) => {
    setStudents(next);
    setHistory([]);
  }, []);

  const handleAppendStudents = useCallback((added: Student[]) => {
    setStudents((prev) => {
      const combined = [...prev, ...added];
      return combined.map((s, idx) => ({ ...s, seatNo: idx + 1 }));
    });
  }, []);

  const handleRemoveStudent = useCallback((id: string) => {
    setStudents((prev) =>
      prev
        .filter((s) => s.id !== id)
        .map((s, idx) => ({ ...s, seatNo: idx + 1 }))
    );
    setHistory((prev) => prev.filter((r) => r.studentId !== id));
  }, []);

  const handleRecordDraw = useCallback((student: Student) => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    setHistory((prev) => {
      const nextRound = prev.length > 0 ? prev[0].round + 1 : 1;
      const record: DrawRecord = {
        id: `draw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        studentId: student.id,
        studentName: student.name,
        drawnAt: `${hh}:${mm}:${ss}`,
        round: nextRound,
      };
      return [record, ...prev];
    });
  }, []);

  const handleRestoreRecord = useCallback((recordId: string) => {
    setHistory((prev) => prev.filter((r) => r.id !== recordId));
  }, []);

  const handleResetHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'picker', label: '隨機抽籤' },
    { id: 'groups', label: '自動分組' },
    { id: 'roster', label: '名單管理' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FB] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar */}
      <header className="bg-white border-b border-slate-200 no-print">
        <div
          className={`mx-auto flex items-center justify-between gap-8 px-6 h-16 ${
            isProjectorMode ? 'max-w-[1440px]' : 'max-w-[1280px]'
          }`}
        >
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('picker')}
            className="text-lg font-bold tracking-tight text-slate-900 hover:text-[#2563EB] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            點名分組台
          </button>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav
            aria-label="主要功能導覽"
            className="flex items-center gap-6 sm:gap-8 text-sm font-medium"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-slate-950'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-[#2563EB]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={toggleProjectorMode}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isProjectorMode ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">退出投影</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">投影模式</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main
        className={`flex-1 w-full mx-auto px-6 py-7 sm:py-8 ${
          isProjectorMode ? 'max-w-[1440px]' : 'max-w-[1280px]'
        }`}
      >
        {/* Quiet contextual summary strip (unboxed text metadata) */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 no-print">
          <div className="flex flex-wrap items-center gap-2 tabular-nums">
            <span className="font-medium text-slate-700">
              {activeTab === 'picker'
                ? '課堂隨機抽籤'
                : activeTab === 'groups'
                ? '自動分組與視覺化座位'
                : '學生名單來源設定'}
            </span>
            <span aria-hidden="true">·</span>
            <span>目前名單共 {students.length} 位學生</span>
          </div>

          {activeTab !== 'roster' && (
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] underline underline-offset-4 whitespace-nowrap cursor-pointer"
            >
              更換或上傳名單
            </button>
          )}
        </div>

        {activeTab === 'picker' && (
          <RandomPicker
            students={students}
            allowRepeat={allowRepeat}
            onAllowRepeatChange={setAllowRepeat}
            soundPreset={soundPreset}
            onSoundPresetChange={setSoundPreset}
            history={history}
            onRecordDraw={handleRecordDraw}
            onRestoreRecord={handleRestoreRecord}
            onResetHistory={handleResetHistory}
            onNavigate={setActiveTab}
            isProjectorMode={isProjectorMode}
          />
        )}

        {activeTab === 'groups' && (
          <GroupMaker
            students={students}
            soundPreset={soundPreset}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'roster' && (
          <RosterManager
            students={students}
            onReplaceStudents={handleReplaceStudents}
            onAppendStudents={handleAppendStudents}
            onRemoveStudent={handleRemoveStudent}
            onNavigate={setActiveTab}
          />
        )}
      </main>
    </div>
  );
}
