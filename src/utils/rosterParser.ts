import type { Student } from '../types/classroom';

export const SAMPLE_CLASS_NAMES: string[] = [
  '陳冠宇',
  '林佳穎',
  '黃柏翰',
  '張雅婷',
  '李承恩',
  '王怡君',
  '吳宗翰',
  '劉詩涵',
  '蔡明哲',
  '楊千慧',
  '許家豪',
  '鄭宇晴',
  '謝品睿',
  '郭芷瑄',
  '洪廷威',
  '曾品妍',
  '邱柏鈞',
  '周沛璇',
  '廖子軒',
  '徐若寧',
  '賴彥廷',
  '莊羽彤',
  '葉秉融',
  '簡宜蓁',
];

const HEADER_KEYWORDS = new Set([
  '姓名',
  '學生姓名',
  '名字',
  '學生',
  '座號',
  '學號',
  '編號',
  '班級',
  'name',
  'student',
  'student name',
  'id',
  'no',
  'number',
]);

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `stu_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parses pasted text or uploaded TXT/CSV content into a clean list of student names.
 * Supports newlines, commas, Chinese commas, semicolons, and Excel tab-separated rows.
 */
export function parseNamesFromText(
  rawText: string,
  options: { deduplicate?: boolean } = { deduplicate: true }
): string[] {
  const cleaned = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];

  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const extracted: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line looks like CSV or TSV tabular row (e.g., "1,陳冠宇" or "01\t林佳穎")
    const tabCols = line.split('\t').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (tabCols.length >= 2) {
      // Skip header row
      if (i === 0 && tabCols.some((c) => HEADER_KEYWORDS.has(c.toLowerCase()))) {
        continue;
      }
      // Pick the first column that is not purely numeric/empty
      const nameCol = tabCols.find((c) => c.length > 0 && !/^\d+$/.test(c));
      if (nameCol && !HEADER_KEYWORDS.has(nameCol.toLowerCase())) {
        extracted.push(nameCol);
      }
      continue;
    }

    // Check if single line has multiple names separated by commas / Chinese enumeration commas
    const parts = line
      .split(/[,，、;；]+/)
      .map((p) => p.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);

    if (parts.length === 0) continue;

    // Skip CSV header row like "座號,姓名"
    if (i === 0 && parts.some((p) => HEADER_KEYWORDS.has(p.toLowerCase()))) {
      continue;
    }

    // If it's a 2-column row like "01,陳冠宇" or "10101,林佳穎", treat as [seat/id, name]
    if (parts.length === 2 && /^\d+$/.test(parts[0]) && !/^\d+$/.test(parts[1])) {
      extracted.push(parts[1]);
      continue;
    }

    // If it's a 3+ column CSV row where the first column is numeric (seat/ID) and second is name
    if (
      parts.length >= 3 &&
      /^\d+$/.test(parts[0]) &&
      !/^\d+$/.test(parts[1]) &&
      lines.length >= 3
    ) {
      // Heuristic: if most lines look like structured CSV records, extract the name column
      extracted.push(parts[1]);
      continue;
    }

    // Otherwise treat each part as a student name (e.g. "王小明、陳大華、林美玲")
    for (const part of parts) {
      // Strip leading numbering like "1. 陳冠宇" or "01) 陳冠宇"
      const normalized = part.replace(/^\d+[.)、.\s]+/, '').trim();
      if (normalized && !HEADER_KEYWORDS.has(normalized.toLowerCase())) {
        extracted.push(normalized);
      }
    }
  }

  if (options.deduplicate) {
    const seen = new Set<string>();
    return extracted.filter((name) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }

  return extracted;
}

export function createStudentsFromNames(names: string[]): Student[] {
  return names.map((name, idx) => ({
    id: generateId(),
    name,
    seatNo: idx + 1,
  }));
}

/**
 * Reads an uploaded TXT/CSV file with automatic UTF-8 / Big5 fallback for Traditional Chinese Excel exports.
 */
export async function readRosterFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
  const utf8Text = utf8Decoder.decode(buffer);

  // If UTF-8 produced replacement characters (\uFFFD), retry with Big5 (common for Taiwan Excel CSVs)
  if (utf8Text.includes('\uFFFD')) {
    try {
      const big5Decoder = new TextDecoder('big5');
      return big5Decoder.decode(buffer);
    } catch {
      return utf8Text;
    }
  }
  return utf8Text;
}
