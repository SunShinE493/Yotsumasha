// Types & constants for the Aura Timetable app

export interface Course {
  id: string;
  name: string;
  room: string;
  teacher: string;
  color: string;
  syllabus?: string[]; // Array of 15 strings for each lesson
  // v2.2 Advanced Syllabus
  className?: string;  // クラス
  objectives?: string; // 授業の目標
  content?: string;    // 学修内容
  requirements?: string; // 受講要件
  textbook?: string;   // テキスト
  references?: string; // 参考書
  preparation?: string; // 予習・復習
  grading?: string;    // 成績評価
  driveFolderId?: string; // Google Drive folder ID for this course
}

export interface TimetableEntry {
  courseId: string;
  slotOffset?: 'none' | 'second-half' | 'first-half';
}

// day (0-6 for Mon-Sun), period (0-based index)
export type TimetableData = Record<string, TimetableEntry>; // key = `${day}-${period}`

export interface PeriodTime {
  start: string; // "HH:MM"
  end: string;
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  targetDate?: string;      // Specific date "YYYY-MM-DD"
  targetDayOfWeek?: number; // 0:Mon, 1:Tue, ... (Legacy)
  originalDay?: number;     // 0:Mon, 1:Tue, ... (For display)
  courseId?: string;        // ID of the linked course
}

export interface SemesterSettings {
  start: string;
  end: string;
}

export interface SpecialPeriod {
  id: string;
  type: 'exam' | 'holiday' | 'summer' | 'custom';
  name: string;
  start: string;
  end: string;
}

export interface TimetableState {
  courses: Course[];
  timetable: TimetableData;
  periods: PeriodTime[];
  dayLabels: string[];
  showWeekend: boolean;
  todos: Todo[];
  semesterSettings: SemesterSettings;
  specialPeriods: SpecialPeriod[];
  selectedCalendarId: string;
  // v2 fields
  appMode: 'view' | 'edit';
  dayOverrides: Record<string, number>; // "2026-04-15": 2 (means Wednesday)
  transitionHour: number; // 0-23, default 19
  mobileTodoDateEnabled: boolean;
  syllabusDisplayEnabled: boolean;
  // Drive & Settings
  rootFolderId?: string;
  todoPriorityMode: 'date-first' | 'no-date-first';
  gasSyncUrl?: string; // URL for GAS Web App
  holidays: Record<string, string>; // "YYYY-MM-DD": "Holiday Name"
  cellOverrides: Record<string, TimetableEntry>; // "YYYY-MM-DD-periodIndex": { courseId, ... }
  showGridTodoBadges: boolean;
  showTodoCountdown: boolean;
  customBackground?: string;
  updatedAt: number;
  userId?: string;
}

export const COURSE_COLORS = [
  'hsl(220, 90%, 65%)',  // blue
  'hsl(265, 80%, 65%)',  // purple
  'hsl(330, 80%, 65%)',  // pink
  'hsl(160, 70%, 50%)',  // green
  'hsl(30, 90%, 60%)',   // orange
  'hsl(190, 80%, 55%)',  // cyan
  'hsl(0, 75%, 60%)',    // red
  'hsl(45, 90%, 60%)',   // yellow
  'hsl(280, 60%, 55%)',  // violet
  'hsl(140, 60%, 45%)',  // teal
];

export const DEFAULT_PERIODS: PeriodTime[] = [
  { start: '08:40', end: '10:10' },
  { start: '10:20', end: '11:50' },
  { start: '12:45', end: '14:15' },
  { start: '14:25', end: '15:55' },
  { start: '16:05', end: '17:35' },
  { start: '17:50', end: '19:20' },
];

export const DAY_LABELS_FULL = ['月', '火', '水', '木', '金', '土', '日'];
export const DAY_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const STORAGE_KEY = 'aura-timetable-data';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function getDefaultState(): TimetableState {
  const now = new Date();
  const year = now.getFullYear();
  return {
    courses: [],
    timetable: {},
    periods: [...DEFAULT_PERIODS],
    dayLabels: [...DAY_LABELS_FULL],
    showWeekend: false,
    todos: [],
    semesterSettings: {
      start: `${year}-04-01`,
      end: `${year}-09-30`,
    },
    specialPeriods: [],
    selectedCalendarId: 'primary',
    appMode: 'view',
    dayOverrides: {},
    transitionHour: 19,
    mobileTodoDateEnabled: false,
    syllabusDisplayEnabled: true,
    todoPriorityMode: 'date-first',
    holidays: {},
    cellOverrides: {},
    showGridTodoBadges: true,
    showTodoCountdown: false,
    updatedAt: 0,
    userId: undefined,
  };
}

export function getTodayIndex(): number {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, ...
  // Convert to our 0=Mon...6=Sun
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function cellKey(day: number | string, period: number): string {
  return day + '-' + period;
}

export function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getContrastYIQ(colorStr: string): string {
  if (!colorStr) return '#ffffff';
  let r = 0, g = 0, b = 0;
  colorStr = colorStr.trim();
  
  const matchHsl = colorStr.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (matchHsl) {
    let h = parseInt(matchHsl[1]) / 360;
    let s = parseInt(matchHsl[2]) / 100;
    let l = parseInt(matchHsl[3]) / 100;
    if (s === 0) { r = g = b = l * 255; }
    else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if(t < 0) t += 1;
        if(t > 1) t -= 1;
        if(t < 1/6) return p + (q - p) * 6 * t;
        if(t < 1/2) return q;
        if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3) * 255;
      g = hue2rgb(p, q, h) * 255;
      b = hue2rgb(p, q, h - 1/3) * 255;
    }
  } else if (colorStr.startsWith('#')) {
    const hex = colorStr.replace('#', '');
    if (hex.length === 3) {
      r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
      g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
      b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (colorStr.startsWith('rgb')) {
    const matchRgb = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (matchRgb) {
      r = parseInt(matchRgb[1]);
      g = parseInt(matchRgb[2]);
      b = parseInt(matchRgb[3]);
    }
  }

  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}
