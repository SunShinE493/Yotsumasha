'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Course, TimetableState, formatDateYMD } from '@/lib/types';
import { useTimetable } from '@/lib/store';
import { 
  X, MapPin, User, BookOpen, ChevronDown, Award, 
  Book, Info, GraduationCap, FileText, Upload, 
  Loader2, ExternalLink, Plus 
} from 'lucide-react';

interface CourseDetailProps {
  course: Course;
  currentLessonCount: number;
  dayIndex: number;
  onClose: () => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  content?: string;
}

function CollapsibleSection({ title, icon, content }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!content) return null;

  return (
    <div className={`collapsible-section ${isOpen ? 'is-open' : ''}`}>
      <button className="collapsible-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="trigger-left">
          {icon}
          <span>{title}</span>
        </div>
        <ChevronDown size={16} className="chevron" />
      </button>
      <div className="collapsible-content">
        <div className="content-inner">
          {content.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>

      <style jsx>{`
        .collapsible-section {
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          overflow: hidden;
          transition: all 0.2s;
        }
        .collapsible-section:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        .collapsible-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
        }
        .trigger-left {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
        }
        .chevron {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: var(--text-muted);
        }
        .is-open .chevron {
          transform: rotate(180deg);
        }
        .collapsible-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .is-open .collapsible-content {
          max-height: 1000px;
        }
        .content-inner {
          padding: 0 16px 16px 40px;
          font-size: 0.85rem;
          color: var(--text-primary);
          line-height: 1.6;
        }
        .content-inner p {
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
}

function DriveFilesSection({ course }: { course: Course }) {
  const { state, setRootFolderId, updateCourse } = useTimetable();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initDrive = async () => {
    setLoading(true);
    try {
      // 1. Init root folder if missing
      let rootId = state.rootFolderId;
      if (!rootId) {
        const res = await fetch('/api/drive/init', { method: 'POST' });
        const data = await res.json();
        if (data.folderId) {
          rootId = data.folderId;
          setRootFolderId(rootId!);
        }
      }

      if (!rootId) throw new Error('Could not initialize Google Drive root');

      // 2. Init course folder if missing
      let courseFolderId = course.driveFolderId;
      if (!courseFolderId) {
        const res = await fetch('/api/drive/course', {
          method: 'POST',
          body: JSON.stringify({ parentFolderId: rootId, courseName: course.name }),
        });
        const data = await res.json();
        if (data.folderId) {
          courseFolderId = data.folderId;
          updateCourse({ ...course, driveFolderId: courseFolderId });
        }
      }

      // 3. Fetch files
      if (courseFolderId) {
        const res = await fetch(`/api/drive/files?folderId=${courseFolderId}`);
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initDrive();
  }, [course.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !course.driveFolderId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('parentFolderId', course.driveFolderId);

    try {
      const res = await fetch('/api/drive/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.file) {
        setFiles(prev => [data.file, ...prev]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="drive-section" style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
          📚 関連資料 (Google Drive)
        </h3>
        <button 
          className="btn btn-ghost btn-sm" 
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || uploading}
          style={{ fontSize: '0.7rem', padding: '4px 8px' }}
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          アップロード
        </button>
        <input type="file" ref={fileInputRef} hidden onChange={handleUpload} accept="application/pdf,image/*" />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : files.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
          資料はまだありません
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {files.map(file => (
            <a 
              key={file.id}
              href={file.webViewLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="file-item"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={16} style={{ color: 'var(--accent-blue)' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{file.name}</span>
                  {file.size && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{(parseInt(file.size) / 1024 / 1024).toFixed(1)} MB</span>}
                </div>
              </div>
              <ExternalLink size={14} style={{ opacity: 0.5 }} />
            </a>
          ))}
        </div>
      )}

      <style jsx>{`
        .file-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          text-decoration: none;
          color: var(--text-primary);
          transition: all 0.2s;
        }
        .file-item:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--accent-blue);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}

export default function CourseDetail({ course, currentLessonCount, dayIndex, onClose }: CourseDetailProps) {
  const { addTodo } = useTimetable();
  const [todoText, setTodoText] = useState('');
  const [deadlineMode, setDeadlineMode] = useState<'next' | '2weeks' | 'custom'>('next');
  const [customDate, setCustomDate] = useState(formatDateYMD(new Date()));

  const getWeeklyDate = (dIdx: number, offsetWeeks = 1) => {
    const now = new Date();
    const todayJsDay = now.getDay();
    const todayIndex = todayJsDay === 0 ? 6 : todayJsDay - 1;
    let diff = dIdx - todayIndex;
    if (diff <= 0) diff += 7;
    const target = new Date(now);
    target.setDate(now.getDate() + diff + (offsetWeeks - 1) * 7);
    return formatDateYMD(target);
  };

  const handleAddTodo = () => {
    if (!todoText.trim()) return;
    
    let targetDate: string | undefined;
    if (deadlineMode === 'next') targetDate = getWeeklyDate(dayIndex, 1);
    else if (deadlineMode === '2weeks') targetDate = getWeeklyDate(dayIndex, 2);
    else targetDate = customDate;

    addTodo(todoText.trim(), targetDate, undefined, course.id);
    setTodoText('');
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--large" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div 
              style={{ width: '12px', height: '24px', background: course.color, borderRadius: '4px' }} 
            />
            <h2 className="modal__title">{course.name}</h2>
          </div>
          <button className="modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal__body course-detail">
          {/* Top Info Grid */}
          <div className="course-detail__info">
            <div className="info-item">
              <label><MapPin size={10} style={{marginRight: 4}}/>教室</label>
              <span>{course.room || '未指定'}</span>
            </div>
            <div className="info-item">
              <label><User size={10} style={{marginRight: 4}}/>教員</label>
              <span>{course.teacher || '未指定'}</span>
            </div>
            {course.className && (
              <div className="info-item">
                <label><GraduationCap size={10} style={{marginRight: 4}}/>クラス</label>
                <span>{course.className}</span>
              </div>
            )}
            <div className="info-item">
              <label><BookOpen size={10} style={{marginRight: 4}}/>現在の進行度</label>
              <span>第 {currentLessonCount} 回目</span>
            </div>
          </div>

          {/* Quick Add Todo Section */}
          <div className="quick-todo-section" style={{ marginBottom: '20px', padding: '16px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-secondary)', fontWeight: 700 }}>
              📝 この授業の課題・メモを追加
            </h3>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input 
                type="text" 
                className="input" 
                placeholder="課題の内容を入力..." 
                style={{ flex: 1, fontSize: '0.85rem', padding: '8px 12px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                value={todoText}
                onChange={(e) => setTodoText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
              />
              <button className="btn btn-primary" onClick={handleAddTodo}>追加</button>
            </div>

            <div className="deadline-selector" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>期限の設定</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  className={`btn btn-xs ${deadlineMode === 'next' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, fontSize: '0.7rem' }}
                  onClick={() => setDeadlineMode('next')}
                >
                  次回 ({getWeeklyDate(dayIndex, 1)})
                </button>
                <button 
                  className={`btn btn-xs ${deadlineMode === '2weeks' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, fontSize: '0.7rem' }}
                  onClick={() => setDeadlineMode('2weeks')}
                >
                  2週間後 ({getWeeklyDate(dayIndex, 2)})
                </button>
                <button 
                  className={`btn btn-xs ${deadlineMode === 'custom' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, fontSize: '0.7rem' }}
                  onClick={() => setDeadlineMode('custom')}
                >
                  日付指定
                </button>
              </div>

              {deadlineMode === 'custom' && (
                <input 
                  type="date" 
                  className="input-mini"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Collapsible Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <CollapsibleSection title="授業の目標" icon={<Award size={16}/>} content={course.objectives} />
            <CollapsibleSection title="学修内容" icon={<Info size={16}/>} content={course.content} />
            <CollapsibleSection title="受講要件" icon={<X size={16}/>} content={course.requirements} />
            <CollapsibleSection title="成績評価の方法・基準" icon={<Award size={16}/>} content={course.grading} />
            <CollapsibleSection title="テキスト・参考書" icon={<Book size={16}/>} content={course.textbook ? `【テキスト】\n${course.textbook}\n\n【参考書】\n${course.references || 'なし'}` : undefined} />
            <CollapsibleSection title="予習・復習について" icon={<BookOpen size={16}/>} content={course.preparation} />
          </div>

          {/* Drive Files Section */}
          <DriveFilesSection course={course} />

          {/* Syllabus Section */}
          <div className="syllabus-section" style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '16px', color: 'var(--text-secondary)', fontWeight: 700 }}>
              授業計画 (全15回)
            </h3>
            
            <div className="syllabus-timeline">
              {Array.from({ length: 15 }).map((_, i) => {
                const isActive = (i + 1) === currentLessonCount;
                const content = course.syllabus?.[i] || '（予定なし）';
                
                return (
                  <div 
                    key={i} 
                    className={`timeline-item ${isActive ? 'timeline-item--active' : ''}`}
                  >
                    <div className="timeline-idx">第{i + 1}回</div>
                    <div className="timeline-content">
                      {content}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        <div className="modal__actions">
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
