'use client';

import { useState } from 'react';
import TimetableGrid from '@/components/TimetableGrid';
import AISnap from '@/components/AISnap';
import SettingsPanel from '@/components/SettingsPanel';
import TodoList from '@/components/TodoList';
import { useTimetable } from '@/lib/store';
import { getContrastYIQ } from '@/lib/types';
import { Menu, X, Settings, Sparkles, Edit3, Eye, Calendar, Home as HomeIcon, Loader2 } from 'lucide-react';

export default function Home() {
  const { state, setAppMode, setAiPlan } = useTimetable();
  const [showMenu, setShowMenu] = useState(false);
  const [activePanel, setActivePanel] = useState<'none' | 'ai' | 'settings'>('none');
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);

  const handleGenerateAiSchedule = async () => {
    if (!state.gasSyncUrl) {
      alert("GASの同期URLが設定されていません。「設定」から入力してください。");
      return;
    }

    setIsGeneratingSchedule(true);
    try {
      const res = await fetch('/api/aura/ai/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const result = await res.json();
      setAiPlan({
        message: result.message,
        scheduledTasks: result.scheduledTasks,
        generatedAt: Date.now()
      });
      alert("AIによる最適スケジュールが作成されました！時間割とTODOリストで提案を確認してください。✨");
    } catch (e: any) {
      console.error(e);
      alert("AIスケジュール生成エラー: " + e.message);
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  const closePanel = () => setActivePanel('none');

  const bgColor = state.customBackground;
  let customStyles: React.CSSProperties | undefined;

  if (bgColor) {
    const textColor = getContrastYIQ(bgColor);
    const isLight = textColor === '#000000';
    
    customStyles = {
      '--bg-primary': bgColor,
      '--bg-secondary': isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
      '--bg-card': isLight ? 'rgba(255,255,255,0.5)' : bgColor,
      '--bg-glass': isLight ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.4)',
      '--bg-card-hover': isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.08)',
      '--text-primary': textColor,
      '--text-secondary': textColor,
      '--text-muted': isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
      '--border-subtle': isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)',
    } as React.CSSProperties;
  }

  return (
    <div className={`app-container app-mode--${state.appMode}`} style={customStyles}>
      {/* Header */}
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__brand">
            <button 
              className="btn btn-icon btn-ghost btn-hamburger" 
              onClick={() => setShowMenu(true)}
              aria-label="Open Menu"
            >
              <Menu size={20} />
            </button>
            <div className="app-header__logo">A</div>
            <h1 className="app-header__title">Aura</h1>
          </div>
          
          <div className="app-header__center">
          </div>

          <div className="app-header__actions desktop-only">
            <button
              className={`btn btn-icon btn-ghost ${activePanel === 'ai' ? 'btn-primary' : ''}`}
              onClick={() => setActivePanel(activePanel === 'ai' ? 'none' : 'ai')}
              title="AI アシスタント"
            >
              <Sparkles size={18} />
            </button>
            <button
              className="btn btn-icon btn-ghost"
              onClick={() => setActivePanel('settings')}
              title="設定"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar Drawer */}
      <div className={`app-drawer-overlay ${showMenu ? 'open' : ''}`} onClick={() => setShowMenu(false)}>
        <aside className="app-drawer" onClick={e => e.stopPropagation()}>
          <div className="app-drawer__header">
            <div className="app-header__logo">A</div>
            <h2 className="app-drawer__title">Aura Timetable</h2>
            <button className="btn btn-icon btn-ghost" onClick={() => setShowMenu(false)}>
              <X size={20} />
            </button>
          </div>
          <nav className="app-drawer__nav">
             <button className="drawer-item" onClick={() => { setShowMenu(false); setAppMode('view'); }}>
               <Eye size={18} /> 予定ビュー（普段用）
             </button>
             <button className="drawer-item" onClick={() => { setShowMenu(false); setAppMode('edit'); }}>
               <Edit3 size={18} /> 編集モード（履修登録）
             </button>
             <hr />
             <button className="drawer-item" onClick={() => { setShowMenu(false); setActivePanel('ai'); }}>
               <Sparkles size={18} /> AI アシスタント
             </button>
             <button className="drawer-item" onClick={() => { setShowMenu(false); setActivePanel('settings'); }}>
               <Settings size={18} /> 設定
             </button>
             <hr />
             <a className="drawer-item" href="/" style={{ textDecoration: 'none' }}>
               <HomeIcon size={18} /> ホームに戻る
             </a>
          </nav>
        </aside>
      </div>

      <main className="main-layout container">
        <div className="timetable-container">
          <TimetableGrid />
        </div>
        <aside className="todo-container">
          <TodoList />
        </aside>
      </main>

      {/* Panels */}
      {activePanel === 'ai' && (
        <div className="modal-overlay" onClick={closePanel}>
          <div className="modal modal--large" onClick={e => e.stopPropagation()}>
             <AISnap />
             <button className="btn btn-ghost modal-close-btn" onClick={closePanel}><X /></button>
          </div>
        </div>
      )}

      {activePanel === 'settings' && <SettingsPanel onClose={closePanel} />}

      <style jsx>{`
        .app-container {
          min-height: 100vh;
          background: var(--bg-primary);
        }
        .app-drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(4px);
          z-index: 1000;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s;
        }
        .app-drawer-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }
        .app-drawer {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 280px;
          background: var(--bg-glass);
          border-right: 1px solid var(--border-subtle);
          box-shadow: 20px 0 50px rgba(0,0,0,0.3);
          transform: translateX(-100%);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          padding: 20px;
          display: flex;
          flex-direction: column;
        }
        .app-drawer-overlay.open .app-drawer {
          transform: translateX(0);
        }
        .app-drawer__header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 30px;
        }
        .app-drawer__title {
          font-family: var(--font-display);
          font-size: 1.1rem;
          flex: 1;
        }
        .app-drawer__nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .drawer-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 12px;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 0.95rem;
          text-align: left;
          cursor: pointer;
          transition: background 0.2s;
        }
        .drawer-item:hover {
          background: var(--bg-card-hover);
        }
        .mode-toggle {
          display: flex;
          background: var(--bg-secondary);
          padding: 4px;
          border-radius: 12px;
          gap: 4px;
        }
        .mode-toggle__btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .mode-toggle__btn.active {
          background: var(--bg-glass);
          color: var(--text-primary);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .modal-close-btn {
          position: absolute;
          top: 10px;
          right: 10px;
        }
        .floating-ai-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
          color: white;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(124, 58, 237, 0.4), 
                      inset 0 1px 0 rgba(255, 255, 255, 0.3);
          cursor: pointer;
          z-index: 999;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          outline: none;
        }
        .floating-ai-btn:hover:not(:disabled) {
          transform: scale(1.1) translateY(-4px) rotate(8deg);
          box-shadow: 0 12px 40px rgba(124, 58, 237, 0.6), 
                      inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }
        .floating-ai-btn:active:not(:disabled) {
          transform: scale(0.95);
        }
        .floating-ai-btn:disabled {
          background: #3f3f46;
          box-shadow: none;
          cursor: not-allowed;
          opacity: 0.6;
        }
        @media (max-width: 1023px) {
          .desktop-only { display: none; }
        }
      `}</style>

      {/* Floating Action Button (Sparkle Rescheduling Trigger) */}
      <button
        onClick={handleGenerateAiSchedule}
        disabled={isGeneratingSchedule}
        className="floating-ai-btn"
        title="AI スケジュール自動生成"
      >
        {isGeneratingSchedule ? (
          <Loader2 className="animate-spin" size={24} />
        ) : (
          <Sparkles size={24} />
        )}
      </button>
    </div>
  );
}
