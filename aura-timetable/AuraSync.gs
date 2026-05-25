/**
 * Aura Timetable Sync Bridge (v1.4 - 専用カレンダー対応版)
 * --------------------------------------------------
 * 「Aura Timetable」という名前の専用カレンダーを作成し、
 * そこに予定を書き込みます。これにより、Googleカレンダーアプリで
 * 授業予定の表示・非表示を簡単に切り替えられるようになります。
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
 * 空き時間（授業がなく、かつカレンダーの他の予定とも重複しない時間枠）を抽出します。
 */
function getFreeSlots(data) {
  const parseJST = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 9, 0, 0); 
  };
  
  const start = parseJST(data.startDate || data.semesterStart);
  const end = parseJST(data.endDate || data.semesterEnd);
  
  const calendar = getTargetCalendar();
  const events = calendar.getEvents(start, end);
  
  // 祝日データの取得
  let holidays = {};
  try {
    const holidayCal = CalendarApp.getCalendarById('ja.japanese#holiday@group.v.calendar.google.com');
    holidayCal.getEvents(start, end).forEach(ev => {
      holidays[Utilities.formatDate(ev.getStartTime(), "JST", "yyyy-MM-dd")] = ev.getTitle();
    });
  } catch (e) {
    console.warn("祝日の取得に失敗しました: " + e.toString());
  }
  
  const freeSlots = [];
  let currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dateStr = Utilities.formatDate(currentDate, "JST", "yyyy-MM-dd");
    const holidayName = holidays[dateStr];
    const hasOverride = data.dayOverrides && data.dayOverrides[dateStr] !== undefined;
    
    // 祝日で振替授業もない場合はスキップ
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
    
    // 週末のチェック
    const isWeekend = dayIndex > 4;
    if (isWeekend && !data.showWeekend) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    for (let p = 0; p < data.periods.length; p++) {
      // 1. 時間割に授業が入っているかチェック
      let entry = data.cellOverrides && data.cellOverrides[`${dateStr}-${p}`];
      if (!entry) {
        entry = data.timetable[`${dayIndex}-${p}`];
      }
      if (entry && entry.courseId) {
        continue; // 授業がある枠は空き時間ではない
      }
      
      // 2. Googleカレンダーに他の予定が入っているかチェック
      const periodTime = data.periods[p];
      const startPeriod = new Date(currentDate);
      const [sH, sM] = periodTime.start.split(':').map(Number);
      startPeriod.setHours(sH, sM, 0, 0);
      
      const endPeriod = new Date(currentDate);
      const [eH, eM] = periodTime.end.split(':').map(Number);
      endPeriod.setHours(eH, eM, 0, 0);
      
      const isOccupied = events.some(ev => {
        const evStart = ev.getStartTime();
        const evEnd = ev.getEndTime();
        return evStart < endPeriod && evEnd > startPeriod;
      });
      
      if (!isOccupied) {
        freeSlots.push({
          date: dateStr,
          period: p,
          start: periodTime.start,
          end: periodTime.end
        });
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return { status: "success", freeSlots: freeSlots };
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
