'use client';

import { useState, useEffect } from 'react';
import { useTimetable } from '@/lib/store';
import { PeriodTime } from '@/lib/types';
import { useSession, signIn, signOut } from 'next-auth/react';
import { mapEventsToTimetable } from '@/lib/google-calendar';

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { 
    state, 
    updatePeriods, 
    toggleWeekend, 
    resetAll, 
    importState, 
    updateSemester,
    addSpecialPeriod,
    deleteSpecialPeriod,
    setSelectedCalendarId,
    updateTransitionHour,
    setDayOverride,
    setMobileTodoDateEnabled,
    setSyllabusDisplayEnabled,
    setGasSyncUrl,
    setShowGridTodoBadges
  } = useTimetable();
  const { data: session, status } = useSession();
  const [periods, setPeriods] = useState<PeriodTime[]>([...state.periods]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [calendars, setCalendars] = useState<{ id: string, summary: string }[]>([]);

  // Fetch calendar list
  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/calendar/list')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setCalendars(data);
        })
        .catch(() => {});
    }
  }, [status]);

  const handlePeriodChange = (index: number, field: 'start' | 'end', value: string) => {
    const next = [...periods];
    next[index] = { ...next[index], [field]: value };
    setPeriods(next);
  };

  const handleAddPeriod = () => {
    setPeriods([...periods, { start: '18:00', end: '19:30' }]);
  };

  const handleRemovePeriod = () => {
    if (periods.length > 1) {
      setPeriods(periods.slice(0, -1));
    }
  };

  const handleSave = () => {
    updatePeriods(periods);
    onClose();
  };

  const handleReset = () => {
    if (confirm('すべてのデータをリセットしますか？この操作は取り消せません。')) {
      resetAll();
      onClose();
    }
  };

  const handleGoogleSync = async () => {
    if (status !== 'authenticated') {
      signIn('google');
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch(`/api/calendar?calendarId=${encodeURIComponent(state.selectedCalendarId || 'primary')}`);
      const events = await res.json();
      
      if (events.error) throw new Error(events.error);

      const newState = mapEventsToTimetable(events, state);
      importState(newState);
      alert('Googleカレンダーとの同期が完了しました。');
    } catch (error: any) {
      alert('同期エラー: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGasSync = async () => {
    if (!state.gasSyncUrl) {
      alert('GASのウェブアプリURLを入力してください。');
      return;
    }

    setIsSyncing(true);
    try {
      // GAS Web Apps do not support OPTIONS (preflight).
      // We use 'text/plain' to make it a "simple request" which avoids preflight
      // but still allows 'cors' mode to follow redirects and read the response.
      const response = await fetch(state.gasSyncUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
          semesterStart: state.semesterSettings.start,
          semesterEnd: state.semesterSettings.end,
          timetable: state.timetable,
          courses: state.courses,
          periods: state.periods,
          dayOverrides: state.dayOverrides
        }),
      });

      const result = await response.json();
      if (result.status === 'success') {
        alert('同期完了！\n' + result.message);
      } else {
        throw new Error(result.message || '同期エラーが発生しました。');
      }
    } catch (error: any) {
      console.error('GAS Sync Error:', error);
      alert('GAS同期エラー: ' + error.message + '\n\n※URLが正しいか、GASエディタで「新しいデプロイ」を行っているか確認してください。');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDayOverrideAdd = () => {
    const dateStr = prompt('対象の日付を入力 (YYYY-MM-DD)');
    if (!dateStr) return;
    const dayName = prompt('その日の時間割の曜日を選択 (0=月, 1=火, 2=水, 3=木, 4=金, 5=土, 6=日)');
    if (dayName === null || dayName === '') return;
    setDayOverride(dateStr, parseInt(dayName));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--settings" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">⚙️ 高度な設定</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal__body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          
          <div className="settings-grid">
            {/* 1. General Info & Modes */}
            <div className="form-group">
              <label>📅 学期・基本設定</label>
              <div className="card settings-card">
                <div className="settings-row">
                  <span>学期期間</span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input type="date" value={state.semesterSettings.start} onChange={e => updateSemester({...state.semesterSettings, start: e.target.value})} className="input-mini" />
                    <span>~</span>
                    <input type="date" value={state.semesterSettings.end} onChange={e => updateSemester({...state.semesterSettings, end: e.target.value})} className="input-mini" />
                  </div>
                </div>
                <div className="settings-row">
                  <span>翌日切替時刻</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="number" min="0" max="23" 
                      value={state.transitionHour} 
                      onChange={e => updateTransitionHour(parseInt(e.target.value))}
                      className="input-mini"
                      style={{ width: '50px' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>時 (以降は明日を表示)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Display Toggles */}
            <div className="form-group">
              <label>👁️ 表示のカスタマイズ</label>
              <div className="card settings-card">
                <button className="btn btn-ghost settings-row-btn" onClick={() => setSyllabusDisplayEnabled(!state.syllabusDisplayEnabled)}>
                  <span>シラバス（回次内容）を表示</span>
                  <span className={`toggle-pill ${state.syllabusDisplayEnabled ? 'active' : ''}`}></span>
                </button>
                <button className="btn btn-ghost settings-row-btn" onClick={() => setShowGridTodoBadges(!state.showGridTodoBadges)}>
                  <span>時間割に課題バッジを表示</span>
                  <span className={`toggle-pill ${state.showGridTodoBadges ? 'active' : ''}`}></span>
                </button>
                <button className="btn btn-ghost settings-row-btn" onClick={() => setMobileTodoDateEnabled(!state.mobileTodoDateEnabled)}>
                  <span>スマホでTODOの日付指定を有効化</span>
                  <span className={`toggle-pill ${state.mobileTodoDateEnabled ? 'active' : ''}`}></span>
                </button>
                <button className="btn btn-ghost settings-row-btn" onClick={toggleWeekend}>
                  <span>土日を表示する</span>
                  <span className={`toggle-pill ${state.showWeekend ? 'active' : ''}`}></span>
                </button>
              </div>
            </div>

            {/* 3. Day Overrides (Substitute Classes) */}
            <div className="form-group">
              <label>🔄 振替授業・特殊日の設定</label>
              <div className="card settings-card">
                <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                  {Object.entries(state.dayOverrides).length === 0 ? (
                    <div className="settings-row" style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>設定はありません</div>
                  ) : (
                    Object.entries(state.dayOverrides).map(([date, dayIdx]) => (
                      <div key={date} className="settings-row" style={{ fontSize: '0.75rem' }}>
                        <span>{date} → <strong style={{ color: 'var(--accent-blue)' }}>{['月', '火', '水', '木', '金', '土', '日'][dayIdx]}曜</strong></span>
                        <button className="btn btn-icon btn-ghost" onClick={() => setDayOverride(date, null)} style={{ height: '20px', width: '20px', minHeight: 'unset' }}>✕</button>
                      </div>
                    ))
                  )}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={handleDayOverrideAdd} style={{ marginTop: '8px', width: '100%', fontSize: '0.75rem' }}>
                   ＋ 振替設定を追加
                </button>
              </div>
            </div>

            {/* 4. Google Calendar Sync */}
            <div className="form-group">
              <label>🔗 Google カレンダー同期</label>
              <div className="card settings-card">
                <div style={{ paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }}>
                   <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>【方法A】Google API (要カード登録)</span>
                   {status === 'authenticated' ? (
                    <>
                      <div className="settings-row" style={{ margin: '8px 0' }}>
                        <span style={{ fontSize: '0.7rem' }}>{session.user?.email}</span>
                        <button onClick={() => signOut()} style={{ color: 'var(--accent-red)', fontSize: '0.7rem' }}>解除</button>
                      </div>
                      <select 
                        className="form-group"
                        value={state.selectedCalendarId}
                        onChange={(e) => setSelectedCalendarId(e.target.value)}
                        style={{ width: '100%', padding: '4px', fontSize: '0.75rem', background: 'var(--bg-primary)', color: 'white' }}
                      >
                        {calendars.map(cal => (
                          <option key={cal.id} value={cal.id}>{cal.summary}</option>
                        ))}
                      </select>
                      <button className="btn btn-primary" onClick={handleGoogleSync} disabled={isSyncing} style={{ width: '100%', marginTop: '8px', fontSize: '0.75rem' }}>
                        {isSyncing ? '同期中...' : '🔄 API同期'}
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-ghost" onClick={() => signIn('google')} style={{ width: '100%', fontSize: '0.75rem', marginTop: '4px' }}>
                      🔑 Google API で同期
                    </button>
                  )}
                </div>

                <div>
                   <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>【方法B】GAS連携 (推奨・カード不要)</span>
                   <input 
                     type="text" 
                     placeholder="GAS ウェブアプリのURLを入力"
                     className="input-mini"
                     style={{ width: '100%', marginTop: '4px', fontSize: '0.7rem' }}
                     value={state.gasSyncUrl || ''}
                     onChange={(e) => setGasSyncUrl(e.target.value)}
                   />
                   <button className="btn btn-primary" onClick={handleGasSync} disabled={isSyncing} style={{ width: '100%', marginTop: '8px', fontSize: '0.75rem' }}>
                      {isSyncing ? '送信中...' : '📅 カレンダーへ書き出し'}
                   </button>
                </div>
              </div>
            </div>

            {/* 5. Period Config */}
            <div className="form-group">
              <label>⏰ 時限設定</label>
              <div className="card settings-card">
                <div className="period-config">
                  {periods.map((p, i) => (
                    <div key={i} className="period-config__row" style={{ padding: '2px 0' }}>
                      <span style={{ minWidth: '20px', textAlign: 'center', fontSize: '0.75rem' }}>{i + 1}</span>
                      <input type="time" value={p.start} onChange={e => handlePeriodChange(i, 'start', e.target.value)} className="input-mini" />
                      <span style={{ fontSize: '0.7rem' }}>-</span>
                      <input type="time" value={p.end} onChange={e => handlePeriodChange(i, 'end', e.target.value)} className="input-mini" />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                  <button className="btn btn-ghost btn-xs" onClick={handleAddPeriod} style={{ flex: 1 }}>＋</button>
                  <button className="btn btn-ghost btn-xs" onClick={handleRemovePeriod} style={{ flex: 1 }} disabled={periods.length <= 1}>ー</button>
                </div>
              </div>
            </div>

             {/* Reset */}
             <div className="form-group">
              <label>🗑️ データ管理</label>
              <button className="btn btn-danger btn-sm" onClick={handleReset} style={{ width: '100%' }}>
                すべてのデータを初期化
              </button>
            </div>
          </div>
        </div>

        <div className="modal__actions">
          <button className="btn btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={handleSave}>設定を保存</button>
        </div>
      </div>

      <style jsx>{`
        .settings-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 640px) {
          .settings-grid { grid-template-columns: 1fr 1fr; }
        }
        .settings-card {
          padding: 16px;
          background: rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-color: var(--border-subtle);
        }
        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 0.85rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }
        .settings-row:last-child { border-bottom: none; }
        
        .settings-row-btn {
          width: 100%;
          justify-content: space-between;
          padding: 12px;
          font-size: 0.85rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid transparent;
          transition: all 0.2s;
        }
        .settings-row-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--border-subtle);
        }
        .input-mini {
          padding: 4px 8px;
          background: var(--bg-primary);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          color: white;
          font-size: 0.8rem;
          width: 90px;
          outline: none;
        }
        .input-mini:focus { border-color: var(--accent-blue); }
        
        .toggle-pill {
          width: 36px;
          height: 20px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .toggle-pill::after {
          content: '';
          position: absolute;
          left: 2px;
          top: 2px;
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .toggle-pill.active {
          background: var(--accent-blue);
          box-shadow: 0 0 12px hsla(220, 90%, 65%, 0.3);
        }
        .toggle-pill.active::after {
          transform: translateX(16px);
        }
        .btn-xs { padding: 4px 8px; font-size: 0.7rem; }
        .btn-sm { padding: 8px 12px; }
      `}</style>
    </div>
  );
}
