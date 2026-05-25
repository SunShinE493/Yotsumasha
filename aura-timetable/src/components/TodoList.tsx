'use client';

import React, { useState, useEffect } from 'react';
import { useTimetable } from '@/lib/store';
import { generateId, Todo, DAY_LABELS_FULL, getContrastYIQ, formatDateYMD } from '@/lib/types';
import { Plus, Trash2, CheckCircle, Circle, Calendar, Clock, Book, Sparkles, Check, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { mapEventsToTimetable } from '@/lib/google-calendar';

export default function TodoList() {
  const { state, addTodo, toggleTodo, deleteTodo, setTodoPriorityMode, setAiPlan, importState } = useTimetable();
  const { data: session } = useSession();
  const [text, setText] = useState('');
  const [targetType, setTargetType] = useState<'none' | 'day' | 'date'>('none');
  const [targetDay, setTargetDay] = useState<number>(0);
  const [targetDate, setTargetDate] = useState<string>(formatDateYMD(new Date()));
  const [now, setNow] = useState(new Date());
  const [isConfirming, setIsConfirming] = useState(false);

  const handleClearPlan = () => {
    setAiPlan(undefined);
  };

  const handleConfirmAll = async () => {
    if (!state.aiPlan || !state.aiPlan.scheduledTasks || state.aiPlan.scheduledTasks.length === 0) return;
    if (!state.gasSyncUrl) {
      alert("GASの同期URLが設定されていません。「設定」から入力してください。");
      return;
    }

    setIsConfirming(true);
    try {
      const res = await fetch('/api/aura/ai/schedule/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gasSyncUrl: state.gasSyncUrl,
          tasks: state.aiPlan.scheduledTasks,
          periods: state.periods
        })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      // Reload calendar events immediately so they appear as actual events in the grid
      try {
        const calId = state.selectedCalendarId || 'primary';
        const calRes = await fetch(`/api/calendar?calendarId=${encodeURIComponent(calId)}`);
        if (calRes.ok) {
          const events = await calRes.json();
          const newState = mapEventsToTimetable(events, state);
          importState({
            ...newState,
            aiPlan: undefined
          });
          alert('スケジュールを一括登録し、Googleカレンダーと同期しました！🎉');
        } else {
          setAiPlan(undefined);
          alert('スケジュールを一括登録しました！(カレンダーの反映には数分かかる場合があります)');
        }
      } catch (err) {
        setAiPlan(undefined);
        alert('スケジュールを一括登録しました！');
      }
    } catch (e: any) {
      console.error(e);
      alert('確定エラー: ' + e.message);
    } finally {
      setIsConfirming(false);
    }
  };

  // Update 'now' every minute to keep countdowns fresh
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleAdd = () => {
    if (!text.trim()) return;
    addTodo(
       text, 
       targetType === 'date' ? targetDate : undefined,
       targetType === 'day' ? targetDay : undefined
    );
    setText('');
  };

  const todayStr = React.useMemo(() => formatDateYMD(new Date()), []);
  const showDateOptions = !state.mobileTodoDateEnabled ? 'desktop-only' : '';

  const sortedTodos = React.useMemo(() => {
    return [...state.todos].sort((a, b) => {
      // 1. Completion status (completed at bottom)
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      // 2. Priority Mode sorting
      if (state.todoPriorityMode === 'no-date-first') {
        const hasDateA = !!a.targetDate;
        const hasDateB = !!b.targetDate;
        if (hasDateA !== hasDateB) return hasDateA ? 1 : -1;
      }

      // 3. Date comparison
      const dateA = a.targetDate || '9999-99-99';
      const dateB = b.targetDate || '9999-99-99';
      return dateA.localeCompare(dateB);
    });
  }, [state.todos, state.todoPriorityMode]);

  const textColor = state.customBackground ? getContrastYIQ(state.customBackground) : 'var(--text-primary)';

  return (
    <div className="todo-panel glass" style={{ color: textColor }}>
      <div className="todo-panel__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="todo-panel__title">TODO リスト</h3>
        <button 
          className="btn btn-ghost btn-sm" 
          style={{ fontSize: '0.65rem', padding: '2px 8px' }}
          onClick={() => setTodoPriorityMode(state.todoPriorityMode === 'date-first' ? 'no-date-first' : 'date-first')}
        >
          {state.todoPriorityMode === 'date-first' ? '📅 日付優先' : '📝 日付なし優先'}
        </button>
      </div>

      {/* Aura AI Proposal Box */}
      {state.aiPlan && (
        <div className="ai-proposal-box glass" style={{
          margin: '12px 16px 16px 16px',
          padding: '14px',
          borderRadius: '16px',
          background: 'rgba(124, 58, 237, 0.08)',
          border: '1px dashed rgba(124, 58, 237, 0.3)',
          boxShadow: '0 8px 32px rgba(124, 58, 237, 0.05)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #7c3aed, #ec4899)'
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Sparkles size={14} style={{ color: '#a78bfa' }} />
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0, color: '#c084fc', letterSpacing: '0.05em' }}>Aura AI アシスタント</h4>
            <span style={{ fontSize: '0.55rem', background: 'rgba(167, 139, 250, 0.15)', color: '#c084fc', padding: '2px 6px', borderRadius: '8px', marginLeft: 'auto', fontWeight: 600 }}>提案中</span>
          </div>
          <p style={{ fontSize: '0.7rem', lineHeight: '1.45', margin: '0 0 10px 0', color: 'rgba(255,255,255,0.95)' }}>
            {state.aiPlan.message}
          </p>
          {state.aiPlan.scheduledTasks && state.aiPlan.scheduledTasks.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                {state.aiPlan.scheduledTasks.length}件の学習枠を提案中
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  onClick={handleClearPlan}
                  className="btn btn-ghost btn-xs"
                  style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '6px', color: 'var(--text-muted)', minHeight: 'unset' }}
                >
                  クリア
                </button>
                <button 
                  onClick={handleConfirmAll}
                  disabled={isConfirming}
                  className="btn btn-xs"
                  style={{
                    fontSize: '0.6rem',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
                    color: 'white',
                    border: 'none',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
                    minHeight: 'unset'
                  }}
                >
                  {isConfirming ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                  一括登録
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleClearPlan}
                className="btn btn-ghost btn-xs"
                style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '6px', color: 'var(--text-muted)', minHeight: 'unset' }}
              >
                閉じる
              </button>
            </div>
          )}
        </div>
      )}

      <div className="todo-input-area">
        <div className="todo-input-row">
          <input
            type="text"
            className="input todo-input"
            placeholder="タスクを追加..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className="btn btn-primary btn-icon" onClick={handleAdd}>
            <Plus size={20} />
          </button>
        </div>

        {/* Date/Day Selectors */}
        <div className={`todo-date-selectors ${showDateOptions}`}>
          <div className="target-type-toggle">
            <button 
              className={`target-btn ${targetType === 'none' ? 'active' : ''}`}
              onClick={() => setTargetType('none')}
            >
              なし
            </button>
            <button 
              className={`target-btn ${targetType === 'day' ? 'active' : ''}`}
              onClick={() => setTargetType('day')}
            >
              曜日
            </button>
            <button 
              className={`target-btn ${targetType === 'date' ? 'active' : ''}`}
              onClick={() => setTargetType('date')}
            >
              日付
            </button>
          </div>

          {targetType === 'day' && (
            <div className="day-selector">
              {['月', '火', '水', '木', '金', '土', '日'].map((label, i) => (
                <button
                  key={label}
                  className={`day-btn ${targetDay === i ? 'active' : ''}`}
                  onClick={() => setTargetDay(i)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {targetType === 'date' && (
            <div className="date-selector">
              <input 
                type="date" 
                className="input date-input"
                style={{ width: '100%', fontSize: '0.75rem', padding: '4px 8px' }}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="todo-list">
        {sortedTodos.length === 0 ? (
          <div className="todo-empty">タスクはありません</div>
        ) : (
          sortedTodos.map((todo) => {
            const isOverdue = todo.targetDate && todo.targetDate < todayStr && !todo.completed;
            
            return (
              <div key={todo.id} className={`todo-item ${todo.completed ? 'todo-item--completed' : ''} ${isOverdue ? 'todo-item--overdue' : ''}`}>
                <button className="todo-item__check" onClick={() => toggleTodo(todo.id)}>
                  {todo.completed ? <CheckCircle size={18} className="icon--success" /> : <Circle size={18} />}
                </button>
                <div className="todo-item__content">
                  <span className="todo-item__text">{todo.text}</span>
                  {(todo.targetDate || todo.originalDay !== undefined || todo.courseId) && (
                    <span className="todo-item__meta">
                      {todo.courseId ? (
                        <>
                          <Book size={10} style={{ color: state.courses.find(c => c.id === todo.courseId)?.color }} />
                          <span style={{ fontWeight: 600 }}>{state.courses.find(c => c.id === todo.courseId)?.name}</span>
                        </>
                      ) : (
                        <>
                          <Calendar size={10} /> 
                          {todo.originalDay !== undefined 
                            ? `${DAY_LABELS_FULL[todo.originalDay]}曜日` 
                            : todo.targetDate}
                        </>
                      )}
                    </span>
                  )}
                </div>

                {state.showTodoCountdown && todo.targetDate && !todo.completed && (() => {
                  const targetDateObj = new Date(todo.targetDate);
                  const todayObj = new Date(todayStr);
                  const diffTime = targetDateObj.getTime() - todayObj.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  
                  if (diffDays > 0) {
                    return <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>あと{diffDays}日</span>;
                  } else if (diffDays === 0) {
                    // Calculate remaining hours for today
                    const deadline = new Date(todo.targetDate);
                    deadline.setHours(23, 59, 59, 999);
                    const diffMs = deadline.getTime() - now.getTime();
                    const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
                    
                    if (diffHours > 0) {
                      return <span style={{ fontSize: '0.7rem', color: 'var(--accent-orange)', fontWeight: 'bold' }}>あと{diffHours}時間</span>;
                    } else {
                      const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                      return <span style={{ fontSize: '0.7rem', color: 'var(--accent-orange)', fontWeight: 'bold' }}>あと{diffMins}分</span>;
                    }
                  } else {
                    return <span style={{ fontSize: '0.7rem', color: 'var(--accent-red)', fontWeight: 'bold' }}>{Math.abs(diffDays)}日超過</span>;
                  }
                })()}

                {todo.completed && (
                  <button className="btn btn-icon btn-ghost todo-item__delete" onClick={() => deleteTodo(todo.id)} style={{ width: '28px', height: '28px' }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
