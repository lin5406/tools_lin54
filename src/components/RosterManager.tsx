import { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import type { ActiveTab, Student } from '../types/classroom';
import {
  createStudentsFromNames,
  parseNamesFromText,
  readRosterFile,
  SAMPLE_CLASS_NAMES,
} from '../utils/rosterParser';

interface RosterManagerProps {
  students: Student[];
  onReplaceStudents: (next: Student[]) => void;
  onAppendStudents: (added: Student[]) => void;
  onRemoveStudent: (id: string) => void;
  onNavigate: (tab: ActiveTab) => void;
}

export function RosterManager({
  students,
  onReplaceStudents,
  onAppendStudents,
  onRemoveStudent,
  onNavigate,
}: RosterManagerProps) {
  const [pasteText, setPasteText] = useState('');
  const [deduplicate, setDeduplicate] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [singleName, setSingleName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsedPreview = useMemo(
    () => parseNamesFromText(pasteText, { deduplicate }),
    [pasteText, deduplicate]
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.seatNo ?? '').includes(q)
    );
  }, [students, searchQuery]);

  const showToast = (msg: string) => {
    setErrorMessage(null);
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext && !['txt', 'csv', 'tsv'].includes(ext)) {
      setErrorMessage('請上傳 .csv 或 .txt 文字檔（可直接由 Excel 另存為 CSV）。');
      return;
    }
    try {
      const content = await readRosterFile(file);
      const parsed = parseNamesFromText(content, { deduplicate });
      if (parsed.length === 0) {
        setErrorMessage('檔案中未偵測到有效的學生姓名，請確認檔案內容格式。');
        return;
      }
      setPasteText(parsed.join('\n'));
      setErrorMessage(null);
      showToast(`已從「${file.name}」讀取 ${parsed.length} 位學生，請點擊下方按鈕套用。`);
    } catch {
      setErrorMessage('讀取檔案失敗，請重試或直接複製貼上名單文字。');
    }
  };

  const handleApplyReplace = () => {
    if (parsedPreview.length === 0) return;
    onReplaceStudents(createStudentsFromNames(parsedPreview));
    setPasteText('');
    showToast(`已更新班級名單，共 ${parsedPreview.length} 位學生。`);
  };

  const handleApplyAppend = () => {
    if (parsedPreview.length === 0) return;
    const existingSet = new Set(students.map((s) => s.name));
    const toAdd = deduplicate
      ? parsedPreview.filter((name) => !existingSet.has(name))
      : parsedPreview;

    if (toAdd.length === 0) {
      showToast('輸入的學生姓名皆已存在於現有名單中。');
      return;
    }

    const startSeat = students.length + 1;
    const newStudents = createStudentsFromNames(toAdd).map((s, i) => ({
      ...s,
      seatNo: startSeat + i,
    }));
    onAppendStudents(newStudents);
    setPasteText('');
    showToast(`已新增 ${newStudents.length} 位學生至現有名單。`);
  };

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = singleName.trim();
    if (!trimmed) return;
    if (deduplicate && students.some((s) => s.name === trimmed)) {
      setErrorMessage(`「${trimmed}」已在名單中。`);
      return;
    }
    const created = createStudentsFromNames([trimmed])[0];
    created.seatNo = students.length + 1;
    onAppendStudents([created]);
    setSingleName('');
    setErrorMessage(null);
  };

  const handleLoadSample = () => {
    onReplaceStudents(createStudentsFromNames(SAMPLE_CLASS_NAMES));
    setPasteText('');
    showToast(`已載入範例班級（${SAMPLE_CLASS_NAMES.length} 位學生）。`);
  };

  const handleExportCurrentRoster = () => {
    if (students.length === 0) return;
    const csvLines = ['座號,姓名', ...students.map((s, i) => `${s.seatNo ?? i + 1},${s.name}`)];
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '班級學生名單.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Import / Upload / Paste */}
      <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
              匯入學生名單
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              上傳 CSV / TXT 檔案，或直接從 Excel、Google 試算表貼上學生姓名。
            </p>
          </div>
          <button
            type="button"
            onClick={handleLoadSample}
            className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
          >
            載入範例班級（24人）
          </button>
        </div>

        {/* File Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`group rounded-lg border border-dashed p-6 text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] ${
            isDragging
              ? 'border-[#2563EB] bg-blue-50/60'
              : 'border-slate-300 bg-slate-50/70 hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.tsv,text/plain,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 group-hover:text-[#2563EB] transition-colors">
            <Upload className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-800">
            點擊選擇檔案，或將名單拖曳至此處
          </p>
          <p className="mt-1 text-xs text-slate-500">
            支援 .csv、.txt（自動相容 Excel Big5 與 UTF-8 編碼，自動略過座號欄）
          </p>
        </div>

        {/* Paste Textarea */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="roster-paste-input"
              className="text-sm font-medium text-slate-800"
            >
              貼上學生姓名
            </label>
            <span className="text-xs text-slate-500 tabular-nums">
              已辨識 {parsedPreview.length} 位學生
            </span>
          </div>
          <textarea
            id="roster-paste-input"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            placeholder={`每行一位學生，或以逗號、頓號分隔，例如：\n陳冠宇\n林佳穎\n黃柏翰\n張雅婷\n\n也可直接從 Excel 複製「座號＋姓名」貼上`}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15 resize-y leading-relaxed"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={deduplicate}
                onChange={(e) => setDeduplicate(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
              />
              自動過濾重複姓名
            </label>
            {pasteText.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setPasteText('')}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                清空輸入框
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            disabled={parsedPreview.length === 0}
            onClick={handleApplyReplace}
            className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
          >
            取代現有名單（{parsedPreview.length} 人）
          </button>
          <button
            type="button"
            disabled={parsedPreview.length === 0}
            onClick={handleApplyAppend}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
          >
            加入現有名單
          </button>
        </div>

        {/* Status / Error feedback */}
        {statusMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700">
            {errorMessage}
          </div>
        )}
      </section>

      {/* Right Column: Active Class Directory */}
      <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
              目前班級名單
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 tabular-nums">
              <span>共 {students.length} 位學生</span>
              <span aria-hidden="true">·</span>
              <span>已自動儲存於此瀏覽器</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {students.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExportCurrentRoster}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  匯出 CSV
                </button>
                <span className="text-slate-200" aria-hidden="true">
                  |
                </span>
                <button
                  type="button"
                  onClick={() => onReplaceStudents([])}
                  className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  清空全部
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick add + search bar */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <form onSubmit={handleAddSingle} className="flex gap-2">
            <input
              type="text"
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
              placeholder="新增單一位學生..."
              className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
            />
            <button
              type="submit"
              disabled={!singleName.trim()}
              aria-label="新增學生"
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              新增
            </button>
          </form>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋姓名或座號..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
            />
          </div>
        </div>

        {/* Student List Grid */}
        {students.length === 0 ? (
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/60 py-14 px-6 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">目前尚未建立學生名單</p>
            <p className="mt-1 text-xs text-slate-500">
              請在左側貼上名單、上傳檔案，或載入範例班級快速體驗。
            </p>
          </div>
        ) : (
          <div className="mt-5 max-h-[380px] overflow-y-auto pr-1 divide-y divide-slate-100 border-t border-b border-slate-100">
            {filteredStudents.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                找不到符合「{searchQuery}」的學生。
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 gap-x-4">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="group flex items-center justify-between py-2.5 px-2 border-b border-slate-100 hover:bg-slate-50/80 transition-colors rounded"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-slate-400 tabular-nums w-6 text-right shrink-0">
                        {String(student.seatNo ?? 0).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-medium text-slate-800 truncate">
                        {student.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveStudent(student.id)}
                      aria-label={`移除 ${student.name}`}
                      className="p-1.5 text-slate-300 hover:text-red-600 transition-colors rounded cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick next step links */}
        {students.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs text-slate-500">名單已就緒，立即進入課堂活動：</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('picker')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors whitespace-nowrap cursor-pointer"
              >
                隨機抽籤
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('groups')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors whitespace-nowrap cursor-pointer"
              >
                自動分組
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
