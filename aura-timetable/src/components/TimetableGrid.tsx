'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTimetable } from '@/lib/store';
import { getTodayIndex, Course, cellKey, getContrastYIQ } from '@/lib/types';
import CourseEditor from './CourseEditor';
import CourseDetail from './CourseDetail';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function TimetableGrid() {
  const { state, getCourse } = useTimetable();
  const [viewMode, setViewMode] = useState<'today' | 'weekly'>('today');
  const [activeDayOffset, setActiveDayOffset] = useState(0); 
  const [editTarget, setEditTarget] = useState<{ day: number; period: number; course?: Course } | null>(null);
  const [detailTarget, setDetailTarget] = useState<{ course: Course, lessonCount: number, dayIndex: number } | null>(null);

  // Transition to Tomorrow logic
  const todayIndexRaw = useMemo(() => getTodayIndex(), []);
  const todayIndex = useMemo(() => {
    const now = new Date();
    if (now.getHours() >= state.transitionHour) {
       return (todayIndexRaw + 1) % 7;
    }
    return todayIndexRaw;
  }, [todayIndexRaw, state.transitionHour]);

  const dayCount = state.showWeekend ? 7 : 5;
  const days = Array.from({ length: dayCount }, (_, i) => i);

  // Current logical day index (for today view)
  const currentDayIndex = useMemo(() => {
    let idx = (todayIndex + activeDayOffset) % 7;
    if (idx < 0) idx += 7;
    
    // Check for Day Overrides
    const dateStr = getDateForDay(idx, todayIndexRaw).toISOString().split('T')[0];
    if (state.dayOverrides[dateStr] !== undefined) {
       return state.dayOverrides[dateStr];
    }
    return idx;
  }, [todayIndex, activeDayOffset, state.dayOverrides, todayIndexRaw]);

  const handleCellClick = (dayIdx: number, periodIdx: number, targetDate?: Date, effectiveDay?: number) => {
    const finalDay = effectiveDay ?? dayIdx;
    const course = getCourse(finalDay, periodIdx);
    
    if (state.appMode === 'edit') {
      setEditTarget({ day: finalDay, period: periodIdx, course });
    } else if (course) {
      const date = targetDate ?? getDateForDay(isToday ? (todayIndex + activeDayOffset) : dayIdx, todayIndexRaw);
      const lessonCount = getLessonCount(date, finalDay, state);
      setDetailTarget({ course, lessonCount, dayIndex: finalDay });
    }
  };

  const swipe = (direction: number) => {
    setActiveDayOffset(prev => prev + direction);
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold) swipe(1);
    else if (info.offset.x > threshold) swipe(-1);
  };

  const isToday = viewMode === 'today';
  const visibleDays = isToday ? [currentDayIndex] : days;
  const currentDayLabel = state.dayLabels[currentDayIndex] ?? '';

  return (
    <div className="timetable-wrapper">
      <div className="view-header">
        <div className="view-toggle">
          <button
            className={`view-toggle__btn ${isToday ? 'view-toggle__btn--active' : ''}`}
            onClick={() => { setViewMode('today'); setActiveDayOffset(0); }}
          >
            今日
          </button>
          <button
            className={`view-toggle__btn ${!isToday ? 'view-toggle__btn--active' : ''}`}
            onClick={() => setViewMode('weekly')}
          >
            週間
          </button>
        </div>

        {isToday && (
          <div className="day-nav-controls">
             <button className="btn btn-icon btn-ghost" onClick={() => swipe(-1)}>
               <ChevronLeft size={20} />
             </button>
             <button className="btn btn-ghost" style={{fontSize: '0.8rem', padding: '4px 8px'}} onClick={() => setActiveDayOffset(0)}>今日</button>
             <button className="btn btn-icon btn-ghost" onClick={() => swipe(1)}>
               <ChevronRight size={20} />
             </button>
          </div>
        )}
      </div>

      <div className="timetable-container" style={{ position: 'relative', overflow: 'hidden' }}>
        <motion.div 
          className={`timetable__grid ${isToday ? 'timetable__grid--today' : 'timetable__grid--weekly'}`}
          style={!isToday ? { '--day-count': dayCount } as React.CSSProperties : undefined}
          drag={isToday ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          key={isToday ? `grid-${currentDayIndex}-${activeDayOffset}` : 'grid-weekly'}
          initial={{ opacity: 0, x: isToday ? 20 : 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 250 }}
        >
          {/* Corner cell */}
          <div className="timetable__header timetable__header--corner">
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>時限</span>
          </div>

          {/* Day headers */}
          {visibleDays.map(day => {
             const isHighlight = day === todayIndex;
             const displayDate = getDateForDay(isToday ? (todayIndex + activeDayOffset) : day, todayIndexRaw);
             const dateStr = displayDate.toISOString().split('T')[0];
             const holidayName = state.holidays[dateStr];
             
             return (
               <div key={`header-${day}`} className={`timetable__header ${isHighlight ? 'timetable__header--today-highlight' : ''} ${holidayName ? 'timetable__header--holiday' : ''}`}>
                 <span>{state.dayLabels[day]}</span>
                 <span className={`day-date ${holidayName ? 'day-date--holiday' : ''}`}>{formatDate(displayDate)}</span>
                 {holidayName && <span className="holiday-label" title={holidayName}>{holidayName}</span>}
               </div>
             );
          })}

          {/* Period rows */}
          {state.periods.map((p, pi) => (
            <React.Fragment key={`row-${pi}`}>
              <div className="timetable__period-label">
                <span className="period-num">{pi + 1}</span>
                <span className="period-time">{p.start}</span>
              </div>
              {visibleDays.map(di => {
                const targetDate = getDateForDay(isToday ? (todayIndex + activeDayOffset) : di, todayIndexRaw);
                const dateStr = formatDateYMD(targetDate);
                const isHoliday = !!state.holidays[dateStr];
                const hasOverride = state.dayOverrides[dateStr] !== undefined;
                const effectiveDayIndex = hasOverride ? state.dayOverrides[dateStr] : di;
                const isOutsideSemester = dateStr < state.semesterSettings.start || dateStr > state.semesterSettings.end;

                const course = getCourse(effectiveDayIndex, pi);
                const entry = state.timetable[cellKey(effectiveDayIndex, pi)];
                const lessonCount = getLessonCount(targetDate, effectiveDayIndex, state);

                return (
                  <div
                    key={`cell-${di}-${pi}`}
                    className={`timetable__cell ${state.appMode === 'view' ? 'timetable__cell--readonly' : ''} ${entry?.slotOffset ? `timetable__cell--${entry.slotOffset}` : ''} ${isHoliday ? 'timetable__cell--holiday' : ''} ${isOutsideSemester ? 'timetable__cell--outside' : ''}`}
                    onClick={() => handleCellClick(di, pi, targetDate, effectiveDayIndex)}
                  >
                    {!isHoliday || hasOverride ? (
                      course ? (
                        <div
                          className={`course-card ${entry?.slotOffset ? `course-card--${entry.slotOffset}` : ''}`}
                          style={{ 
                            '--course-color': course.color, 
                            background: course.color, 
                            color: getContrastYIQ(course.color),
                            opacity: isOutsideSemester ? 0.4 : 1 
                          } as React.CSSProperties}
                        >
                          {isOutsideSemester && <div className="outside-label">期間外</div>}
                          {hasOverride && <div className="override-badge">振替</div>}
                          <span className="course-card__name">{course.name}</span>
                          {course.room && <span className="course-card__room">📍 {course.room}</span>}
                          {(state.syllabusDisplayEnabled && course.syllabus && course.syllabus[lessonCount - 1]) && (
                            <div className="course-card__syllabus">
                              <span className="syllabus-idx">第{lessonCount}回</span>
                              <p className="syllabus-text">{course.syllabus[lessonCount - 1]}</p>
                            </div>
                          )}
                          {isToday && (
                            <div className="course-card__tasks">
                              {state.todos
                                .filter(t => t.courseId === course.id && !t.completed)
                                .map(t => (
                                  <div key={t.id} className="task-mini-item">
                                    <div className="task-dot" />
                                    <span>{t.text}</span>
                                  </div>
                                ))}
                            </div>
                          )}
                          {!isToday && state.showGridTodoBadges && state.todos.some(t => t.courseId === course.id && !t.completed) && (
                            <div className="course-todo-badge" />
                          )}
                        </div>
                      ) : state.appMode === 'edit' ? (
                        <div className="timetable__add-btn">+</div>
                      ) : null
                    ) : null}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </motion.div>
      </div>

      {editTarget && (
        <CourseEditor
          day={editTarget.day}
          period={editTarget.period}
          existingCourse={editTarget.course}
          onClose={() => setEditTarget(null)}
        />
      )}

      {detailTarget && (
        <CourseDetail 
          course={detailTarget.course}
          currentLessonCount={detailTarget.lessonCount}
          dayIndex={detailTarget.dayIndex}
          onClose={() => setDetailTarget(null)}
        />
      )}

      <style jsx>{`
        .timetable-wrapper {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 8px;
        }
        .view-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 16px;
          margin-bottom: 8px;
        }
        .day-nav-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .timetable__cell--readonly {
          cursor: default;
        }
        .course-card__syllabus {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid rgba(255,255,255,0.1);
          font-size: 0.7rem;
        }
        .syllabus-idx {
          display: inline-block;
          background: rgba(255,255,255,0.15);
          padding: 2px 6px;
          border-radius: 4px;
          margin-bottom: 4px;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .syllabus-text {
          color: var(--text-primary);
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          font-size: 0.65rem;
          opacity: 0.9;
        }
        .course-card__tasks {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .task-mini-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.7rem;
          color: inherit;
          background: rgba(0, 0, 0, 0.15);
          padding: 4px 8px;
          border-radius: 6px;
        }
        .task-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent-blue);
        }
        .course-todo-badge {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 8px;
          height: 8px;
          background: var(--accent-red);
          border-radius: 50%;
          border: 2px solid var(--bg-primary);
          box-shadow: 0 0 5px rgba(255, 69, 58, 0.5);
        }
        .timetable__cell--outside {
          background: rgba(0, 0, 0, 0.05);
        }
        .outside-label {
          position: absolute;
          top: 2px;
          right: 4px;
          font-size: 0.5rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.1);
          padding: 1px 4px;
          border-radius: 3px;
          z-index: 2;
        }
        .override-badge {
          position: absolute;
          bottom: 4px;
          right: 4px;
          font-size: 0.5rem;
          color: var(--accent-blue);
          border: 1px solid var(--accent-blue);
          padding: 1px 4px;
          border-radius: 3px;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}

function getDateForDay(dayIndex: number, todayIndexRaw: number): Date {
  const today = new Date();
  const currentMon = todayIndexRaw; 
  const diff = dayIndex - currentMon;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d;
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLessonCount(targetDate: Date, targetDayIndex: number, state: any): number {
  if (!state.semesterSettings.start) return 1;
  const start = new Date(state.semesterSettings.start);
  start.setHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(0, 0, 0, 0);

  if (end < start) return 1;

  let count = 0;
  let current = new Date(start);

  while (current <= end) {
    const ymd = formatDateYMD(current);
    const actualJsDay = current.getDay();
    const actualIndex = actualJsDay === 0 ? 6 : actualJsDay - 1; // 0=Mon...6=Sun

    // Effective Day Index (Day Override)
    const hasOverride = state.dayOverrides[ymd] !== undefined;
    const effectiveIndex = hasOverride ? state.dayOverrides[ymd] : actualIndex;

    // Check if it's the target course day
    if (effectiveIndex === targetDayIndex) {
      const isHoliday = !!state.holidays[ymd];
      const isInSpecial = state.specialPeriods.some((p: any) => ymd >= p.start && ymd <= p.end);

      // Rule: Skip if holiday or special period, UNLESS it's an explicit override (priority B)
      if (hasOverride || (!isHoliday && !isInSpecial)) {
        count++;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return Math.max(1, count);
}
