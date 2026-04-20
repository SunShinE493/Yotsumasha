'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  TimetableState,
  Course,
  TimetableData,
  PeriodTime,
  Todo,
  SemesterSettings,
  SpecialPeriod,
  STORAGE_KEY,
  getDefaultState,
  generateId,
  cellKey,
  DEFAULT_PERIODS,
} from './types';

interface TimetableContextValue {
  state: TimetableState;
  addCourse: (course: Omit<Course, 'id'>) => Course;
  updateCourse: (course: Course) => void;
  deleteCourse: (id: string) => void;
  setCellCourse: (day: number, period: number, courseId: string | null, slotOffset?: 'none' | 'second-half' | 'first-half') => void;
  updatePeriods: (periods: PeriodTime[]) => void;
  toggleWeekend: () => void;
  getCourse: (day: number, period: number) => Course | undefined;
  importState: (data: TimetableState) => void;
  mergeState: (data: Partial<TimetableState>) => void;
  resetAll: () => void;
  // New features
  addTodo: (text: string, targetDate?: string, targetDayOfWeek?: number, courseId?: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  updateTodo: (todo: Todo) => void;
  updateSemester: (settings: SemesterSettings) => void;
  addSpecialPeriod: (period: Omit<SpecialPeriod, 'id'>) => void;
  deleteSpecialPeriod: (id: string) => void;
  setSelectedCalendarId: (id: string) => void;
  // v2 methods
  setAppMode: (mode: 'view' | 'edit') => void;
  setDayOverride: (date: string, dayIndex: number | null) => void;
  updateTransitionHour: (hour: number) => void;
  setMobileTodoDateEnabled: (enabled: boolean) => void;
  setSyllabusDisplayEnabled: (enabled: boolean) => void;
  setRootFolderId: (id: string) => void;
  setTodoPriorityMode: (mode: 'date-first' | 'no-date-first') => void;
  setGasSyncUrl: (url: string) => void;
  setShowGridTodoBadges: (show: boolean) => void;
  setCustomBackground: (color: string) => void;
}

const TimetableContext = createContext<TimetableContextValue | null>(null);

function getNextDateStr(dayIndex: number): string {
  const now = new Date();
  const todayJsDay = now.getDay(); // 0=Sun, 1=Mon...
  const todayIndex = todayJsDay === 0 ? 6 : todayJsDay - 1; // 0=Mon...6=Sun
  
  let diff = dayIndex - todayIndex;
  // User said "次の〇曜日" (Next X day). 
  // If it's today, we treat it as today. If it's passed, we go to next week.
  if (diff < 0) diff += 7;
  
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  return target.toISOString().split('T')[0];
}

export function TimetableProvider({ children }: { children: ReactNode }) {
  const [state, setRawState] = useState<TimetableState>(getDefaultState);
  const [loaded, setLoaded] = useState(false);

  const setState = useCallback((updater: React.SetStateAction<TimetableState>, skipUpdateTs?: boolean) => {
    setRawState(prev => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      if (skipUpdateTs) return next;
      return { ...next, updatedAt: Date.now() };
    });
  }, []);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TimetableState;
        
        // マイグレーション: 古いデフォルト時間のままであれば、新デフォルト時間に書き換える
        const oldPeriodsStr = '[{"start":"09:00","end":"10:30"},{"start":"10:40","end":"12:10"},{"start":"13:00","end":"14:30"},{"start":"14:40","end":"16:10"},{"start":"16:20","end":"17:50"},{"start":"18:00","end":"19:30"}]';
        if (parsed.periods && JSON.stringify(parsed.periods) === oldPeriodsStr) {
          parsed.periods = [...DEFAULT_PERIODS];
        }

        const defaults = getDefaultState();
        setState({
          ...defaults,
          ...parsed,
        }, true);
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, loaded]);

  // Fetch holidays on load
  useEffect(() => {
    fetch('https://holidays-jp.github.io/api/v1/date.json')
      .then(res => res.json())
      .then(data => {
        setState(prev => ({ ...prev, holidays: data }));
      })
      .catch(err => console.error('Failed to fetch holidays:', err));
  }, []);

  const addCourse = useCallback((data: Omit<Course, 'id'>): Course => {
    const course: Course = { ...data, id: generateId() };
    setState(prev => ({ ...prev, courses: [...prev.courses, course] }));
    return course;
  }, []);

  const updateCourse = useCallback((course: Course) => {
    setState(prev => ({
      ...prev,
      courses: prev.courses.map(c => (c.id === course.id ? course : c)),
    }));
  }, []);

  const deleteCourse = useCallback((id: string) => {
    setState(prev => {
      const newTimetable: TimetableData = {};
      for (const [k, v] of Object.entries(prev.timetable)) {
        if (v.courseId !== id) newTimetable[k] = v;
      }
      return {
        ...prev,
        courses: prev.courses.filter(c => c.id !== id),
        timetable: newTimetable,
      };
    });
  }, []);

  const setCellCourse = useCallback((day: number, period: number, courseId: string | null, slotOffset?: 'none' | 'second-half' | 'first-half') => {
    const key = cellKey(day, period);
    setState(prev => {
      const newTimetable = { ...prev.timetable };
      if (courseId) {
        newTimetable[key] = { courseId, slotOffset };
      } else {
        delete newTimetable[key];
      }
      return { ...prev, timetable: newTimetable };
    });
  }, []);

  const updatePeriods = useCallback((periods: PeriodTime[]) => {
    setState(prev => ({ ...prev, periods }));
  }, []);

  const toggleWeekend = useCallback(() => {
    setState(prev => ({ ...prev, showWeekend: !prev.showWeekend }));
  }, []);

  const getCourse = useCallback(
    (day: number, period: number): Course | undefined => {
      const entry = state.timetable[cellKey(day, period)];
      if (!entry) return undefined;
      return state.courses.find(c => c.id === entry.courseId);
    },
    [state.timetable, state.courses]
  );

  const importState = useCallback((data: TimetableState) => {
    setState(data, true);
  }, []);

  const mergeState = useCallback((data: Partial<TimetableState>) => {
    setState(prev => {
      let newCourses = [...prev.courses];
      const newTimetable = { ...prev.timetable };

      if (data.courses) {
        data.courses.forEach(c => {
          const existingIdx = newCourses.findIndex(ec => ec.name === c.name);
          if (existingIdx !== -1) {
            newCourses[existingIdx] = { ...newCourses[existingIdx], ...c, id: newCourses[existingIdx].id };
          } else {
            newCourses.push(c);
          }
        });
      }

      if (data.timetable) {
        Object.entries(data.timetable).forEach(([k, v]) => {
          newTimetable[k] = v;
        });
      }

      return {
        ...prev,
        courses: newCourses,
        timetable: newTimetable,
      };
    });
  }, []);

  const resetAll = useCallback(() => {
    setState(getDefaultState());
  }, []);

  // Todo features
  const addTodo = useCallback((text: string, targetDate?: string, targetDayOfWeek?: number, courseId?: string) => {
    let finalDate = targetDate;
    let originalDay = targetDayOfWeek;
    
    if (targetDayOfWeek !== undefined) {
      finalDate = getNextDateStr(targetDayOfWeek);
    }
    
    setState(prev => ({
      ...prev,
      todos: [...prev.todos, { 
        id: generateId(), 
        text: text.trim(), 
        completed: false, 
        targetDate: finalDate, 
        originalDay,
        courseId
      }],
    }));
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      todos: prev.todos.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)),
    }));
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      todos: prev.todos.filter(t => t.id !== id),
    }));
  }, []);

  const updateTodo = useCallback((todo: Todo) => {
    setState(prev => ({
      ...prev,
      todos: prev.todos.map(t => (t.id === todo.id ? todo : t)),
    }));
  }, []);

  const updateSemester = useCallback((semesterSettings: SemesterSettings) => {
    setState(prev => ({ ...prev, semesterSettings }));
  }, []);

  const addSpecialPeriod = useCallback((data: Omit<SpecialPeriod, 'id'>) => {
    setState(prev => ({
      ...prev,
      specialPeriods: [...prev.specialPeriods, { ...data, id: generateId() }],
    }));
  }, []);

  const deleteSpecialPeriod = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      specialPeriods: prev.specialPeriods.filter(p => p.id !== id),
    }));
  }, []);

  const setSelectedCalendarId = useCallback((selectedCalendarId: string) => {
    setState(prev => ({ ...prev, selectedCalendarId }));
  }, []);

  const setAppMode = useCallback((appMode: 'view' | 'edit') => {
    setState(prev => ({ ...prev, appMode }));
  }, []);

  const setDayOverride = useCallback((date: string, dayIndex: number | null) => {
    setState(prev => {
      const dayOverrides = { ...prev.dayOverrides };
      if (dayIndex === null) {
        delete dayOverrides[date];
      } else {
        dayOverrides[date] = dayIndex;
      }
      return { ...prev, dayOverrides };
    });
  }, []);

  const updateTransitionHour = useCallback((transitionHour: number) => {
    setState(prev => ({ ...prev, transitionHour }));
  }, []);

  const setMobileTodoDateEnabled = useCallback((mobileTodoDateEnabled: boolean) => {
    setState(prev => ({ ...prev, mobileTodoDateEnabled }));
  }, []);

  const setSyllabusDisplayEnabled = useCallback((syllabusDisplayEnabled: boolean) => {
    setState(prev => ({ ...prev, syllabusDisplayEnabled }));
  }, []);

  const setRootFolderId = useCallback((rootFolderId: string) => {
    setState(prev => ({ ...prev, rootFolderId }));
  }, []);

  const setTodoPriorityMode = useCallback((todoPriorityMode: 'date-first' | 'no-date-first') => {
    setState(prev => ({ ...prev, todoPriorityMode }));
  }, []);

  const setGasSyncUrl = useCallback((gasSyncUrl: string) => {
    setState(prev => ({ ...prev, gasSyncUrl }));
  }, []);

  const setShowGridTodoBadges = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showGridTodoBadges: show }));
  }, []);

  const setCustomBackground = useCallback((color: string) => {
    setState(prev => ({ ...prev, customBackground: color }));
  }, []);

  return (
    <TimetableContext.Provider
      value={{
        state,
        addCourse,
        updateCourse,
        deleteCourse,
        setCellCourse,
        updatePeriods,
        toggleWeekend,
        getCourse,
        importState,
        mergeState,
        resetAll,
        addTodo,
        toggleTodo,
        deleteTodo,
        updateTodo,
        updateSemester,
        addSpecialPeriod,
        deleteSpecialPeriod,
        setSelectedCalendarId,
        setAppMode,
        setDayOverride,
        updateTransitionHour,
        setMobileTodoDateEnabled,
        setSyllabusDisplayEnabled,
        setRootFolderId,
        setTodoPriorityMode,
        setGasSyncUrl,
        setShowGridTodoBadges,
        setCustomBackground,
      }}
    >
      {loaded ? children : null}
    </TimetableContext.Provider>
  );
}

export function useTimetable(): TimetableContextValue {
  const ctx = useContext(TimetableContext);
  if (!ctx) throw new Error('useTimetable must be used within TimetableProvider');
  return ctx;
}
