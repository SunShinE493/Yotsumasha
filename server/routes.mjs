import { createServer } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage.mjs";
import * as fileUtils from "./utils.mjs";
import { setupAuth, isAuthenticated, optionalAuthentication } from "./auth.mjs";
import {
  vocabularyFileSchema,
  studyConfigSchema,
  insertWordProgressSchema
} from "../shared/schema.mjs";
import fetch from "node-fetch";
import { WebSocketServer } from "ws";
import bcrypt from "bcrypt";

let isSavingToGist = false;
let pendingSaveToGist = false;

async function saveAllDataToGist() {
  if (isSavingToGist) {
    pendingSaveToGist = true;
    return;
  }
  isSavingToGist = true;
  pendingSaveToGist = false;

  try {
    const token = process.env.GIST_TOKEN;
    const gistId = process.env.GIST_ID;
    const file = process.env.GIST_FILE || 'backup.json';
    if (!token || !gistId) {
      console.warn('Gist env not configured for automatic backup');
      isSavingToGist = false;
      return false;
    }

    // ユーザーデータを全てエクスポートし、JSON形式でGistにパッチ（更新）する
    const all = await storage.exportAllUsersData();

    // Read extra files (schedule.json, wordlist.json) if they exist
    const extraFiles = {};
    const fs = await import('fs/promises');
    for (const fname of ['schedule.json', 'wordlist.json', 'word list.json']) {
      try {
        const content = await fs.readFile(fname, 'utf8');
        extraFiles[fname] = content;
      } catch { }
    }

    // Read all uploaded JSON files
    const uploadedFiles = {};
    try {
      const uploads = await fileUtils.exportUploadedJsonFiles(); // returns array of {name, content}
      for (const up of uploads) {
        uploadedFiles[up.name] = up.content;
      }
    } catch { }

    // Embed into backup payload
    if (Object.keys(extraFiles).length) all.extraFiles = extraFiles;

    const payload = {
      files: { [file]: { content: JSON.stringify(all, null, 2) } }
    };

    // Add uploaded files as separate entries in 'files'
    for (const [name, content] of Object.entries(uploadedFiles)) {
      payload.files[name] = { content: content };
    }
    const r = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const text = await r.text();
      console.error('Failed to auto-save to gist:', r.status, text);
    } else {
      console.log('Successfully auto-saved to Gist');
    }
  } catch (e) {
    console.error('Failed to auto-save to Gist:', e);
  } finally {
    isSavingToGist = false;
    if (pendingSaveToGist) {
      setTimeout(() => {
        saveAllDataToGist();
      }, 5000);
    }
  }
}

/**
 * AIとの通信を行う統合ヘルパー関数
 * - preferOllamaが真の場合、またはAPIキーがない場合はローカルのOllama (http://localhost:11434) を試行
 * - それ以外、またはOllama失敗時は Google Gemini (GOOGLE_API_KEY) / Groq を使用
 */
async function callAI(prompt, systemInstruction, preferOllama = false) {
  if (preferOllama) {
    try {
      console.log("[Aura AI] Attempting Ollama (local)...");
      const r = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemma', // ユーザー指定のgemmaをデフォルトに設定
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          stream: false,
          options: { temperature: 0.7 }
        })
      });
      if (r.ok) {
        const json = await r.json();
        return json.message?.content || json.response || "";
      } else {
        console.warn("[Aura AI] Ollama returned status " + r.status);
      }
    } catch (e) {
      console.warn("[Aura AI] Ollama local connection failed (falling back): " + e.message);
    }
  }

  // Google Gemini APIをフォールバックまたはメインエンジンとして使用
  const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (googleApiKey) {
    try {
      console.log("[Aura AI] Using Google Gen AI (Gemini)...");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\nUser Request:\n${prompt}` }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        })
      });
      if (response.ok) {
        const resJson = await response.json();
        return resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        const errText = await response.text();
        console.error("[Aura AI] Gemini API error: " + response.status + " " + errText);
      }
    } catch (err) {
      console.error("[Aura AI] Gemini API connection failed: ", err);
    }
  }

  // DeepSeek / Groq を最終フォールバックとして使用
  const groqApiKey = process.env.Deepseek_API;
  if (groqApiKey) {
    try {
      console.log("[Aura AI] Using Groq (DeepSeek/Llama)...");
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        })
      });
      if (response.ok) {
        const resJson = await response.json();
        return resJson.choices?.[0]?.message?.content || "";
      }
    } catch (err) {
      console.error("[Aura AI] Groq API failed: ", err);
    }
  }

  throw new Error("No AI service available (Ollama, Gemini, and Groq all failed or are not configured).");
}

export async function registerRoutes(app) {
  // Setup authentication middleware
  setupAuth(app);

  const {
    listAvailableJsonCatalog,
    readUploadedJsonFile,
    saveUploadedJsonFile,
    deleteUploadedJsonFile,
    exportUploadedJsonFiles,
    applyUploadedJsonFiles,
    BUILTIN_JSON_FILES,
  } = fileUtils;


  // --- Realtime battle (rooms state shared for HTTP list + WS) ---
  const rooms = new Map(); // roomId -> { host, timeLimit, maxQuestions, asked, words, state, players: Map(name->ws), scores: Map(name->number>, idx, timer, cleanupTimer, lastCorrectBy }

  // Guest access route - allows users to continue without login
  app.post('/api/guest/continue', (req, res) => {
    // Generate unique guest ID per session
    if (!req.session.guestId) {
      req.session.guestId = `guest_${randomUUID()}`;
    }

    res.json({
      id: req.session.guestId,
      username: 'ゲストユーザー',
      isGuest: true,
      message: 'ゲストとしてアクセス中です'
    });
  });
  // Guest logout/clear route - clears guest session data
  app.post('/api/guest/logout', (req, res) => {
    if (req.session.guestId) {
      // Clear guest data from storage
      storage.clearGuestData(req.session.guestId);

      // Clear guest ID from session
      delete req.session.guestId;
    }

    res.json({ message: 'ゲストデータをクリアしました' });
  });

  // Admin: overwrite built-in JSON (password required)
  app.post('/api/admin/files/builtin', optionalAuthentication, async (req, res) => {
    try {
      if (!isBackupAdmin(req)) return res.status(403).json({ message: 'forbidden' });
      const { name, content } = req.body || {};
      if (!name || typeof name !== 'string' || typeof content !== 'string') {
        return res.status(400).json({ message: 'name and content are required' });
      }
      if (!BUILTIN_JSON_FILES.includes(name)) {
        return res.status(400).json({ message: 'Not a built-in file' });
      }
      // Validate JSON (array of {word,meaning})
      let parsed;
      try {
        parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) throw new Error('must be array');
        for (const item of parsed) {
          if (!item || typeof item !== 'object' || !item.word || !item.meaning) {
            throw new Error('invalid word record');
          }
        }
      } catch (e) {
        return res.status(400).json({ message: 'invalid json content', error: e?.message || String(e) });
      }
      // Resolve path and write
      const resolved = await fileUtils.resolveJsonFilePath(name);
      const fs = await import('fs/promises');
      await fs.writeFile(resolved.path, JSON.stringify(parsed, null, 2), 'utf8');
      return res.json({ ok: true, name, wordCount: parsed.length });
    } catch (e) {
      res.status(500).json({ message: 'failed to save builtin', error: e?.message || String(e) });
    }
  });

  // --- Admin backup/restore gated by env ---
  function isBackupAdmin(req) {
    const envUser = process.env.BACKUP_ADMIN_EMAIL;
    const envPass = process.env.BACKUP_ADMIN_PASSWORD;
    const bodyEmail = req.body?.email;
    const bodyPassword = req.body?.password;
    const sessionUserEmail = req.user?.username || null;
    const isDevFlag = req.user?.isDev === true;
    // Developer flag in session grants access directly
    if (isDevFlag) return true;
    // Otherwise require env credentials and that the logged-in user matches admin email
    return (
      !!envUser && !!envPass &&
      bodyEmail === envUser &&
      bodyPassword === envPass &&
      sessionUserEmail === envUser
    );
  }

  // CSRF-exempt for developer account (handled in auth through isDev)
  app.post('/api/admin/export', optionalAuthentication, async (req, res) => {
    try {
      if (!isBackupAdmin(req)) return res.status(403).json({ message: 'forbidden' });
      const full = req.body && req.body.full === true;
      const incorrectOnly = req.body && req.body.incorrectOnly === true;
      // If "all" flag is provided, export all users' data
      if (req.body && req.body.all === true) {
        if (incorrectOnly) {
          const all = await storage.exportAllUsersIncorrectOnly();
          return res.json(all);
        }
        const all = full ? await storage.exportAllUsersDataFull() : await storage.exportAllUsersData();
        return res.json(all);
      }
      const data = full ? await storage.exportUserDataFull(req.userId) : await storage.exportUserData(req.userId);
      return res.json(data);
    } catch (e) {
      res.status(500).json({ message: 'failed to export' });
    }
  });

  // Backup to GitHub Gist (UIから操作するバックアップ。環境変数 GIST_TOKEN, GIST_ID, GIST_FILE(optional) が必要)
  app.post('/api/admin/backup/gist', optionalAuthentication, async (req, res) => {
    try {
      if (!isBackupAdmin(req)) return res.status(403).json({ message: 'forbidden' });
      const token = process.env.GIST_TOKEN;
      const gistId = process.env.GIST_ID;
      const file = process.env.GIST_FILE || 'backup.json';
      if (!token || !gistId) return res.status(400).json({ message: 'Gist env not configured' });

      // ユーザーデータを全てエクスポートし、JSON形式でGistにパッチ（更新）する
      const all = await storage.exportAllUsersData();

      // Read extra files (schedule.json, wordlist.json) if they exist
      const extraFiles = {};
      const fs = await import('fs/promises');
      for (const fname of ['schedule.json', 'wordlist.json', 'word list.json']) {
        try {
          const content = await fs.readFile(fname, 'utf8');
          extraFiles[fname] = content;
        } catch { }
      }

      // Read all uploaded JSON files
      const uploadedFiles = {};
      try {
        const uploads = await fileUtils.exportUploadedJsonFiles(); // returns array of {name, content}
        for (const up of uploads) {
          uploadedFiles[up.name] = up.content;
        }
      } catch { }

      // Embed into backup payload
      if (Object.keys(extraFiles).length) all.extraFiles = extraFiles;

      // uploadedFiles are now handled as separate files in the gist, not embedded in backup.json
      // We keep old logic (if (Object.keys(uploadedFiles).length) all.uploadedFiles = uploadedFiles;) mostly for migration safety? 
      // User requested separate files, so we simply DON'T embed them here.

      const payload = {
        files: { [file]: { content: JSON.stringify(all, null, 2) } }
      };

      // Add uploaded files as separate entries in 'files'
      for (const [name, content] of Object.entries(uploadedFiles)) {
        payload.files[name] = { content: content };
      }
      const r = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!r.ok) {
        const text = await r.text();
        return res.status(500).json({ message: 'Failed to update gist', status: r.status, body: text });
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ message: 'backup failed' });
    }
  });

  // Fetch backup from Gist (UIから操作するリストア/復元)
  app.post('/api/admin/backup/gist/fetch', optionalAuthentication, async (req, res) => {
    try {
      if (!isBackupAdmin(req)) return res.status(403).json({ message: 'forbidden' });
      const apply = req.body && req.body.apply === true;
      try {
        const result = await performRestoreFromGist(apply);
        res.json(result);
      } catch (e) {
        if (e.message.includes('not configured')) return res.status(400).json({ message: e.message });
        if (e.message.includes('File not found')) return res.status(404).json({ message: e.message });
        if (e.status) return res.status(500).json({ message: 'Failed to fetch gist', status: e.status, body: e.body });
        throw e;
      }
    } catch (e) {
      res.status(500).json({ message: 'fetch failed', error: e.message });
    }
  });

  // Aura Timetable Data sync to Gist (per user)
  app.post('/api/aura/gist/save', optionalAuthentication, async (req, res) => {
    try {
      const data = req.body;
      const gistUtils = await import('../shared/gistUtils.mjs');
      const fileData = await gistUtils.getGistFile('aura-timetable-backup.json') || {};
      fileData[req.userId] = data; // store by userId to support multiple users
      const success = await gistUtils.updateGistFile('aura-timetable-backup.json', fileData);
      if (success) {
        res.json({ ok: true });
      } else {
        res.status(500).json({ message: 'failed to save to gist' });
      }
    } catch (e) {
      res.status(500).json({ message: 'failed to save', error: e.message });
    }
  });

  app.get('/api/aura/gist/load', optionalAuthentication, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const gistUtils = await import('../shared/gistUtils.mjs');
      const fileData = await gistUtils.getGistFile('aura-timetable-backup.json');
      if (fileData && fileData[req.userId]) {
        res.json(fileData[req.userId]);
      } else {
        res.status(404).json({ message: 'No backup found for this user' });
      }
    } catch (e) {
      res.status(500).json({ message: 'failed to load', error: e.message });
    }
  });

  // Proxy to Google Apps Script to bypass CORS
  app.post('/api/aura/gas', optionalAuthentication, async (req, res) => {
    try {
      const { gasUrl, payload } = req.body || {};
      if (!gasUrl) {
        return res.status(400).json({ message: "GAS URL is required" });
      }

      const fetchRes = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });

      if (!fetchRes.ok) {
        const text = await fetchRes.text();
        return res.status(fetchRes.status).json({ message: `GAS returned status ${fetchRes.status}: ${text}` });
      }

      const data = await fetchRes.json();
      res.json(data);
    } catch (e) {
      console.error('GAS Proxy Error:', e);
      res.status(500).json({ message: "Failed to communicate with GAS", error: e.message });
    }
  });

  // Aura AI Schedule Optimization Route
  app.post('/api/aura/ai/schedule', optionalAuthentication, async (req, res) => {
    try {
      const data = req.body; // Full state sent from frontend
      if (!data.gasSyncUrl) {
        return res.status(400).json({ message: "GASの同期URLが設定されていません。「設定」から入力してください。" });
      }
      
      // Calculate date range for the next 14 days
      const now = new Date();
      const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      
      const startDate = formatDate(now);
      const endDateObj = new Date(now);
      endDateObj.setDate(now.getDate() + 13); // 2 weeks
      const endDate = formatDate(endDateObj);
      
      console.log(`[Aura AI] Fetching free slots from GAS between ${startDate} and ${endDate}...`);
      
      // 1. Call GAS to get free slots
      const gasResponse = await fetch(data.gasSyncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "getFreeSlots",
          startDate: startDate,
          endDate: endDate,
          periods: data.periods,
          timetable: data.timetable,
          dayOverrides: data.dayOverrides,
          cellOverrides: data.cellOverrides,
          semesterStart: data.semesterSettings?.start,
          semesterEnd: data.semesterSettings?.end,
          showWeekend: data.showWeekend
        })
      });
      
      if (!gasResponse.ok) {
        throw new Error(`GASへの空き時間問い合わせに失敗しました（ステータス: ${gasResponse.status}）`);
      }
      
      const gasResult = await gasResponse.json();
      if (gasResult.status !== "success" || !Array.isArray(gasResult.freeSlots)) {
        throw new Error("GASからの空き時間応答データ形式が正しくありません: " + JSON.stringify(gasResult));
      }
      
      const freeSlots = gasResult.freeSlots;
      const uncompletedTodos = (data.todos || []).filter(t => !t.completed);
      
      if (uncompletedTodos.length === 0) {
        return res.json({
          scheduledTasks: [],
          message: "未完了のタスクがありません！TODOリストにタスクを追加しましょう。✨"
        });
      }
      
      if (freeSlots.length === 0) {
        return res.json({
          scheduledTasks: [],
          message: "直近2週間に空き時間がありません。少し予定を調整するか、適度に休憩を挟みましょうね。☕"
        });
      }
      
      // 2. Call Gemini/Gemma to optimize schedule
      console.log(`[Aura AI] Optimizing schedule for ${uncompletedTodos.length} tasks and ${freeSlots.length} free slots...`);
      
      const optimizePrompt = `
Uncompleted Tasks:
${JSON.stringify(uncompletedTodos.map(t => ({ id: t.id, text: t.text, targetDate: t.targetDate, courseId: t.courseId })), null, 2)}

Available Free Slots (next 14 days):
${JSON.stringify(freeSlots, null, 2)}
`;
      
      const systemInstruction = `
You are the Aura AI Assistant, an advanced timetable and task scheduling agent for university students.
Your goal is to optimize the student's study schedule by fitting their uncompleted tasks (todos) into their empty time slots (freeSlots).

RULES:
1. You must ONLY assign tasks to available free time slots in the provided 'freeSlots' array. It is STRICTLY FORBIDDEN to use any date or period not present in 'freeSlots'.
2. A single time slot (defined by 'date' and 'period') can hold at most ONE task.
3. You do not need to assign all tasks if there are not enough free slots. Focus on assigning the highest priority tasks first.
4. If a task has a targetDate, prioritize putting it on or before that date.
5. The schedule output MUST be a valid JSON array of objects. Do not include any explanations or markdown.

OUTPUT FORMAT:
Output ONLY a raw JSON array matching this format (no markdown code blocks like \`\`\`json, no explanation):
[
  {
    "todoId": "The ID of the todo task",
    "text": "The text description of the task",
    "date": "YYYY-MM-DD of the assigned slot",
    "period": number (0-based period index)
  }
]
`;
      
      let scheduledTasksText = "";
      try {
        // 重たい最適化処理はGoogle Geminiを使用
        scheduledTasksText = await callAI(optimizePrompt, systemInstruction, false);
      } catch (aiErr) {
        console.error("[Aura AI] Scheduling model call failed: ", aiErr);
        throw aiErr;
      }
      
      // Parse output
      let scheduledTasks = [];
      try {
        let cleanText = scheduledTasksText.trim();
        if (cleanText.startsWith("```")) {
          cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }
        let parsedTasks = JSON.parse(cleanText);
        
        // Validation: Ensure assigned slots are strictly within freeSlots
        const validTasks = [];
        for (const task of parsedTasks) {
           const isValidSlot = freeSlots.some(slot => slot.date === task.date && slot.period === task.period);
           if (isValidSlot) {
             validTasks.push(task);
           } else {
             console.warn(`[Aura AI] Removed invalid assignment (not in freeSlots): ${task.date} period ${task.period}`);
           }
        }
        scheduledTasks = validTasks;
      } catch (jsonErr) {
        console.error("[Aura AI] Failed to parse schedule JSON. Raw was: " + scheduledTasksText);
        throw new Error("AIからの応答データをパースできませんでした。もう一度お試しください。");
      }
      
      // 3. Call Ollama (Lightweight operation) to generate the motivational message!
      console.log("[Aura AI] Generating motivating advice using Ollama...");
      const messagePrompt = `
以下のスケジュール割り当てが決定しました。
${JSON.stringify(scheduledTasks.map(t => ({ text: t.text, date: t.date, period: t.period + 1 })), null, 2)}

この結果を踏まえ、学生に向けて温かくモチベーションを高めるアドバイス・メッセージを日本語で2〜3文で作成してください。
疲労に配慮した優しいトーンでお願いします。
`;
      
      const messageSystemInstruction = `
You are a warm, supportive, and empathetic AI coach who encourages university students.
Generate a motivating 2-3 sentence message in Japanese based on the student's study plan.
`;
      
      let adviceMessage = "";
      try {
        // 比較的軽い操作（メッセージ生成）にはOllamaを優先して使用！
        adviceMessage = await callAI(messagePrompt, messageSystemInstruction, true);
      } catch (msgErr) {
        console.warn("[Aura AI] Ollama advice call failed, falling back: ", msgErr);
        adviceMessage = "新しいスケジュール案を作成しました！空き時間を活用して、一歩ずつ進めていきましょう。応援しています！🌟";
      }
      
      // 4. Save the generated plan to Gist (plan.json)
      try {
        const gistUtils = await import('../shared/gistUtils.mjs');
        const planData = await gistUtils.getGistFile('aura-timetable-plan.json') || {};
        const newPlan = {
          message: adviceMessage.trim(),
          scheduledTasks: scheduledTasks,
          generatedAt: Date.now()
        };
        planData[req.userId] = newPlan;
        await gistUtils.updateGistFile('aura-timetable-plan.json', planData);
        console.log("[Aura AI] Plan successfully saved to Gist.");
      } catch (gistErr) {
        console.error("[Aura AI] Failed to save plan to Gist:", gistErr);
      }
      
      res.json({
        scheduledTasks: scheduledTasks,
        message: adviceMessage.trim()
      });
      
    } catch (e) {
      console.error("[Aura AI] AI Schedule error:", e);
      res.status(500).json({ message: "スケジュール生成中にエラーが発生しました", error: e.message });
    }
  });

  app.post('/api/aura/ai/schedule/confirm', optionalAuthentication, async (req, res) => {
    try {
      const { gasSyncUrl, tasks, periods } = req.body;
      if (!gasSyncUrl) {
        return res.status(400).json({ message: "gasSyncUrl is required" });
      }
      
      console.log(`[Aura AI] Confirming and writing ${tasks.length} tasks to Google Calendar...`);
      
      const gasResponse = await fetch(gasSyncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "writeTasks",
          tasks: tasks,
          periods: periods
        })
      });
      
      if (!gasResponse.ok) {
        throw new Error(`GAS write request failed with status ${gasResponse.status}`);
      }
      
      const gasResult = await gasResponse.json();
      if (gasResult.status !== "success") {
        throw new Error("GAS task write returned failure status: " + JSON.stringify(gasResult));
      }
      
      res.json({ ok: true, created: gasResult.created });
      
    } catch (e) {
      console.error("[Aura AI] Schedule confirmation error:", e);
      res.status(500).json({ message: "スケジュール確定処理中にエラーが発生しました", error: e.message });
    }
  });

  app.post('/api/gist/autosave', optionalAuthentication, async (req, res) => {
    try {
      saveAllDataToGist().catch(err => console.error("Gist auto-save failed in autosave endpoint:", err));
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ message: 'failed to trigger gist save', error: e.message });
    }
  });

  app.post('/api/admin/import', optionalAuthentication, async (req, res) => {
    try {
      if (!isBackupAdmin(req)) return res.status(403).json({ message: 'forbidden' });
      const body = req.body || {};
      // Bulk import: support users at top-level or inside data
      const list = Array.isArray(body.users) ? body.users : (Array.isArray(body.data?.users) ? body.data.users : null);
      if (list) {
        let count = 0;
        for (const entry of list) {
          const u = entry?.user || {};
          // Normalize password: prefer passwordHash; if plain password provided, hash it; if hashed ($2*) keep as is
          let normalizedPassword = null;
          if (typeof u.passwordHash === 'string' && u.passwordHash.length > 0) {
            normalizedPassword = u.passwordHash;
          } else if (typeof u.password === 'string' && u.password.length > 0) {
            normalizedPassword = u.password.startsWith('$2') ? u.password : await bcrypt.hash(u.password, 12);
          }
          // Upsert user meta first (id/username/isDev/displayName/passwordHash)
          const up = await storage.upsertUser({
            id: u.id,
            username: u.username || u.email || null,
            isDev: !!u.isDev,
            displayName: u.displayName || null,
            isGuest: !!u.isGuest,
            ...(normalizedPassword ? { password: normalizedPassword } : {}),
          });
          // Accept shapes: {data:{...}} or {reviewWords:[...]}
          const payload = entry?.data || entry;
          await storage.importUserData(up.id, payload);
          count++;
        }
        return res.json({ ok: true, imported: count });
      }
      // Single import; allow specifying target user in payload
      const userMeta = body.user || body.data?.user;
      let targetId = req.userId;
      if (userMeta) {
        let normalizedPassword = null;
        if (typeof userMeta.passwordHash === 'string' && userMeta.passwordHash.length > 0) {
          normalizedPassword = userMeta.passwordHash;
        } else if (typeof userMeta.password === 'string' && userMeta.password.length > 0) {
          normalizedPassword = userMeta.password.startsWith('$2') ? userMeta.password : await bcrypt.hash(userMeta.password, 12);
        }
        const up = await storage.upsertUser({
          id: userMeta.id,
          username: userMeta.username || userMeta.email || null,
          isDev: !!userMeta.isDev,
          displayName: userMeta.displayName || null,
          isGuest: !!userMeta.isGuest,
          ...(normalizedPassword ? { password: normalizedPassword } : {}),
        });
        targetId = up.id;
      }
      // Accept shapes: { data: {...} } OR { reviewWords: [...] }
      const payload = body?.data || body;
      await storage.importUserData(targetId, payload);
      res.json({ ok: true, userId: targetId });
    } catch (e) {
      res.status(500).json({ message: 'failed to import' });
    }
  });

  // --- Admin: Reset a user's password (hash and set) ---
  app.post('/api/admin/user/reset-password', optionalAuthentication, async (req, res) => {
    try {
      if (!isBackupAdmin(req)) return res.status(403).json({ message: 'forbidden' });
      const { username, userId, newPassword } = req.body || {};
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ message: 'invalid newPassword' });
      }
      let target = null;
      if (userId) {
        target = await storage.getUser(userId);
      } else if (username) {
        target = await storage.getUserByUsername(username);
      }
      if (!target) return res.status(404).json({ message: 'user not found' });
      const hashed = await bcrypt.hash(newPassword, 12);
      await storage.upsertUser({ id: target.id, username: target.username, password: hashed });
      res.json({ ok: true, userId: target.id });
    } catch (e) {
      res.status(500).json({ message: 'failed to reset password' });
    }
  });

  // --- Open rooms listing for battle ---
  app.get('/api/battle/rooms', (_req, _res, next) => {
    // Defer to upstream route (main server) so both don't conflict
    return next();
  });

  // Upload vocabulary JSON file
  app.post("/api/vocabulary/upload", optionalAuthentication, async (req, res) => {
    try {
      const { words } = vocabularyFileSchema.parse(req.body);
      const userId = req.userId;
      const replace = !!req.body?.replace;

      // If replace flag is provided, clear existing vocabulary first
      if (replace) {
        await storage.clearVocabularyWords(userId);
      }
      // Append words without clearing (default behavior)
      const createdWords = await storage.createVocabularyWords(userId, words);

      // Auto-save to Gist
      saveAllDataToGist().catch(err => console.error("Gist auto-save failed in upload:", err));

      res.json({
        message: "Vocabulary uploaded successfully",
        count: createdWords.length,
        words: createdWords
      });
    } catch (error) {
      res.status(400).json({
        message: "Invalid vocabulary file format",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get all vocabulary words
  app.get("/api/vocabulary", optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const sourceFile = req.query.source;

      let words;
      if (sourceFile) {
        // Load from JSON file
        words = await fileUtils.loadVocabularyFromJson(sourceFile);
      } else {
        // Load from MemStorage
        words = await storage.getVocabularyWords(userId);
      }
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: error.message || "Failed to fetch vocabulary" });
    }
  });

  // Get vocabulary words in range
  app.get("/api/vocabulary/range/:start/:end", optionalAuthentication, async (req, res) => {
    try {
      const start = parseInt(req.params.start);
      const end = parseInt(req.params.end);
      const userId = req.userId;
      const sourceFile = req.query.source;

      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        return res.status(400).json({ message: "Invalid range parameters" });
      }

      let words;
      if (sourceFile) {
        const allWords = await fileUtils.loadVocabularyFromJson(sourceFile);
        words = allWords.slice(start - 1, end);
      } else {
        words = await storage.getVocabularyWordsInRange(userId, start, end);
      }
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: error.message || "Failed to fetch vocabulary range" });
    }
  });

  // Create study session
  app.post("/api/study/session", optionalAuthentication, async (req, res) => {
    try {
      const config = studyConfigSchema.parse(req.body);
      const userId = req.userId;

      const session = await storage.createStudySession(userId, {
        startRange: config.startRange,
        endRange: config.endRange,
        // Store requested count for traceability; will be corrected after words are resolved
        totalWords: config.questionCount,
        sourceFile: config.sourceFile,
      });

      let words;
      if (config.sourceFile) {
        const allWords = await fileUtils.loadVocabularyFromJson(config.sourceFile);
        words = allWords.slice(config.startRange - 1, config.endRange);
      } else {
        words = await storage.getVocabularyWordsInRange(userId, config.startRange, config.endRange);
      }

      // Filter by difficulty if provided
      if (config.selectedDifficulties && Array.isArray(config.selectedDifficulties) && config.selectedDifficulties.length > 0) {
        const selectedDiffSet = new Set(config.selectedDifficulties.map(d => String(d)));
        words = words.filter(w => {
          // Allow words with no difficulty if we aren't strict, but usually if filtering we want specific ones.
          // Requirement: "difficulty がない場合にはこの処理はしないようにしてください" -> This implies if difficulty exists in JSON, we filter.
          // But if user SELECTS difficulties, we probably only want those matches.
          // However, if the word has NO difficulty property, should it be included? 
          // User said: "difficulty がある場合には、その難易度を選択できるようにしてください。(複数選択可)... difficulty がない場合にはこの処理はしない"
          // Let's assume if word has difficulty, check it. If not, include it? OR exclude?
          // Usually UI only shows selector if difficulties exist. If selector active, we probably expect filtering.
          // Let's assume: if word.difficulty is present, it MUST match. If missing, maybe include or exclude?
          // Safest: If word.difficulty exists, it must be in the set. If it doesn't exist, we likely include it unless we are strictly "Searching for level 1".
          // But normally difficulty-tagged files have it on all words.
          // Let's include if difficulty is missing OR matches.
          if (w.difficulty === undefined || w.difficulty === null) return true;
          // difficulty can be number or string "1" "2" "2;3".
          // If "2;3", and we selected "2", it should match?
          // User said: "difficulty が2;3のようになっている場合は... 難易度が1と2を選択していた場合... 表示するようにしてください"
          // -> So if ANY of the word's difficulties match the selection, include it.
          const wordDiffs = String(w.difficulty).split(';').map(s => s.trim());
          return wordDiffs.some(d => selectedDiffSet.has(d));
        });
      }

      // Fetch current review list to either exclude or use exclusively
      const reviewProgress = await storage.getReviewWords(userId);
      if (config.reviewOnly) {
        const reviewOnlyWords = reviewProgress
          .map((rp) => rp.word)
          .filter((w) => w && w.id && w.word && w.meaning);
        words = reviewOnlyWords;
        // Re-apply difficulty filter for review session if needed?
        if (config.selectedDifficulties && Array.isArray(config.selectedDifficulties) && config.selectedDifficulties.length > 0) {
          const selectedDiffSet = new Set(config.selectedDifficulties.map(d => String(d)));
          words = words.filter(w => {
            if (w.difficulty === undefined || w.difficulty === null) return true;
            const wordDiffs = String(w.difficulty).split(';').map(s => s.trim());
            return wordDiffs.some(d => selectedDiffSet.has(d));
          });
        }
      } else {
        const reviewIds = new Set(reviewProgress.map((rp) => rp.word?.id || rp.wordId));
        words = (words || []).filter((w) => !reviewIds.has(w.id));
      }

      if (config.order === "random") {
        words = words.sort(() => Math.random() - 0.5);
      } else if (config.order === "difficulty") {
        // Sort by difficulty (ascending)
        words = words.sort((a, b) => {
          const da = a.difficulty ? String(a.difficulty) : "999";
          const db = b.difficulty ? String(b.difficulty) : "999";
          return da.localeCompare(db, undefined, { numeric: true });
        });
      }

      // Clamp to actual available words to avoid client/server count mismatches
      const finalCount = Math.max(0, Math.min(config.questionCount, Array.isArray(words) ? words.length : 0));
      words = (Array.isArray(words) ? words : []).slice(0, finalCount);

      // Persist the actual totalWords to keep session metadata consistent
      try {
        await storage.updateStudySession(userId, session.id, { totalWords: words.length, selectedDifficulties: config.selectedDifficulties, words });
      } catch { }

      const sessionWithWords = {
        ...session,
        totalWords: words.length,
        selectedDifficulties: config.selectedDifficulties,
        words,
        progress: [],
      };

      res.json(sessionWithWords);
    } catch (error) {
      res.status(400).json({
        message: "学習セッションの作成に失敗しました。指定された単語の範囲や設定を確認してください。",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get study session
  app.get("/api/study/session/:id", optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const session = await storage.getStudySession(userId, req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Study session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch study session" });
    }
  });

  // Get active (incomplete) study session
  app.get("/api/study/session/active/current", optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const userSessions = storage.studySessions.get(userId) || new Map();
      const sessions = Array.from(userSessions.values());
      const activeSessions = sessions.filter(s => !s.isCompleted);
      if (activeSessions.length === 0) {
        return res.status(404).json({ message: "No active session" });
      }
      activeSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const activeSession = activeSessions[0];

      // get progress
      const progress = await storage.getWordProgressBySession(userId, activeSession.id);
      
      const correctCount = progress.filter(p => p.isRemembered).length;
      const incorrectCount = progress.filter(p => !p.isRemembered).length;

      res.json({
        ...activeSession,
        progress,
        correctCount,
        incorrectCount,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active session" });
    }
  });

  // Delete/Discard active study sessions
  app.delete("/api/study/session/active/current", optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const userSessions = storage.studySessions.get(userId);
      if (!userSessions) return res.json({ ok: true });
      const sessions = Array.from(userSessions.values());
      const activeSessions = sessions.filter(s => !s.isCompleted);
      for (const s of activeSessions) {
         userSessions.delete(s.id);
      }
      storage._scheduleSave();
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear active session" });
    }
  });

  // Update study session (PATCH and PUT)
  app.patch("/api/study/session/:id", optionalAuthentication, async (req, res) => {
    try {
      const updates = req.body;
      const userId = req.userId;
      const session = await storage.updateStudySession(userId, req.params.id, updates);
      if (!session) {
        return res.status(404).json({ message: "Study session not found" });
      }
      if (updates && updates.isCompleted === true) {
        saveAllDataToGist().catch(err => console.error("Gist auto-save failed in session completion:", err));
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to update study session" });
    }
  });

  app.put("/api/study/session/:id", optionalAuthentication, async (req, res) => {
    try {
      const updates = req.body;
      const userId = req.userId;
      const session = await storage.updateStudySession(userId, req.params.id, updates);
      if (!session) {
        return res.status(404).json({ message: "Study session not found" });
      }
      if (updates && updates.isCompleted === true) {
        saveAllDataToGist().catch(err => console.error("Gist auto-save failed in session completion:", err));
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to update study session" });
    }
  });

  // Record word progress
  app.post("/api/study/progress", optionalAuthentication, async (req, res) => {
    try {
      const progressData = insertWordProgressSchema.parse(req.body);
      const userId = req.userId;
      // The storage.createWordProgress function now handles the check-and-update logic
      const progress = await storage.createWordProgress(userId, progressData);
      res.json(progress);
    } catch (error) {
      res.status(400).json({
        message: "Invalid progress data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get session progress
  app.get("/api/study/progress/:sessionId", optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const progress = await storage.getWordProgressBySession(userId, req.params.sessionId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session progress" });
    }
  });

  // Get review words
  app.get("/api/vocabulary/review", optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const reviewWords = await storage.getReviewWords(userId);
      res.json(reviewWords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch review words" });
    }
  });

  // --- Score Attack APIs ---
  app.post('/api/score-attack/submit', optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const { score, summary } = req.body || {};
      if (typeof score !== 'number' || score < 0) {
        return res.status(400).json({ message: 'Invalid score' });
      }
      const record = await storage.saveScoreAttack(userId, score);
      // Optionally record run for rankings
      if (summary && typeof summary === 'object') {
        const payload = {
          score: Number(score),
          maxCombo: Number(summary.maxCombo) || 0,
          correctCount: Number(summary.correctCount) || 0,
          fileName: summary.fileName || null,
          start: Number(summary.start) || 0,
          end: Number(summary.end) || 0,
          limit: Number(summary.limit) || 0,
        };
        await storage.addScoreAttackRun(userId, payload);
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: 'Failed to save score' });
    }
  });

  app.get('/api/score-attack/me', optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const record = await storage.getScoreAttack(userId);
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: 'Failed to load score' });
    }
  });

  // Rankings API
  app.get('/api/rankings', optionalAuthentication, async (req, res) => {
    try {
      const metric = String(req.query.metric || 'ppm'); // 'ppm' | 'combo' | 'correct'
      const period = String(req.query.period || 'overall'); // 'overall' | 'weekly' | 'monthly'
      const source = req.query.source ? String(req.query.source) : undefined;
      const list = await storage.getScoreAttackRankings({ metric, period, source });
      res.json(list);
    } catch (e) {
      res.status(500).json({ message: 'Failed to load rankings' });
    }
  });

  // User profile update (display name)
  app.post('/api/profile', optionalAuthentication, async (req, res) => {
    try {
      const { displayName } = req.body || {};
      const user = await storage.updateUserProfile(req.userId, { displayName });
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({ ok: true, user: { id: user.id, username: user.username, displayName: user.displayName } });
    } catch (e) {
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // --- User datasets library ---
  app.get('/api/datasets', optionalAuthentication, async (req, res) => {
    try {
      const list = await storage.listDatasets(req.userId);
      res.json(list);
    } catch (e) {
      res.status(500).json({ message: 'Failed to list datasets' });
    }
  });

  app.post('/api/datasets', optionalAuthentication, async (req, res) => {
    try {
      const { name, words } = req.body || {};
      if (!name || !Array.isArray(words)) {
        return res.status(400).json({ message: 'Invalid dataset' });
      }
      const saved = await storage.saveDataset(req.userId, name, words);
      saveAllDataToGist().catch(err => console.error("Gist auto-save failed in saveDataset:", err));
      res.json(saved);
    } catch (e) {
      res.status(500).json({ message: 'Failed to save dataset' });
    }
  });

  app.post('/api/datasets/apply', optionalAuthentication, async (req, res) => {
    try {
      const { name } = req.body || {};
      if (!name) return res.status(400).json({ message: 'name required' });
      const result = await storage.applyDataset(req.userId, name);
      saveAllDataToGist().catch(err => console.error("Gist auto-save failed in applyDataset:", err));
      res.json(result);
    } catch (e) {
      res.status(500).json({ message: 'Failed to apply dataset' });
    }
  });

  // --- File manager APIs ---
  app.get('/api/files', optionalAuthentication, async (_req, res) => {
    try {
      const catalog = await listAvailableJsonCatalog();
      const formatUploaded = (entry) => ({
        name: entry.name,
        wordCount: entry.wordCount ?? null,
        size: entry.size ?? null,
        updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : null,
        owner: (storage.getUploadedOwner(entry.name) || null),
      });
      res.json({
        builtin: catalog.builtin.map((item) => ({
          name: item.name,
          wordCount: item.wordCount ?? null,
        })),
        uploaded: catalog.uploaded.map(formatUploaded),
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to list files' });
    }
  });

  app.get('/api/files/:name', optionalAuthentication, async (req, res) => {
    try {
      const fileName = decodeURIComponent(req.params.name);
      if (!fileName) {
        return res.status(400).json({ message: 'Invalid file name' });
      }
      if (BUILTIN_JSON_FILES.includes(fileName)) {
        return res.status(400).json({ message: 'Built-in files are read-only' });
      }
      const file = await readUploadedJsonFile(fileName);
      res.json({ name: file.name, content: file.content, wordCount: file.wordCount });
    } catch (error) {
      res.status(404).json({ message: error?.message || 'File not found' });
    }
  });

  app.post('/api/files', optionalAuthentication, async (req, res) => {
    try {
      const { name, content } = req.body || {};
      if (!name || typeof name !== 'string' || !content || typeof content !== 'string') {
        return res.status(400).json({ message: 'name and content are required' });
      }
      if (BUILTIN_JSON_FILES.includes(name.trim())) {
        return res.status(400).json({ message: 'Cannot overwrite built-in files' });
      }
      const result = await saveUploadedJsonFile(name, content, { overwrite: false });
      try { storage.setUploadedOwner(result.name, req.userId); } catch { }
      saveAllDataToGist().catch(err => console.error("Gist auto-save failed in createFile:", err));
      res.json({ ok: true, name: result.name, wordCount: result.wordCount });
    } catch (error) {
      if (error && error.code === 'FILE_EXISTS') {
        return res.status(409).json({ message: 'File already exists' });
      }
      res.status(400).json({ message: error?.message || 'Failed to save file' });
    }
  });

  app.put('/api/files/:name', optionalAuthentication, async (req, res) => {
    try {
      const fileName = decodeURIComponent(req.params.name);
      const { content } = req.body || {};
      if (!fileName || typeof content !== 'string') {
        return res.status(400).json({ message: 'content is required' });
      }
      if (BUILTIN_JSON_FILES.includes(fileName)) {
        return res.status(400).json({ message: 'Built-in files are read-only' });
      }
      // Only owner or developer can edit
      const meta = storage.getUploadedOwner(fileName);
      const isDev = req.user?.isDev === true;
      if (meta && !isDev && meta.ownerId !== req.userId) {
        return res.status(403).json({ message: 'forbidden (not owner)' });
      }
      const result = await saveUploadedJsonFile(fileName, content, { overwrite: true });
      if (!meta) { try { storage.setUploadedOwner(fileName, req.userId); } catch { } }
      saveAllDataToGist().catch(err => console.error("Gist auto-save failed in updateFile:", err));
      res.json({ ok: true, name: result.name, wordCount: result.wordCount });
    } catch (error) {
      res.status(400).json({ message: error?.message || 'Failed to update file' });
    }
  });

  app.delete('/api/files/:name', optionalAuthentication, async (req, res) => {
    try {
      const fileName = decodeURIComponent(req.params.name);
      if (!fileName) {
        return res.status(400).json({ message: 'Invalid file name' });
      }
      if (BUILTIN_JSON_FILES.includes(fileName)) {
        return res.status(400).json({ message: 'Built-in files are read-only' });
      }
      const meta = storage.getUploadedOwner(fileName);
      const isDev = req.user?.isDev === true;
      if (meta && !isDev && meta.ownerId !== req.userId) {
        return res.status(403).json({ message: 'forbidden (not owner)' });
      }
      await deleteUploadedJsonFile(fileName);
      saveAllDataToGist().catch(err => console.error("Gist auto-save failed in deleteFile:", err));
      res.json({ ok: true });
    } catch (error) {
      res.status(404).json({ message: error?.message || 'File not found' });
    }
  });

  // Admin: read builtin JSON content
  app.post('/api/admin/files/builtin/read', optionalAuthentication, async (req, res) => {
    try {
      if (!isBackupAdmin(req)) return res.status(403).json({ message: 'forbidden' });
      const { name } = req.body || {};
      if (!name || !BUILTIN_JSON_FILES.includes(name)) return res.status(400).json({ message: 'invalid file' });
      const resolved = await fileUtils.resolveJsonFilePath(name);
      const fs = await import('fs/promises');
      const content = await fs.readFile(resolved.path, 'utf8');
      res.json({ name, content });
    } catch (e) {
      res.status(500).json({ message: 'failed to read builtin', error: e?.message || String(e) });
    }
  });
  const httpServer = createServer(app);

  // --- WebSocket Real-time Battle on same server ---
  const wss = new WebSocketServer({ server: httpServer });

  function broadcast(roomId, payload) {
    const room = rooms.get(roomId);
    if (!room) return;
    const data = JSON.stringify(payload);
    for (const ws of room.players.values()) {
      try { ws.send(data); } catch { }
    }
    if (room.host) { try { room.host.send(data); } catch { } }
  }

  function toScores(room) {
    const out = {};
    for (const [n, s] of room.scores.entries()) out[n] = s;
    return out;
  }

  function scheduleRoomCleanup(roomId) {
    const r = rooms.get(roomId);
    if (!r) return;
    if (r.cleanupTimer) { try { clearTimeout(r.cleanupTimer); } catch { } }
    r.cleanupTimer = setTimeout(() => {
      const target = rooms.get(roomId);
      if (!target) return;
      if (target.state === 'ended' || (target.players && target.players.size === 0)) {
        if (target.timer) { try { clearTimeout(target.timer); } catch { } }
        rooms.delete(roomId);
      }
    }, 60_000);
  }

  function scheduleQuestionTimer(roomId) {
    const r = rooms.get(roomId);
    if (!r || r.state !== 'running') return;
    if (r.timer) clearTimeout(r.timer);
    r.timer = setTimeout(() => {
      const room = rooms.get(roomId);
      if (!room || room.state !== 'running') return;
      room.asked = (room.asked || 0) + 1;
      if (room.maxQuestions && room.asked >= room.maxQuestions) {
        const lastQ = room.words[room.idx];
        room.state = 'ended';
        if (room.timer) { clearTimeout(room.timer); room.timer = null; }
        broadcast(roomId, { type: 'end', scores: toScores(room), endReason: 'timeout', lastId: lastQ?.id ?? null, lastWord: lastQ?.word ?? null, lastMeaning: lastQ?.meaning ?? null });
        scheduleRoomCleanup(roomId);
        return;
      }
      const prevQ = room.words[room.idx];
      room.idx = (room.idx + 1) % room.words.length;
      const nq = room.words[room.idx];
      broadcast(roomId, { type: 'question', index: room.idx, id: nq?.id ?? null, word: nq?.word ?? null, meaning: nq?.meaning ?? null, prevWord: prevQ?.word ?? null, prevMeaning: prevQ?.meaning ?? null, timeLimit: room.timeLimit, progress: { current: room.asked + 1, total: room.maxQuestions || room.words.length } });
      scheduleQuestionTimer(roomId);
    }, (rooms.get(roomId)?.timeLimit || 30) * 1000);
  }

  function startRoom(roomId) {
    const room = rooms.get(roomId);
    if (!room || room.state !== 'waiting') return;
    room.state = 'running';
    room.idx = 0; room.asked = 0;
    if (room.timer) clearTimeout(room.timer);
    const q = room.words[room.idx];
    broadcast(roomId, { type: 'question', index: room.idx, id: q?.id ?? null, word: q?.word ?? null, meaning: q?.meaning ?? null, prevWord: null, prevMeaning: null, progress: { current: 1, total: room.maxQuestions || room.words.length } });
    scheduleQuestionTimer(roomId);
  }

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
      const { type } = msg || {};
      if (type === 'create') {
        const { room, name, limitSec, words, questionCount } = msg;
        if (!room || !name || !Array.isArray(words) || !words.length) { ws.send(JSON.stringify({ type: 'error', message: 'invalid_create' })); return; }
        if (rooms.has(room)) { ws.send(JSON.stringify({ type: 'error', message: 'room_exists' })); return; }
        let normalized = words.map(w => ({ id: String(w.id || ''), word: String(w.word || ''), meaning: String(w.meaning || '') })).filter(w => w.word && w.meaning);
        normalized = normalized.sort(() => Math.random() - 0.5);
        const maxQuestions = Math.max(1, Math.min(Number(questionCount) || normalized.length, normalized.length));
        const r = {
          host: ws,
          timeLimit: Math.max(5, Number(limitSec) || 30),
          words: normalized,
          maxQuestions,
          asked: 0,
          state: 'waiting',
          players: new Map(),
          scores: new Map(),
          idx: 0,
          timer: null,
          cleanupTimer: null,
          lastCorrectBy: null,
        };
        rooms.set(room, r);
        ws._room = room; ws._name = name; r.players.set(name, ws); r.scores.set(name, 0);
        broadcast(room, { type: 'lobby', players: Array.from(r.players.keys()), timeLimit: r.timeLimit, maxQuestions });
      } else if (type === 'join') {
        const { room, name } = msg; const r = rooms.get(room);
        if (!r) { ws.send(JSON.stringify({ type: 'error', message: 'room_not_found' })); return; }
        if (r.players.has(name)) { ws.send(JSON.stringify({ type: 'error', message: 'name_in_use' })); return; }
        // 状態: waiting の場合はロビー情報を、running の場合はプレイヤーリストのみを通知
        r.players.set(name, ws); r.scores.set(name, 0);
        ws._room = room; ws._name = name;
        // 全員にプレイヤーリストをブロードキャスト（ロビー情報/開始情報は不要）
        if (r.state === 'running') {
          broadcast(room, { type: 'players', players: Array.from(r.players.keys()) });
        } else {
          broadcast(room, { type: 'lobby', players: Array.from(r.players.keys()), timeLimit: r.timeLimit, maxQuestions: r.maxQuestions });
        }
        // 実行中の場合、参加者に現在のスコアと問題を送信
        if (r.state === 'running') {
          const q = r.words[r.idx];
          ws.send(JSON.stringify({ type: 'score', scores: toScores(r) }));
          ws.send(JSON.stringify({ type: 'question', index: r.idx, id: q?.id ?? null, word: q?.word ?? null, meaning: q?.meaning ?? null, prevWord: null, prevMeaning: null, progress: { current: r.asked + 1, total: r.maxQuestions || r.words.length } }));
        }
      } else if (type === 'start') {
        const { room } = msg; const r = rooms.get(room);
        if (!r) return; if (ws !== r.host) return; startRoom(room);
      } else if (type === 'answer') {
        const { room, name, text } = msg; const r = rooms.get(room);
        if (!r || r.state !== 'running') return;
        const q = r.words[r.idx]; if (!q) return;
        const ok = validateAnswer(String(text || ''), q.meaning);
        if (ok) {
          r.lastCorrectBy = name;
          const prev = r.scores.get(name) || 0; r.scores.set(name, prev + 1);
          r.asked = (r.asked || 0) + 1;
          broadcast(room, { type: 'answered', by: name });
          if (r.maxQuestions && r.asked >= r.maxQuestions) {
            r.state = 'ended'; if (r.timer) { clearTimeout(r.timer); r.timer = null; }
            broadcast(room, { type: 'end', scores: toScores(r) });
            scheduleRoomCleanup(room);
            return;
          }
          const prevQ = r.words[r.idx];
          r.idx = (r.idx + 1) % r.words.length;
          const nq = r.words[r.idx];
          broadcast(room, { type: 'score', scores: toScores(r) });
          broadcast(room, { type: 'question', index: r.idx, id: nq?.id ?? null, word: nq?.word ?? null, meaning: nq?.meaning ?? null, prevWord: prevQ?.word ?? null, prevMeaning: prevQ?.meaning ?? null, prevAnswerer: r.lastCorrectBy || null, progress: { current: r.asked + 1, total: r.maxQuestions || r.words.length } });
          r.lastCorrectBy = null;
          scheduleQuestionTimer(room);
        }
      }
    });
    ws.on('close', () => {
      const room = ws._room; const name = ws._name;
      if (!room || !rooms.has(room)) return;
      const r = rooms.get(room);
      if (r.players.has(name)) r.players.delete(name);
      if (r.players.size === 0) { if (r.timer) clearTimeout(r.timer); rooms.delete(room); }
      else {
        if (r.state === 'running') broadcast(room, { type: 'players', players: Array.from(r.players.keys()) });
        else broadcast(room, { type: 'lobby', players: Array.from(r.players.keys()) });
      }
    });
  });

  return httpServer;
}



// Exported backup/restore functions for internal use
export async function performRestoreFromGist(apply = false) {
  const token = process.env.GIST_TOKEN;
  const gistId = process.env.GIST_ID;
  const file = process.env.GIST_FILE || 'backup.json';
  if (!gistId) throw new Error('Gist env not configured');

  const r = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'GET',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      'Accept': 'application/vnd.github+json',
    }
  });
  if (!r.ok) {
    const text = await r.text();
    const e = new Error('Failed to fetch gist');
    e.status = r.status;
    e.body = text;
    throw e;
  }
  const data = await r.json();
  const content = data?.files?.[file]?.content;
  if (!content) throw new Error('File not found in gist');

  if (apply) {
    const parsed = JSON.parse(content);
    // Bulk import if { users: [...] }
    if (Array.isArray(parsed?.users)) {
      let count = 0;
      for (const entry of parsed.users) {
        const u = entry?.user || {};
        // Normalize password to hashed form
        let normalizedPassword = null;
        if (typeof u.passwordHash === 'string' && u.passwordHash.length > 0) {
          normalizedPassword = u.passwordHash;
        } else if (typeof u.password === 'string' && u.password.length > 0) {
          normalizedPassword = u.password.startsWith('$2') ? u.password : await bcrypt.hash(u.password, 12);
        }
        const up = await storage.upsertUser({
          id: u.id,
          username: u.username || u.email || null,
          isDev: !!u.isDev,
          displayName: u.displayName || null,
          isGuest: !!u.isGuest,
          ...(normalizedPassword ? { password: normalizedPassword } : {}),
        });
        const payload = entry?.data || entry;
        await storage.importUserData(up.id, payload);
        count++;
      }
      return { ok: true, applied: true, imported: count };
    }
    // Single import (requires targetId usually, but here we might fetch global backup... userMeta should have ID)
    const userMeta = parsed.user || parsed.data?.user;
    let targetId = null;

    // Internal user note: if apply=true is called from CLI/Startu, req.userId is undefined.
    // If the backup has userMeta, we use it. If not, we can't easily guess targetId unless we assume single user system.
    // But performRestoreFromGist is mostly for global backup restore.

    if (userMeta) {
      let normalizedPassword = null;
      if (typeof userMeta.passwordHash === 'string' && userMeta.passwordHash.length > 0) {
        normalizedPassword = userMeta.passwordHash;
      } else if (typeof userMeta.password === 'string' && userMeta.password.length > 0) {
        normalizedPassword = userMeta.password.startsWith('$2') ? userMeta.password : await bcrypt.hash(userMeta.password, 12);
      }
      const up = await storage.upsertUser({
        id: userMeta.id,
        username: userMeta.username || userMeta.email || null,
        isDev: !!userMeta.isDev,
        displayName: userMeta.displayName || null,
        isGuest: !!userMeta.isGuest,
        ...(normalizedPassword ? { password: normalizedPassword } : {}),
      });
      targetId = up.id;
      if (parsed.extraFiles) {
        const fs = await import('fs/promises');
        for (const [fname, content] of Object.entries(parsed.extraFiles)) {
          if (['schedule.json', 'wordlist.json', 'word list.json'].includes(fname)) {
            try { await fs.writeFile(fname, content, 'utf8'); } catch { }
          }
        }
      }
      if (parsed.uploadedFiles) {
        const uploads = Object.entries(parsed.uploadedFiles).map(([name, content]) => ({ name, content }));
        await fileUtils.applyUploadedJsonFiles(uploads);
      }

      const payload = parsed?.data || parsed;
      await storage.importUserData(targetId, payload);

      // Restore separate wordbook files if present in the gist
      // data.files contains all files in the gist
      if (data.files) {
        const separateUploads = [];
        for (const [fname, fileObj] of Object.entries(data.files)) {
          // Skip backup.json itself or any other known system files if needed
          if (fname === file || fname === 'backup.json') continue;
          if (!fname.toLowerCase().endsWith('.json')) continue;

          // If it looks like a wordbook (JSON content), try to restore it
          if (fileObj.content) {
            separateUploads.push({ name: fname, content: fileObj.content });
          }
        }
        if (separateUploads.length > 0) {
          await fileUtils.applyUploadedJsonFiles(separateUploads);
        }
      }

      return { ok: true, applied: true, userId: targetId };
    }

    // If no userMeta, we can't restore single user data without knowing who. 
    // This case might fail for single-user backups restored via startup script if ID is missing.
    // But usually backup includes user meta.
    throw new Error('Backup does not contain user metadata for identification');
  }

  return { content, applied: false };
}

// --- Helper for Battle Validation ---
function validateAnswer(userInput, meaning) {
  if (!userInput) return false;
  const input = userInput.trim();
  const m = String(meaning);

  if (m.startsWith('c:')) {
    const parts = m.split(':');
    const correct = parts[parts.length - 1];
    return match(input, correct);
  }

  if (m.startsWith('m:')) {
    const parts = m.split(':');
    // m:A:B -> A or B
    for (let i = 1; i < parts.length; i++) {
      if (match(input, parts[i])) return true;
    }
    return false;
  }

  if (m.startsWith('r:')) {
    const parts = m.split(':');
    const items = parts.slice(2);
    if (items.length > 0) {
      const last = items[items.length - 1];
      if (last.includes('/r')) {
        items[items.length - 1] = last.split('/r')[0];
      }
    }
    return items.every(item => input.includes(item));
  }
  return match(input, m);
}

function match(input, target) {
  const normTarget = target.trim();
  if (input === normTarget) return true;
  // Slash rule: "A/B" matches "AB"
  if (normTarget.includes('/')) {
    const noSlashTarget = normTarget.replace(/\//g, '');
    if (input === noSlashTarget) return true;
  }
  return false;
}
