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
  showGridTodoBadges: boolean;
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
  { start: '09:00', end: '10:30' },
  { start: '10:40', end: '12:10' },
  { start: '13:00', end: '14:30' },
  { start: '14:40', end: '16:10' },
  { start: '16:20', end: '17:50' },
  { start: '18:00', end: '19:30' },
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
    showGridTodoBadges: true,
  };
}

export function getTodayIndex(): number {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, ...
  // Convert to our 0=Mon...6=Sun
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function cellKey(day: number, period: number): string {
  return day + '-' + period;
}
