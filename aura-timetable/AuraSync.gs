/**
 * Aura Timetable Sync Bridge (v2.0 - AI スケジュール最適化対応版)
 * ================================================================
 *
 * 【システム構成 / 設計仕様】
 *  - データ基盤: Googleカレンダー（確定済み予定）＋ Gist（タスクDB・計画記録）
 *  - 処理エンジン: GAS（カレンダー操作）＋ Gemini API（最適スケジュール生成）
 *
 * 【主な機能】
 *  1. doPost: カレンダー同期 / 空き時間抽出 / タスク書き込みのルーティング
 *  2. getFreeSlots: 全カレンダーを横断し、1秒でも予定が重なるコマを除外した
 *                   「本当の空きコマ」を返す（AI最適化への入力データ）
 *  3. writeTasks: AIが確定したタスクをカレンダーに [Task] 形式で登録する
 *
 * 【重要: デプロイについて】
 *  コードを修正したあとは必ず「デプロイを管理」→「新しいバージョンに更新」を
 *  実行してください。保存だけでは反映されません。
 */

const APP_TAG = "[AuraSync]";
const CALENDAR_NAME = "Aura Timetable";

/**
 * 専用カレンダーを取得、なければ作成するヘルパー
 */
function getTargetCalendar() {
  const calendars = CalendarApp.getCalendarsByName(CALENDAR_NAME);
  if (calendars.length > 0) {
    return calendars[0];
  }
  console.log("新しいカレンダーを作成します: " + CALENDAR_NAME);
  const newCal = CalendarApp.createCalendar(CALENDAR_NAME);
  newCal.setSelected(true); // デフォルトで表示するように設定
  return newCal;
}

/**
 * Aura側から送られてくるカラー（HSL）を
 * Google Apps Scriptの EventColor（カレンダーの標準色）に変換します。
 */
function getColorIdFromString(colorStr) {
  if (!colorStr) return CalendarApp.EventColor.PALE_BLUE;
  const map = {
    'hsl(220, 90%, 65%)': CalendarApp.EventColor.BLUE,        // blue
    'hsl(265, 80%, 65%)': CalendarApp.EventColor.MAUVE,       // purple
    'hsl(330, 80%, 65%)': CalendarApp.EventColor.PALE_RED,    // pink
    'hsl(160, 70%, 50%)': CalendarApp.EventColor.PALE_GREEN,  // green
    'hsl(30, 90%, 60%)': CalendarApp.EventColor.ORANGE,       // orange
    'hsl(190, 80%, 55%)': CalendarApp.EventColor.CYAN,        // cyan
    'hsl(0, 75%, 60%)': CalendarApp.EventColor.RED,           // red
    'hsl(45, 90%, 60%)': CalendarApp.EventColor.YELLOW,       // yellow
    'hsl(280, 60%, 55%)': CalendarApp.EventColor.PALE_BLUE,   // violet
    'hsl(140, 60%, 45%)': CalendarApp.EventColor.GREEN        // teal
  };
  return map[colorStr] || CalendarApp.EventColor.PALE_BLUE;
}

function doPost(e) {
  try {
    const contents = e.postData.contents;
    const data = JSON.parse(contents);
    
    if (data.action === "getFreeSlots") {
      console.log("=== 空き時間抽出アクション開始 ===");
      const result = getFreeSlots(data);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (data.action === "writeTasks") {
      console.log("=== タスク書き込みアクション開始 ===");
      const result = writeTasks(data);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
    
    const response = { status: "success", message: "", details: {} };
    console.log("=== 同期処理開始 (専用カレンダー) ===");
    
    const calendar = getTargetCalendar();
    console.log("同期先: " + calendar.getName());

    const parseJST = (dateStr) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d, 9, 0, 0); 
    };

    const semStart = parseJST(data.semesterStart);
    const semEnd = parseJST(data.semesterEnd);

    // 1. 既存予定のクリア
    const existingEvents = calendar.getEvents(semStart, semEnd, { search: APP_TAG });
    console.log(`既存予定の削除を開始... (${existingEvents.length}件)`);
    existingEvents.forEach((ev, i) => {
      ev.deleteEvent();
      if (i > 0 && i % 20 === 0) Utilities.sleep(200); 
    });

    // 2. 祝日データの取得
    const holidayCal = CalendarApp.getCalendarById('ja.japanese#holiday@group.v.calendar.google.com');
    const holidays = holidayCal.getEvents(semStart, semEnd).reduce((acc, ev) => {
      acc[Utilities.formatDate(ev.getStartTime(), "JST", "yyyy-MM-dd")] = ev.getTitle();
      return acc;
    }, {});

    // 3. 生成ループ
    let currentDate = new Date(semStart);
    let createdCount = 0;

    while (currentDate <= semEnd) {
      const dateStr = Utilities.formatDate(currentDate, "JST", "yyyy-MM-dd");
      const holidayName = holidays[dateStr];
      const hasOverride = data.dayOverrides && data.dayOverrides[dateStr] !== undefined;

      if (holidayName && !hasOverride) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      let dayIndex;
      if (hasOverride) {
        dayIndex = data.dayOverrides[dateStr];
      } else {
        const jsDay = currentDate.getDay();
        dayIndex = jsDay === 0 ? 6 : jsDay - 1;
      }

      for (let p = 0; p < data.periods.length; p++) {
        let entry = data.cellOverrides && data.cellOverrides[`${dateStr}-${p}`];
        if (!entry) {
          entry = data.timetable[`${dayIndex}-${p}`];
        }
        if (!entry) continue;

        const course = data.courses.find(c => c.id === entry.courseId);
        if (!course) continue;

        const periodTime = data.periods[p];
        const start = new Date(currentDate);
        const [sH, sM] = periodTime.start.split(':').map(Number);
        start.setHours(sH, sM, 0, 0);

        const end = new Date(currentDate);
        const [eH, eM] = periodTime.end.split(':').map(Number);
        end.setHours(eH, eM, 0, 0);

        const eventObj = calendar.createEvent(course.name, start, end, {
          description: `${APP_TAG}\n教員: ${course.teacher || '未指定'}`,
          location: course.room || ""
        });
        
        // 色を反映する
        if (course.color) {
          try {
            eventObj.setColor(getColorIdFromString(course.color));
          } catch (colorErr) {}
        }
        
        createdCount++;
        Utilities.sleep(500); 
        if (createdCount % 30 === 0) Utilities.sleep(2000);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // --- Google Tasks (Todo連携) ---
    if (data.todos && data.todos.length > 0) {
      console.log("=== Todo (Google Tasks) 同期開始 ===");
      try {
        const taskLists = Tasks.Tasklists.list().items;
        let targetList = null;
        if (taskLists) {
          for (let i = 0; i < taskLists.length; i++) {
            if (taskLists[i].title === CALENDAR_NAME) {
              targetList = taskLists[i];
              break;
            }
          }
        }
        if (!targetList) {
          console.log(`新しいタスクリストを作成します: ${CALENDAR_NAME}`);
          targetList = Tasks.Tasklists.insert({ title: CALENDAR_NAME });
        }
        
        // 既存のタスクをクリア
        const existingTasks = Tasks.Tasks.list(targetList.id).items;
        if (existingTasks && existingTasks.length > 0) {
          console.log(`既存のタスクを削除中... (${existingTasks.length}件)`);
          existingTasks.forEach(t => Tasks.Tasks.remove(targetList.id, t.id));
        }

        // 新規タスクの登録
        let tasksCreated = 0;
        data.todos.forEach(todo => {
          if (!todo.completed) {
            const taskObj = {
              title: todo.text || "(無題のタスク)",
              notes: "Aura Timetableからの同期タスクです。"
            };
            if (todo.targetDate) {
              taskObj.due = todo.targetDate + "T00:00:00.000Z";
            }
            Tasks.Tasks.insert(taskObj, targetList.id);
            tasksCreated++;
            Utilities.sleep(100);
          }
        });
        console.log(`${tasksCreated}件のタスクを同期しました。`);
        response.message += ` (さらに ${tasksCreated}件のタスクを連携しました)`;
      } catch (taskErr) {
        console.error("タスク同期エラー:", taskErr.toString());
        response.message += "\n※Google Tasksへの同期は失敗しました。GASの「サービス」で「Tasks API」を追加してください。";
      }
    }

    response.message = `${createdCount}件の予定を専用カレンダーに同期しました。` + (response.message.includes('タスク') ? `\n\n${response.message}` : '');
  } catch (err) {
    response.status = "error";
    response.message = err.toString();
  }
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 専用カレンダーから同期予定をすべて削除します。
 */
function clearAllSyncEvents() {
  const calendar = getTargetCalendar();
  const now = new Date();
  const start = new Date(now.getFullYear() - 1, 0, 1);
  const end = new Date(now.getFullYear() + 1, 11, 31);
  
  console.log("専用カレンダーから同期予定を取得中...");
  const events = calendar.getEvents(start, end, { search: APP_TAG });
  let count = 0;
  
  events.forEach((ev, i) => {
    ev.deleteEvent();
    count++;
    if (count % 20 === 0) {
      console.log(`${count}件削除済み...`);
      Utilities.sleep(500);
    }
  });
  
  console.log(`削除完了: 合計 ${count} 件を削除しました。`);
}

/**
 * メインカレンダー側に入ってしまった予定を掃除したい場合、
 * この関数を手動で「実行」してください。
 */
function cleanMainCalendar() {
  const calendar = CalendarApp.getDefaultCalendar();
  const now = new Date();
  const start = new Date(now.getFullYear() - 1, 0, 1);
  const end = new Date(now.getFullYear() + 1, 11, 31);
  
  console.log("メインカレンダーから [AuraSync] タグの予定を掃除します...");
  const events = calendar.getEvents(start, end, { search: APP_TAG });
  let count = 0;
  
  events.forEach((ev) => {
    if (ev.getDescription().includes(APP_TAG)) {
      ev.deleteEvent();
      count++;
    }
  });
  console.log(`メインカレンダーの掃除完了: ${count}件を削除しました。`);
}

function authorize() {
  const calendar = getTargetCalendar();
  console.log("カレンダー（" + calendar.getName() + "）へのアクセス許可が完了しました！");
}

/**
 * 空き時間を抽出します。
 *
 * 【判定ロジック】
 *  1. 時間割アプリに授業が登録されているコマ → 除外
 *  2. ユーザーの全カレンダー（プライマリ・共有・Aura専用を含む）に
 *     1秒でも予定が重なるコマ → 除外
 *  3. 祝日（振替なし） → 除外
 *  4. 週末は showWeekend フラグで制御
 *
 * 【v2.0 修正点】
 *  - イベント取得範囲を 0:00〜23:59:59 に変更
 *    (旧: 9:00 開始 → 9時前に終わる予定を見逃すバグを修正)
 *  - 全カレンダー横断取得 + 詳細ログで問題の特定を容易に
 *
 * @param {Object} data - フロントエンドから送られてくる時間割ステート
 * @returns {{ status: string, freeSlots: Array, debug: Object }}
 */
function getFreeSlots(data) {

  // その日の 0:00:00 を返す (イベント取得範囲の開始)
  const parseDayStart = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0);
  };

  // その日の 23:59:59 を返す (イベント取得範囲の終了)
  const parseDayEnd = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59);
  };

  const startDateStr = data.startDate || data.semesterStart;
  const endDateStr   = data.endDate   || data.semesterEnd;

  // イベント取得範囲: 対象期間の 0:00 〜 最終日の 23:59:59
  // ※ 9:00 開始にすると「8:00-8:50」などの早朝イベントを取りこぼすため修正
  const fetchStart = parseDayStart(startDateStr);
  const fetchEnd   = parseDayEnd(endDateStr);

  console.log(`[getFreeSlots] v2.0 開始 | 対象期間: ${startDateStr} 〜 ${endDateStr}`);
  console.log(`[getFreeSlots] イベント取得範囲: ${fetchStart.toISOString()} 〜 ${fetchEnd.toISOString()}`);

  // ─── 全カレンダーから予定を収集 ─────────────────────────────────────────
  // 「Aura Timetable」専用カレンダーだけでなく、プライマリや共有
  // カレンダーも含め、1つでも予定が重なるコマは「空き」から除外する。
  const events  = [];
  const seenIds = new Set();
  const auraCalendar = getTargetCalendar();

  try {
    const allCalendars = CalendarApp.getAllCalendars();
    console.log(`[getFreeSlots] 取得対象カレンダー数: ${allCalendars.length}`);

    for (const cal of allCalendars) {
      if (cal.getId().includes('holiday')) continue; // 祝日は別途処理
      try {
        const calEvents = cal.getEvents(fetchStart, fetchEnd);
        for (const ev of calEvents) {
          if (!seenIds.has(ev.getId())) {
            seenIds.add(ev.getId());
            events.push(ev);
          }
        }
        if (calEvents.length > 0) {
          console.log(`  └ ${cal.getName()}: ${calEvents.length}件の予定を取得`);
        }
      } catch (calErr) {
        console.warn(`  └ [WARN] ${cal.getName()} の取得失敗: ${calErr}`);
      }
    }
  } catch (e) {
    // フォールバック: 全カレンダー取得失敗時はAura専用カレンダーのみ
    console.warn('[getFreeSlots] getAllCalendars 失敗、フォールバック: ' + e);
    auraCalendar.getEvents(fetchStart, fetchEnd).forEach(ev => {
      if (!seenIds.has(ev.getId())) {
        seenIds.add(ev.getId());
        events.push(ev);
      }
    });
  }

  console.log(`[getFreeSlots] 収集した予定の総数: ${events.length}件`);

  // ─── 祝日データの取得 ──────────────────────────────────────────────────
  const holidays = {};
  try {
    const holidayCal = CalendarApp.getCalendarById(
      'ja.japanese#holiday@group.v.calendar.google.com'
    );
    holidayCal.getEvents(fetchStart, fetchEnd).forEach(ev => {
      holidays[Utilities.formatDate(ev.getStartTime(), 'JST', 'yyyy-MM-dd')] = ev.getTitle();
    });
  } catch (e) {
    console.warn('[getFreeSlots] 祝日の取得に失敗: ' + e);
  }

  // ─── 空き時間の抽出ループ ──────────────────────────────────────────────
  const freeSlots = [];
  let blockedByCalendar  = 0;
  let blockedByTimetable = 0;

  // currentDate は 0:00 スタート（正確な日付判定のため）
  let currentDate = parseDayStart(startDateStr);
  const loopEnd   = parseDayEnd(endDateStr);

  while (currentDate <= loopEnd) {
    const dateStr     = Utilities.formatDate(currentDate, 'JST', 'yyyy-MM-dd');
    const holidayName = holidays[dateStr];
    const hasOverride = data.dayOverrides && data.dayOverrides[dateStr] !== undefined;

    // 祝日（振替授業の設定がない場合）はスキップ
    if (holidayName && !hasOverride) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // 曜日インデックスの決定 (0=月 〜 6=日)
    let dayIndex;
    if (hasOverride) {
      dayIndex = data.dayOverrides[dateStr];
    } else {
      const jsDay = currentDate.getDay(); // 0=Sun ... 6=Sat
      dayIndex = jsDay === 0 ? 6 : jsDay - 1;
    }

    // 週末スキップ
    if (dayIndex > 4 && !data.showWeekend) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    for (let p = 0; p < data.periods.length; p++) {

      // ── チェック①: 時間割に授業がある ──────────────────────────────────
      const overrideKey  = `${dateStr}-${p}`;
      const timetableKey = `${dayIndex}-${p}`;
      const entry = (data.cellOverrides && data.cellOverrides[overrideKey])
                 || data.timetable[timetableKey];

      if (entry && entry.courseId) {
        blockedByTimetable++;
        continue;
      }

      // ── チェック②: カレンダーに1秒でも予定が重なる ─────────────────────
      const periodTime = data.periods[p];
      const [sH, sM]   = periodTime.start.split(':').map(Number);
      const [eH, eM]   = periodTime.end.split(':').map(Number);

      const slotStart = new Date(currentDate);
      slotStart.setHours(sH, sM, 0, 0);

      const slotEnd = new Date(currentDate);
      slotEnd.setHours(eH, eM, 0, 0);

      // 重複判定: evStart < slotEnd && evEnd > slotStart
      // → イベントが少しでもコマの時間帯に重なれば「ブロック」
      const isOccupied = events.some(ev => {
        const evStart = ev.getStartTime();
        const evEnd   = ev.getEndTime();
        return evStart < slotEnd && evEnd > slotStart;
      });

      if (isOccupied) {
        blockedByCalendar++;
        continue;
      }

      // ── 空きコマとして登録 ─────────────────────────────────────────────
      freeSlots.push({
        date:   dateStr,
        period: p,
        start:  periodTime.start,
        end:    periodTime.end
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(
    `[getFreeSlots] 完了 → 空きコマ: ${freeSlots.length}件 ` +
    `(授業でブロック: ${blockedByTimetable}件 / カレンダーでブロック: ${blockedByCalendar}件)`
  );

  return {
    status: 'success',
    freeSlots,
    debug: { blockedByCalendar, blockedByTimetable, totalEvents: events.length }
  };
}

/**
 * 提案されて確定されたタスクをGoogleカレンダーに登録します。
 */
function writeTasks(data) {
  const calendar = getTargetCalendar();
  const created = [];
  
  (data.tasks || []).forEach(task => {
    const [y, m, d] = task.date.split('-').map(Number);
    const periodTime = data.periods[task.period];
    if (!periodTime) return;
    
    const start = new Date(y, m - 1, d);
    const [sH, sM] = periodTime.start.split(':').map(Number);
    start.setHours(sH, sM, 0, 0);
    
    const end = new Date(y, m - 1, d);
    const [eH, eM] = periodTime.end.split(':').map(Number);
    end.setHours(eH, eM, 0, 0);
    
    const eventObj = calendar.createEvent(`[Task] ${task.text}`, start, end, {
      description: `${APP_TAG}\n[Task]\nTodo ID: ${task.todoId || ''}`
    });
    
    try {
      eventObj.setColor(CalendarApp.EventColor.ORANGE);
    } catch(err) {}
    
    created.push({
      todoId: task.todoId,
      text: task.text,
      date: task.date,
      period: task.period,
      eventId: eventObj.getId()
    });
    
    Utilities.sleep(100);
  });
  
  return { status: "success", created: created };
}
