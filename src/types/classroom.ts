export interface Student {
  id: string;
  name: string;
  seatNo?: number;
}

export interface DrawRecord {
  id: string;
  studentId: string;
  studentName: string;
  drawnAt: string;
  round: number;
}

export interface Group {
  id: string;
  index: number;
  label: string;
  members: Student[];
  leaderId: string | null;
  colorIndex: number;
}

export type ActiveTab = 'picker' | 'groups' | 'roster';

export type SoundPreset = 'marimba' | 'wheel' | 'muted';

export type PickerVisualMode = 'reel' | 'grid';

export type DrawDuration = 'fast' | 'normal' | 'dramatic';

export type RemainderMode = 'distribute' | 'separate';

export type GroupVisualMode = 'cards' | 'map';
