'use client';

import { useState, useEffect } from 'react';
import { useTimetable } from '@/lib/store';
import { Course, COURSE_COLORS } from '@/lib/types';

interface CourseEditorProps {
  day: number;
  period: number;
  existingCourse?: Course;
  date?: string;
  onClose: () => void;
}

export default function CourseEditor({ day, period, existingCourse, date, onClose }: CourseEditorProps) {
  const { state, addCourse, updateCourse, deleteCourse, setCellCourse } = useTimetable();

  const [mode, setMode] = useState<'select' | 'new' | 'edit'>(
    existingCourse ? 'edit' : state.courses.length > 0 ? 'select' : 'new'
  );
  const [name, setName] = useState(existingCourse?.name ?? '');
  const [room, setRoom] = useState(existingCourse?.room ?? '');
  const [teacher, setTeacher] = useState(existingCourse?.teacher ?? '');
  const [color, setColor] = useState(existingCourse?.color ?? COURSE_COLORS[0]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [syllabus, setSyllabus] = useState<string[]>(existingCourse?.syllabus ?? Array(15).fill(''));
  const [showSyllabus, setShowSyllabus] = useState(false);
  
  // Slot offset for current cell
  const [slotOffset, setSlotOffset] = useState<'none' | 'second-half' | 'first-half'>(
    (date ? (state.cellOverrides[date + '-' + period] as any)?.slotOffset : (state.timetable[day + '-' + period] as any)?.slotOffset) ?? 'none'
  );

  const [className, setClassName] = useState(existingCourse?.className ?? '');
  const [objectives, setObjectives] = useState(existingCourse?.objectives ?? '');
  const [content, setContent] = useState(existingCourse?.content ?? '');
  const [requirements, setRequirements] = useState(existingCourse?.requirements ?? '');
  const [textbook, setTextbook] = useState(existingCourse?.textbook ?? '');
  const [references, setReferences] = useState(existingCourse?.references ?? '');
  const [preparation, setPreparation] = useState(existingCourse?.preparation ?? '');
  const [grading, setGrading] = useState(existingCourse?.grading ?? '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    const data = { 
      name: name.trim(), 
      room: room.trim(), 
      teacher: teacher.trim(), 
      color,
      syllabus: syllabus.some(s => s.trim()) ? syllabus : undefined,
      className: className.trim(),
      objectives: objectives.trim(),
      content: content.trim(),
      requirements: requirements.trim(),
      textbook: textbook.trim(),
      references: references.trim(),
      preparation: preparation.trim(),
      grading: grading.trim()
    };

    if (mode === 'select' && selectedCourseId) {
      setCellCourse(day, period, selectedCourseId, slotOffset, date);
    } else if (mode === 'new') {
      if (!name.trim()) return;
      const course = addCourse(data);
      setCellCourse(day, period, course.id, slotOffset, date);
    } else if (mode === 'edit' && existingCourse) {
      updateCourse({ ...existingCourse, ...data });
      setCellCourse(day, period, existingCourse.id, slotOffset, date);
    }
    onClose();
  };

  const updateSyllabusItem = (idx: number, val: string) => {
    const newSyllabus = [...syllabus];
    newSyllabus[idx] = val;
    setSyllabus(newSyllabus);
  };

  const handleDelete = () => {
    if (existingCourse || date) {
      setCellCourse(day, period, null, 'none', date);
    }
    onClose();
  };

  const handleDeleteCourse = () => {
    if (existingCourse && confirm('この科目をすべてのコマから削除しますか？')) {
      deleteCourse(existingCourse.id);
      onClose();
    }
  };

  const dayLabel = state.dayLabels[day] ?? '';
  const periodLabel = `${period + 1}限`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--large" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">
            {dayLabel}曜 {periodLabel} の設定
            {date && <span style={{ fontSize: '0.7rem', marginLeft: '8px', color: 'var(--accent-red)' }}>({date} のみ)</span>}
          </h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Mode tabs for non-edit */}
        {!existingCourse && state.courses.length > 0 && (
          <div style={{ padding: '0 24px 12px', display: 'flex', gap: '4px' }}>
            <button
              className={`btn ${mode === 'select' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('select')}
              style={{ flex: 1, fontSize: '0.8rem' }}
            >
              既存の科目から選ぶ
            </button>
            <button
              className={`btn ${mode === 'new' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('new')}
              style={{ flex: 1, fontSize: '0.8rem' }}
            >
              新しく登録する
            </button>
          </div>
        )}

        <div className="modal__body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {mode === 'select' ? (
            <div className="form-group">
              <label>科目を選択</label>
              <select
                className="input"
                value={selectedCourseId}
                onChange={e => setSelectedCourseId(e.target.value)}
              >
                <option value="">-- 選択してください --</option>
                {state.courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.room})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="grid grid--2">
                <div className="form-group">
                  <label>科目名</label>
                  <input
                    type="text"
                    className="input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="例: 線形代数学 I"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>教室</label>
                  <input
                    type="text"
                    className="input"
                    value={room}
                    onChange={e => setRoom(e.target.value)}
                    placeholder="例: A棟201"
                  />
                </div>
              </div>

              <div className="grid grid--2">
                <div className="form-group">
                  <label>教員名</label>
                  <input
                    type="text"
                    className="input"
                    value={teacher}
                    onChange={e => setTeacher(e.target.value)}
                    placeholder="例: 田中太郎"
                  />
                </div>
                <div className="form-group">
                  <label>クラス</label>
                  <input
                    type="text"
                    className="input"
                    value={className}
                    onChange={e => setClassName(e.target.value)}
                    placeholder="例: Aクラス / 2組"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>カラー</label>
                <div className="color-picker">
                  {COURSE_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`color-picker__swatch ${c === color ? 'color-picker__swatch--selected' : ''}`}
                      style={{ background: c, '--course-color': c } as React.CSSProperties}
                      onClick={() => setColor(c)}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>📍 表示タイミング (半コマ対応)</label>
                <div className="view-toggle" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                   <button 
                     type="button"
                     className={`view-toggle__btn ${slotOffset === 'none' ? 'view-toggle__btn--active' : ''}`}
                     onClick={() => setSlotOffset('none')}
                   >通常 (フル)</button>
                   <button 
                     type="button"
                     className={`view-toggle__btn ${slotOffset === 'first-half' ? 'view-toggle__btn--active' : ''}`}
                     onClick={() => setSlotOffset('first-half')}
                   >前半のみ</button>
                   <button 
                     type="button"
                     className={`view-toggle__btn ${slotOffset === 'second-half' ? 'view-toggle__btn--active' : ''}`}
                     onClick={() => setSlotOffset('second-half')}
                   >後半のみ</button>
                </div>
              </div>

              <div className="syllabus-section" style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <button 
                  type="button"
                  className="btn btn-ghost" 
                  style={{ width: '100%', justifyContent: 'space-between', fontSize: '0.9rem' }}
                  onClick={() => setShowSyllabus(!showSyllabus)}
                >
                  📖 授業計画 (全15回) を編集 
                  <span>{showSyllabus ? '▲' : '▼'}</span>
                </button>
                
                {showSyllabus && (
                  <div className="syllabus-grid" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {syllabus.map((text, i) => (
                      <div key={i} className="form-group" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: '40px' }}>第{i+1}回</span>
                          <input 
                            type="text" 
                            className="input" 
                            style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                            value={text} 
                            onChange={(e) => updateSyllabusItem(i, e.target.value)}
                            placeholder="例: 行列の演算"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="advanced-section" style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <button 
                  type="button"
                  className="btn btn-ghost" 
                  style={{ width: '100%', justifyContent: 'space-between', fontSize: '0.9rem' }}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  📄 詳細シラバス情報を編集 (目標・評価等)
                  <span>{showAdvanced ? '▲' : '▼'}</span>
                </button>

                {showAdvanced && (
                  <div className="advanced-fields" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="form-group">
                      <label>授業の目標</label>
                      <textarea className="input" rows={3} value={objectives} onChange={e => setObjectives(e.target.value)} placeholder="習得できる能力や目標..." />
                    </div>
                    <div className="form-group">
                      <label>学修内容</label>
                      <textarea className="input" rows={3} value={content} onChange={e => setContent(e.target.value)} placeholder="講義や演習の主な内容..." />
                    </div>
                    <div className="form-group">
                      <label>受講要件</label>
                      <textarea className="input" rows={2} value={requirements} onChange={e => setRequirements(e.target.value)} placeholder="必要な基礎知識など..." />
                    </div>
                    <div className="form-group">
                      <label>テキスト (教科書)</label>
                      <textarea className="input" rows={2} value={textbook} onChange={e => setTextbook(e.target.value)} placeholder="書名、著者、ISBN..." />
                    </div>
                    <div className="form-group">
                      <label>参考書</label>
                      <textarea className="input" rows={2} value={references} onChange={e => setReferences(e.target.value)} placeholder="補助的に使用する書籍..." />
                    </div>
                    <div className="form-group">
                      <label>予習・復習について</label>
                      <textarea className="input" rows={2} value={preparation} onChange={e => setPreparation(e.target.value)} placeholder="学習のアドバイス..." />
                    </div>
                    <div className="form-group">
                      <label>成績評価の方法・基準</label>
                      <textarea className="input" rows={3} value={grading} onChange={e => setGrading(e.target.value)} placeholder="試験や課題の配分..." />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal__actions">
          {existingCourse && (
            <div style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
              <button className="btn btn-danger" onClick={handleDelete} style={{ flex: 0 }}>
                {date ? 'この日だけ解除' : '解除'}
              </button>
              {!date && (
                <button
                  className="btn btn-danger"
                  onClick={handleDeleteCourse}
                  style={{ flex: 0, fontSize: '0.7rem', padding: '0 8px' }}
                >
                  科目自体を抹消
                </button>
              )}
            </div>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
