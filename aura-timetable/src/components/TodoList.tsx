'use client';

import React, { useState } from 'react';
import { useTimetable } from '@/lib/store';
import { generateId, Todo, DAY_LABELS_FULL, getContrastYIQ } from '@/lib/types';
import { Plus, Trash2, CheckCircle, Circle, Calendar, Clock, Book } from 'lucide-react';

export default function TodoList() {
  const { state, addTodo, toggleTodo, deleteTodo, setTodoPriorityMode } = useTimetable();
  const [text, setText] = useState('');
  const [targetType, setTargetType] = useState<'none' | 'day' | 'date'>('none');
  const [targetDay, setTargetDay] = useState<number>(0);
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [now, setNow] = useState(new Date());

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

  const todayStr = React.useMemo(() => new Date().toISOString().split('T')[0], []);
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
