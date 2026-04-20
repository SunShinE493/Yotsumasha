'use client';

import { useState } from 'react';
import { useTimetable } from '@/lib/store';
import { cellKey } from '@/lib/types';

export default function AISnap() {
  const { state, importState, mergeState } = useTimetable();
  const [copied, setCopied] = useState(false);
  const [panelMode, setPanelMode] = useState<'export' | 'super' | 'photo' | 'syllabus' | 'import'>('export');
  const [format, setFormat] = useState<'markdown' | 'json'>('markdown');
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('merge');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const snapshot = format === 'markdown' ? generateMarkdown() : generateJSON();

  const superPrompt = `
あなたは大学の時間割管理エキスパートです。
提供された「履修登録画像」と「複数のシラバス情報」を統合し、一つのJSONデータを作成してください。

【解析手順】
1. 画像からどの曜日の何限にどの科目があるかを特定する。
2. テキスト（シラバス）から各科目の教員名、教室、および15回分の授業計画を特定する。
3. 抽出された情報を以下の構造でマージする。

【出力形式】
JSONのみ（テキスト解説不要）
{
  "courses": [
    { 
      "name": "科目名", 
      "room": "教室", 
      "teacher": "教員名", 
      "className": "クラス (組) 名",
      "color": "hsl(番号, 80%, 65%)", 
      "syllabus": ["第1回内容", "...", "第15回内容"],
      "objectives": "授業の目標内容 (改行含む)",
      "content": "学修内容の詳細 (改行含む)",
      "requirements": "受講要件・前提知識",
      "textbook": "使用テキスト・ISBN",
      "references": "参考書情報",
      "preparation": "予習・復習についての指示",
      "grading": "成績評価の方法と基準"
    }
  ],
  "timetable": {
    "day-period": { "courseId": "科目名" }
  }
}
※dayは 0:月〜6:日、periodは 0〜5回
※重複する科目はマージし、1つのcourse要素にまとめてください。
※各テキストフィールドには、元の文章の改行や箇条書きを適切に含めてください。
`.trim();

  const photoPrompt = `
あなたは大学の時間割管理アプリのデータ作成アシスタントです。
画像（履修登録画面等）から科目情報を抽出し、以下のJSON形式で出力してください。

【出力形式】
JSONのみ（コードブロックで囲む）
{
  "courses": [
    { "name": "科目名", "room": "教室名", "teacher": "教員名", "color": "hsl(220, 90%, 65%)" }
  ],
  "timetable": {
    "day-period": { "courseId": "科目名" } 
  }
}
※dayは 0:Mon, 1:Tue, 2:Wed, 3:Thu, 4:Fri, 5:Sat, 6:Sun
※periodは 0から始まる時限番号
`.trim();

  const syllabusPrompt = `
あなたはシラバス解析のプロフェッショナルです。
提供されたシラバス（15回分の授業計画）を抽出し、以下のJSON形式で出力してください。

【出力形式】
JSONのみ
{
  "courses": [
    {
      "name": "科目名",
      "teacher": "教員の名前",
      "className": "クラス (組) 名",
      "syllabus": ["第1回内容", "...", "第15回内容"],
      "objectives": "授業の目標内容 (改行含む)",
      "content": "学修内容の詳細 (改行含む)",
      "requirements": "受講要件・前提知識",
      "textbook": "使用テキスト・ISBN",
      "references": "参考書情報",
      "preparation": "予習・復習についての指示",
      "grading": "成績評価の方法と基準"
    }
  ]
}
※「授業計画」や「各回の内容」を15要素の配列にまとめてください。
`.trim();

  // ... (generateMarkdown, generateJSON functions same as before)

  function generateMarkdown(): string {
    const dayCount = state.showWeekend ? 7 : 5;
    const lines: string[] = [];
    lines.push('# 📅 時間割スナップショット');
    lines.push('');
    lines.push(`生成日時: ${new Date().toLocaleString('ja-JP')}`);
    lines.push('');

    // Header
    const header = ['時限', ...state.dayLabels.slice(0, dayCount)];
    lines.push('| ' + header.join(' | ') + ' |');
    lines.push('| ' + header.map(() => '---').join(' | ') + ' |');

    // Rows
    state.periods.forEach((p, pi) => {
      const cells = [`${pi + 1}限 (${p.start}-${p.end})`];
      for (let d = 0; d < dayCount; d++) {
        const entry = state.timetable[cellKey(d, pi)];
        if (entry) {
          const course = state.courses.find(c => c.id === entry.courseId);
          cells.push(course ? `${course.name} [${course.room}]` : '-');
        } else {
          cells.push('-');
        }
      }
      lines.push('| ' + cells.join(' | ') + ' |');
    });

    lines.push('');
    lines.push('## 科目一覧');
    state.courses.forEach(c => {
      lines.push(`- **${c.name}**: 教室 ${c.room || '未設定'}, 教員 ${c.teacher || '未設定'}`);
    });

    return lines.join('\n');
  }

  function generateJSON(): string {
    const dayCount = state.showWeekend ? 7 : 5;
    const schedule: Record<string, Record<string, { name: string; room: string; teacher: string } | null>> = {};
    for (let d = 0; d < dayCount; d++) {
      const dayName = state.dayLabels[d];
      schedule[dayName] = {};
      state.periods.forEach((p, pi) => {
        const entry = state.timetable[cellKey(d, pi)];
        const course = entry ? state.courses.find(c => c.id === entry.courseId) : null;
        schedule[dayName][`${pi + 1}限 (${p.start}-${p.end})`] = course
          ? { name: course.name, room: course.room, teacher: course.teacher }
          : null;
      });
    }
    return JSON.stringify({ generatedAt: new Date().toISOString(), schedule, courses: state.courses }, null, 2);
  }

  const handleCopy = async (textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = textToCopy;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleImport = () => {
    try {
      setImportError('');
      const parsed = JSON.parse(importText);
      if (parsed && typeof parsed === 'object') {
        const normalized: any = { ...parsed };

        // Handle AI generated format or Syllabus format
        if (parsed.courses) {
          const courseMap: Record<string, string> = {};
          normalized.courses = parsed.courses.map((c: any) => {
            const existing = state.courses.find(ex => ex.name === c.name);
            const newId = existing?.id || Math.random().toString(36).substring(2, 9);
            courseMap[c.name] = newId;
            return { ...c, id: newId };
          });

          if (parsed.timetable) {
            Object.keys(parsed.timetable).forEach(k => {
              const entry = parsed.timetable[k];
              if (entry && entry.courseId && courseMap[entry.courseId]) {
                normalized.timetable[k] = {
                  courseId: courseMap[entry.courseId],
                  slotOffset: entry.slotOffset
                };
              }
            });
          }
        }

        if (importMode === 'overwrite') {
          if (!parsed.periods) parsed.periods = state.periods;
          importState(normalized);
        } else {
          mergeState(normalized);
        }

        setImportText('');
        alert('インポートが完了しました。');
      }
    } catch (e: any) {
      setImportError('エラー: 有効な JSON 形式を入力してください。' + e.message);
    }
  };

  return (
    <div className="ai-panel glass">
      <div className="ai-panel__header">
        <span className="ai-panel__title">
          ✨ AI アシスタント
        </span>
        <div className="view-toggle" style={{ fontSize: '0.7rem' }}>
          <button
            className={`view-toggle__btn ${panelMode === 'export' ? 'view-toggle__btn--active' : ''}`}
            onClick={() => setPanelMode('export')}
          >
            書き出し
          </button>
          <button
            className={`view-toggle__btn ${panelMode === 'super' ? 'view-toggle__btn--active' : ''}`}
            onClick={() => setPanelMode('super')}
          >
            ⭐ Super
          </button>
          <button
            className={`view-toggle__btn ${panelMode === 'photo' ? 'view-toggle__btn--active' : ''}`}
            onClick={() => setPanelMode('photo')}
          >
            📸 画像
          </button>
          <button
            className={`view-toggle__btn ${panelMode === 'syllabus' ? 'view-toggle__btn--active' : ''}`}
            onClick={() => setPanelMode('syllabus')}
          >
            📖 シラバス
          </button>
          <button
            className={`view-toggle__btn ${panelMode === 'import' ? 'view-toggle__btn--active' : ''}`}
            onClick={() => setPanelMode('import')}
          >
            取り込み
          </button>
        </div>
      </div>

      <div className="ai-panel__body">
        {panelMode === 'export' ? (
          <>
            <div className="view-toggle" style={{ fontSize: '0.7rem', marginBottom: '8px', width: 'fit-content' }}>
              <button
                className={`view-toggle__btn ${format === 'markdown' ? 'view-toggle__btn--active' : ''}`}
                onClick={() => setFormat('markdown')}
              >
                Markdown
              </button>
              <button
                className={`view-toggle__btn ${format === 'json' ? 'view-toggle__btn--active' : ''}`}
                onClick={() => setFormat('json')}
              >
                JSON
              </button>
            </div>
            <div className="ai-panel__output" style={{ maxHeight: '180px' }}>{snapshot}</div>
            <div className="ai-panel__actions">
              <button className="btn btn-primary" onClick={() => handleCopy(snapshot)}>
                {copied ? '✓ コピー完了' : '📋 クリップボードにコピー'}
              </button>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                Gemini/NotebookLMの解析用データとして活用できます
              </span>
            </div>
          </>
        ) : panelMode === 'super' ? (
          <>
            <div style={{ fontSize: '0.8rem', marginBottom: '10px' }}>
              <p><strong>最強モード:</strong> 画像と全シラバスを一気にAIに渡して、完璧な全データを生成します。</p>
            </div>
            <div className="ai-panel__output" style={{ fontSize: '0.7rem', whiteSpace: 'pre-wrap', maxHeight: '120px' }}>
              {superPrompt}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px', background: 'var(--gradient-hero)' }} onClick={() => handleCopy(superPrompt)}>
              🚀 Superプロンプトをコピー
            </button>
            <div className="hint-box">
              <strong>手順:</strong> 1. 指示をコピー 2. Gemini/NotebookLMに指示・画像・全シラバス文書をまとめて送信 3. 返答JSONを「取り込み」へ貼り付け
            </div>
          </>
        ) : panelMode === 'photo' ? (
          <>
            <div style={{ fontSize: '0.8rem', marginBottom: '10px' }}>
              <p>履修登録画面を画像保存し、AIに解析させて自動登録します。</p>
            </div>
            <div className="ai-panel__output" style={{ fontSize: '0.7rem', whiteSpace: 'pre-wrap', maxHeight: '100px' }}>
              {photoPrompt}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} onClick={() => handleCopy(photoPrompt)}>
              📋 画像解析プロンプトをコピー
            </button>
            <div className="hint-box">
              <strong>手順:</strong> 1. 指示をコピー 2. Gemini等のAIに指示と画像を送信 3. 返答を「取り込み」へ
            </div>
          </>
        ) : panelMode === 'syllabus' ? (
          <>
            <div style={{ fontSize: '0.8rem', marginBottom: '10px' }}>
              <p>NotebookLM 等にシラバスを読み込ませ、15回分の内容を自動抽出します。</p>
            </div>
            <div className="ai-panel__output" style={{ fontSize: '0.7rem', whiteSpace: 'pre-wrap', maxHeight: '100px' }}>
              {syllabusPrompt}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} onClick={() => handleCopy(syllabusPrompt)}>
              📋 シラバス解析プロンプトをコピー
            </button>
            <div className="hint-box">
              <strong>ヒント:</strong> NotebookLMに講義資料（PDF等）をアップロードし、この指示を送ると正確に抽出されます。
            </div>
          </>
        ) : (
          <>
            <div className="view-toggle" style={{ fontSize: '0.7rem', marginBottom: '8px', width: 'fit-content' }}>
              <button
                className={`view-toggle__btn ${importMode === 'merge' ? 'view-toggle__btn--active' : ''}`}
                onClick={() => setImportMode('merge')}
              >
                追加 (既存保持)
              </button>
              <button
                className={`view-toggle__btn ${importMode === 'overwrite' ? 'view-toggle__btn--active' : ''}`}
                onClick={() => setImportMode('overwrite')}
              >
                上書き (クリア)
              </button>
            </div>
            <textarea
              className="ai-panel__output"
              style={{ width: '100%', minHeight: '130px', background: 'var(--bg-secondary)', border: '1px solid var(--border-focus)' }}
              placeholder="AIが出力したJSONをここに貼り付け..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            {importError && <div style={{ color: 'var(--accent-red)', fontSize: '0.7rem', marginTop: '4px' }}>{importError}</div>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} onClick={handleImport} disabled={!importText.trim()}>
              📥 データを反映する
            </button>
          </>
        )}
      </div>

      <style jsx>{`
        .hint-box {
          font-size: 0.7rem;
          margin-top: 10px;
          padding: 8px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
