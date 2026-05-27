'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTimetable } from '@/lib/store';
import { getTodayIndex, Course, cellKey, getContrastYIQ, formatDateYMD } from '@/lib/types';
import CourseEditor from './CourseEditor';
import CourseDetail from './CourseDetail';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { mapEventsToTimetable } from '@/lib/google-calendar';

export default function TimetableGrid() {
  const { state, getCourse, importState, setAiPlan } = useTimetable();
  const { data: session } = useSession();
  const [isConfirmingProposed, setIsConfirmingProposed] = useState(false);
  const [proposedTaskMenu, setProposedTaskMenu] = useState<{ task: any, rect: DOMRect } | null>(null);

  const handleConfirmProposedTask = async (task: any) => {
    if (!state.gasSyncUrl) {
      alert("GASの同期URLが設定されていません。「設定」から入力してください。");
      return;
    }

    if (!confirm(`この提案タスク「${task.text}」を確定してカレンダーに登録しますか？`)) {
      return;
    }

    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      const res = await fetch('/api/aura/ai/schedule/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'csrf-token': csrfToken
        },
        body: JSON.stringify({
          gasSyncUrl: state.gasSyncUrl,
          tasks: [task],
          periods: state.periods,
          _csrf: csrfToken
        })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const nextScheduledTasks = state.aiPlan?.scheduledTasks.filter(
        t => !(t.date === task.date && t.period === task.period)
      ) || [];

      try {
        const calId = state.selectedCalendarId || 'primary';
        const calRes = await fetch(`/api/calendar?calendarId=${encodeURIComponent(calId)}`);
        if (calRes.ok) {
          const events = await calRes.json();
          const newState = mapEventsToTimetable(events, state);
          importState({
            ...newState,
            aiPlan: nextScheduledTasks.length > 0 ? {
              ...state.aiPlan!,
              scheduledTasks: nextScheduledTasks
            } : undefined
          });
          alert('タスクをカレンダーに登録し、同期しました！🎉');
        } else {
          importState({
            ...state,
            aiPlan: nextScheduledTasks.length > 0 ? {
              ...state.aiPlan!,
              scheduledTasks: nextScheduledTasks
            } : undefined
          });
          alert('タスクをカレンダーに登録しました！');
        }
      } catch (err) {
        importState({
          ...state,
          aiPlan: nextScheduledTasks.length > 0 ? {
            ...state.aiPlan!,
            scheduledTasks: nextScheduledTasks
          } : undefined
        });
        alert('タスクをカレンダーに登録しました！');
      }
    } catch (e: any) {
      console.error(e);
      alert('登録エラー: ' + e.message);
    }
  };
  const [viewMode, setViewMode] = useState<'today' | 'weekly'>('today');
  const [activeDayOffset, setActiveDayOffset] = useState(0);
  const [editTarget, setEditTarget] = useState<{ day: number; period: number; course?: Course; dateStr?: string } | null>(null);
  const [detailTarget, setDetailTarget] = useState<{ course: Course, lessonCount: number, dayIndex: number } | null>(null);
  const [now, setNow] = useState(new Date());
  const [todayEvents, setTodayEvents] = useState<any[]>([]);

  // Update 'now' every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (viewMode === 'today' && session) {
      const calId = state.selectedCalendarId || 'primary';
      fetch(`/api/calendar?calendarId=${encodeURIComponent(calId)}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setTodayEvents(data);
          }
        })
        .catch(console.error);
    }
  }, [viewMode, session, state.selectedCalendarId]);

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
    const dateStr = formatDateYMD(getDateForDay(idx, todayIndexRaw));
    if (state.dayOverrides[dateStr] !== undefined) {
      return state.dayOverrides[dateStr];
    }
    return idx;
  }, [todayIndex, activeDayOffset, state.dayOverrides, todayIndexRaw]);

  const handleCellClick = (dayIdx: number, periodIdx: number, targetDate?: Date, effectiveDay?: number) => {
    const date = targetDate ?? getDateForDay(isToday ? (todayIndex + activeDayOffset) : dayIdx, todayIndexRaw);
    const dateStr = formatDateYMD(date);
    const finalDay = effectiveDay ?? dayIdx;
    const course = getCourse(finalDay, periodIdx, dateStr);

    if (state.appMode === 'edit') {
      setEditTarget({ day: finalDay, period: periodIdx, course, dateStr });
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
            <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '4px 8px' }} onClick={() => setActiveDayOffset(0)}>今日</button>
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
            const actualDayIndex = (displayDate.getDay() + 6) % 7;
            const displayDateStr = formatDateYMD(displayDate);
            const holidayName = state.holidays[displayDateStr];

            return (
              <div key={`header-${day}`} className={`timetable__header ${isHighlight ? 'timetable__header--today-highlight' : ''} ${holidayName ? 'timetable__header--holiday' : ''}`}>
                <span>{state.dayLabels[actualDayIndex]}</span>
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

                const course = getCourse(effectiveDayIndex, pi, dateStr);
                const entry = dateStr ? state.cellOverrides[cellKey(dateStr, pi)] : undefined;
                const effectiveEntry = entry || state.timetable[cellKey(effectiveDayIndex, pi)];
                const lessonCount = getLessonCount(targetDate, effectiveDayIndex, state);

                return (
                  <div
                    key={`cell-${di}-${pi}`}
                    className={`timetable__cell ${state.appMode === 'view' ? 'timetable__cell--readonly' : ''} ${effectiveEntry?.slotOffset ? `timetable__cell--${effectiveEntry.slotOffset}` : ''} ${isHoliday ? 'timetable__cell--holiday' : ''} ${isOutsideSemester ? 'timetable__cell--outside' : ''}`}
                    onClick={() => handleCellClick(di, pi, targetDate, effectiveDayIndex)}
                  >
                    {!isHoliday || hasOverride ? (
                      course ? (
                        <div
                          className={`course-card ${effectiveEntry?.slotOffset ? `course-card--${effectiveEntry.slotOffset}` : ''}`}
                          style={{
                            '--course-color': course.color,
                            background: course.color,
                            color: getContrastYIQ(course.color),
                            opacity: isOutsideSemester ? 0.4 : 1
                          } as React.CSSProperties}
                        >
                          {isOutsideSemester && <div className="outside-label">期間外</div>}
                          {hasOverride && !state.cellOverrides[cellKey(dateStr, pi)] && <div className="override-badge">振替</div>}
                          {state.cellOverrides[cellKey(dateStr, pi)] && <div className="override-badge" style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}>特別</div>}
                          <span className="course-card__name">{course.name}</span>
                          {course.room && <span className="course-card__room" style={{ color: getContrastYIQ(course.color), opacity: 0.95 }}>📍 {course.room}</span>}
                          {(state.syllabusDisplayEnabled && course.syllabus && course.syllabus[lessonCount - 1]) && (
                            <div className="course-card__syllabus">
                              <span className="syllabus-idx">第{lessonCount}回</span>
                              <p className="syllabus-text">{course.syllabus[lessonCount - 1]}</p>
                            </div>
                          )}
                          {isToday && (
                            <div className="course-card__tasks">
                              {state.todos
                                .filter(t => t.courseId === course.id && !t.completed && (!t.targetDate || t.targetDate === dateStr))
                                .map(t => {
                                  const isDueToday = t.targetDate === dateStr;
                                  let hoursLeft: number | null = null;
                                  if (isDueToday && t.targetDate) {
                                    const deadline = new Date(t.targetDate);
                                    deadline.setHours(23, 59, 59, 999);
                                    hoursLeft = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));
                                  }

                                  return (
                                    <div key={t.id} className="task-mini-item" style={{ color: getContrastYIQ(course.color) }}>
                                      <div className="task-dot" />
                                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</span>
                                      {hoursLeft !== null && (
                                        <span style={{ fontSize: '0.6rem', opacity: 0.8, marginLeft: '4px', whiteSpace: 'nowrap' }}>({hoursLeft}h)</span>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                          {!isToday && state.showGridTodoBadges && state.todos.some(t => t.courseId === course.id && !t.completed && (!t.targetDate || t.targetDate === dateStr)) && (
                            <div className="course-todo-badge" />
                          )}
                        </div>
                      ) : (() => {
                        const proposedTask = state.aiPlan?.scheduledTasks?.find(t => t.date === dateStr && t.period === pi);
                        if (proposedTask && state.appMode === 'view') {
                          const linkedTodo = state.todos.find(t => t.id === proposedTask.todoId);
                          const linkedCourse = linkedTodo && linkedTodo.courseId ? state.courses.find(c => c.id === linkedTodo.courseId) : null;
                          const displayText = linkedCourse ? `[${linkedCourse.name}] ${proposedTask.text}` : proposedTask.text;

                          return (
                            <div
                              className="course-card course-card--proposed animate-pulse"
                              style={{
                                border: '1.5px dashed rgba(167, 139, 250, 0.6)',
                                background: 'rgba(124, 58, 237, 0.08)',
                                color: '#e9d5ff',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                padding: '10px 8px',
                                gap: '4px',
                                height: '100%',
                                borderRadius: '12px',
                                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.05)',
                                transition: 'all 0.2s',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setProposedTaskMenu({ task: proposedTask, rect });
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Sparkles size={11} style={{ color: '#c084fc' }} />
                                <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI提案</span>
                              </div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, textAlign: 'center', wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.2' }}>{displayText}</span>
                              <span style={{ fontSize: '0.55rem', opacity: 0.7, marginTop: '2px', color: '#c084fc' }}>タップで選択</span>
                            </div>
                          );
                        }

                        const matchedEvents = todayEvents.filter(ev => {
                          const evStartStr = ev.start?.dateTime || ev.start?.date;
                          if (!evStartStr) return false;
                          const evDate = new Date(evStartStr);
                          if (formatDateYMD(evDate) !== dateStr) return false;
                          
                          const evMins = evDate.getHours() * 60 + evDate.getMinutes();
                          const [ph, pm] = p.start.split(':').map(Number);
                          const pMins = ph * 60 + pm;
                          return Math.abs(evMins - pMins) <= 45;
                        });

                        if (matchedEvents.length > 0 && state.appMode === 'view') {
                          return (
                            <div
                              className="course-card"
                              style={{
                                border: '1.5px solid rgba(255, 255, 255, 0.15)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-primary)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                padding: '8px',
                                borderRadius: '12px',
                                height: '100%',
                              }}
                            >
                              {matchedEvents.map((ev, idx) => {
                                const st = new Date(ev.start?.dateTime || ev.start?.date);
                                const en = new Date(ev.end?.dateTime || ev.end?.date);
                                const timeStr = ev.start?.dateTime ? `${st.getHours()}:${String(st.getMinutes()).padStart(2, '0')} - ${en.getHours()}:${String(en.getMinutes()).padStart(2, '0')}` : '終日';
                                return (
                                  <div key={idx} style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                                    <div style={{ fontSize: '0.6rem', color: 'var(--accent-blue)', fontWeight: 'bold' }}>{timeStr}</div>
                                    <div style={{ fontWeight: 600, marginTop: '2px' }}>📅 {ev.summary}</div>
                                    {ev.location && <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '2px' }}>📍 {ev.location}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        return state.appMode === 'edit' ? (
                          <div className="timetable__add-btn">+</div>
                        ) : null;
                      })()
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
          date={editTarget.dateStr}
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

      {proposedTaskMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => setProposedTaskMenu(null)}
          />
          <div
            className="glass"
            style={{
              position: 'fixed',
              top: Math.min(proposedTaskMenu.rect.bottom + 8, window.innerHeight - 150),
              left: Math.max(8, Math.min(proposedTaskMenu.rect.left, window.innerWidth - 200)),
              zIndex: 1000,
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              width: '200px',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              この提案をどうしますか？
            </div>
            <button
              className="btn btn-sm"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', color: 'white', border: 'none', justifyContent: 'center' }}
              onClick={() => {
                handleConfirmProposedTask(proposedTaskMenu.task);
                setProposedTaskMenu(null);
              }}
            >
              カレンダーに確定する
            </button>
            <button
              className="btn btn-sm btn-ghost"
              style={{ justifyContent: 'center' }}
              onClick={() => {
                const newTasks = state.aiPlan?.scheduledTasks.filter(t => t !== proposedTaskMenu.task) || [];
                setAiPlan({ ...state.aiPlan!, scheduledTasks: newTasks });
                alert("この提案を取り消しました。空き時間ができたため、AIアシスタントから再度スケジュール生成を依頼すると別の候補が提案されます。");
                setProposedTaskMenu(null);
              }}
            >
              別の日時にずらす
            </button>
            <button
              className="btn btn-sm btn-ghost"
              style={{ color: 'var(--accent-red)', justifyContent: 'center' }}
              onClick={() => {
                const newTasks = state.aiPlan?.scheduledTasks.filter(t => t !== proposedTaskMenu.task) || [];
                setAiPlan({ ...state.aiPlan!, scheduledTasks: newTasks });
                setProposedTaskMenu(null);
              }}
            >
              キャンセル
            </button>
          </div>
        </>
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
