'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTimetable } from '@/lib/store';
import { getTodayIndex, Course, cellKey } from '@/lib/types';
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

  const handleCellClick = (dayIdx: number, periodIdx: number) => {
    const course = getCourse(dayIdx, periodIdx);
    
    if (state.appMode === 'edit') {
      setEditTarget({ day: dayIdx, period: periodIdx, course });
    } else if (course) {
      const lessonCount = getLessonCount(new Date(), state.semesterSettings.start);
      setDetailTarget({ course, lessonCount, dayIndex: dayIdx });
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
                const course = getCourse(di, pi);
                const entry = state.timetable[cellKey(di, pi)];
                const lessonCount = getLessonCount(new Date(), state.semesterSettings.start);
                
                return (
                  <div
                    key={`cell-${di}-${pi}`}
                    className={`timetable__cell ${state.appMode === 'view' ? 'timetable__cell--readonly' : ''} ${entry?.slotOffset ? `timetable__cell--${entry.slotOffset}` : ''} ${state.holidays[getDateForDay(isToday ? (todayIndex + activeDayOffset) : di, todayIndexRaw).toISOString().split('T')[0]] ? 'timetable__cell--holiday' : ''}`}
                    onClick={() => handleCellClick(di, pi)}
                  >
                    {course ? (
                      <div
                        className={`course-card ${entry.slotOffset ? `course-card--${entry.slotOffset}` : ''}`}
                        style={{ '--course-color': course.color, background: `${course.color}15` } as React.CSSProperties}
                      >
                        <span className="course-card__name">{course.name}</span>
                        {course.room && <span className="course-card__room">📍 {course.room}</span>}
                        {(state.syllabusDisplayEnabled && course.syllabus && course.syllabus[lessonCount-1]) && (
                           <div className="course-card__syllabus">
                             <span className="syllabus-idx">第{lessonCount}回</span>
                             <p className="syllabus-text">{course.syllabus[lessonCount-1]}</p>
                           </div>
                        )}
                        {/* Task list for Today View */}
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
                        {/* Weekly view badge */}
                        {(!isToday && state.showGridTodoBadges && state.todos.some(t => t.courseId === course.id && !t.completed)) && (
                          <div className="course-todo-badge" />
                        )}
                      </div>
                    ) : state.appMode === 'edit' ? (
                      <div className="timetable__add-btn">+</div>
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
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.05);
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

function getLessonCount(date: Date, semesterStart: string): number {
  const start = new Date(semesterStart);
  const diffTime = Math.max(0, date.getTime() - start.getTime());
  const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;
  return Math.max(1, Math.min(15, diffWeeks));
}
