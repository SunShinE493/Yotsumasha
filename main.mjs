import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import express from "express";
import { Client, Collection, Events, GatewayIntentBits, ActivityType, EmbedBuilder, Partials } from "discord.js";
import { createServer } from "http";
import { WebSocketServer } from 'ws';
import CommandsRegister from "./regist-commands.mjs";
import Notification from "./models/notification.mjs";
import YoutubeFeeds from "./models/youtubeFeeds.mjs";
import YoutubeNotifications from "./models/youtubeNotifications.mjs";
import moment from 'moment-timezone';
import { sendReminders } from "./commands/samples/Schedule.mjs";
import cron from 'node-cron';
import Sequelize from "sequelize";
import Parser from 'rss-parser';
const parser = new Parser();

import { Client as Youtubei, MusicClient } from "youtubei";
import axios from 'axios';

// Import routes. 
import { registerRoutes, performRestoreFromGist } from './server/routes.mjs';

//aaa

const youtubei = new Youtubei();


let postCount = 0;
const app = express();
const port = 5000;

// Serve static files from dist directory (built React app) - BEFORE any routes
app.use((req, res, next) => {
  console.log(`[DEBUG] Request: ${req.method} ${req.path}`);
  next();
});

// Serve static files from dist directory (built React app) - BEFORE any routes
const distDir = path.join(process.cwd(), 'dist');
console.log(`[DEBUG] Serving dist from: ${distDir}`);

app.use(
  express.static(distDir, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

// SPA fallback: only for non-API, non-asset, non-file-extension paths
// This prevents returning index.html for /assets/*.css|js and similar
app.get(/^\/(?!api)(?!assets)(?!.*\.[^\/]+$).*/, (req, res) => {
  console.log(`[DEBUG] SPA Fallback matched for: ${req.path}`);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) {
      console.error(`[DEBUG] Failed to send index.html:`, err);
      res.status(500).send("Error loading application.");
    }
  });
});
app.post('/api', function (req, res) {
  console.log(`Received POST request.`);

  /**
const url = `${req.protocol}://{$req.get('host')} ${req.originalUrl}`;
res.send(`このぺーじのURLは${url}です。`);
console.log(`このぺーじのURLは${url}です。`);
**/
  postCount++;
  if (postCount === 2) {
    //trigger();
    //SchTrigger();
    postCount = 0;
  }
  res.send('POST response by glitch');
})
app.get('/', function (req, res) {
  res.send('<a href="https://note.com/exteoi/n/n0ea64e258797</a> に解説があります。');
});

// Lightweight keep-alive endpoint (pre-auth/CSRF). Define BEFORE auth middleware registration.
app.post('/', function (req, res) {
  // No CSRF required for this keep-alive ping
  res.status(204).end();
});

// Static and SPA fallback moved above to take precedence over legacy routes

async function runWebserver() {
  // Set up Express middleware for JSON parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Register routes with auth system
  try {
    // Load persisted in-memory data before wiring routes
    try { await storage.loadFromDisk?.(); } catch { }
    await registerRoutes(app);
    console.log("Routes registered successfully");
  } catch (error) {
    console.error("Failed to register routes:", error);
  }

  const server = createServer(app);
  // --- WebSocket Real-time Battle ---
  const rooms = new Map(); // roomId -> { host, timeLimit, maxQuestions, asked, words, state, players: Map(name->ws), scores: Map(name->number>, idx, timer }
  const wss = new WebSocketServer({ server });

  // Public API: list open rooms (waiting and running)
  app.get('/api/battle/rooms', (_req, res) => {
    try {
      const list = Array.from(rooms.entries())
        .filter(([, r]) => !!r)
        .map(([id, r]) => ({
          id,
          state: r.state,
          playerCount: r.players?.size || 0,
          timeLimit: r.timeLimit,
          maxQuestions: r.maxQuestions || r.words?.length || 0,
          players: Array.from(r.players.keys()),
        }))
        // Prefer waiting rooms first, then running
        .sort((a, b) => (a.state === 'waiting' ? -1 : 1) - (b.state === 'waiting' ? -1 : 1));
      res.set('Cache-Control', 'no-store');
      res.json(list);
    } catch (e) {
      res.status(500).json({ message: 'failed to list rooms' });
    }
  });

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

  function scheduleQuestionTimer(roomId) {
    const r = rooms.get(roomId);
    if (!r || r.state !== 'running') return;
    if (r.timer) clearTimeout(r.timer);
    r.timer = setTimeout(() => {
      // time's up for this question -> advance to next (no score change)
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

      // Reset round state
      room.roundState = 'active';
      room.roundRank = 1;
      room.answeredPlayers.clear();

      broadcast(roomId, {
        type: 'question',
        index: room.idx,
        id: nq?.id ?? null,
        word: nq?.word ?? null,
        meaning: nq?.meaning ?? null,
        choices: nq?.choices ?? null,
        prevWord: prevQ?.word ?? null,
        prevMeaning: prevQ?.meaning ?? null,
        timeLimit: room.timeLimit,
        progress: { current: room.asked + 1, total: room.maxQuestions || room.words.length }
      });
      scheduleQuestionTimer(roomId);
    }, r.timeLimit * 1000);
  }

  // Schedule deletion of a room 60s after it ends
  function scheduleRoomCleanup(roomId) {
    const r = rooms.get(roomId);
    if (!r) return;
    if (r.cleanupTimer) { try { clearTimeout(r.cleanupTimer); } catch { } }
    r.cleanupTimer = setTimeout(() => {
      const target = rooms.get(roomId);
      if (!target) return;
      // Only remove if still ended or empty
      if (target.state === 'ended' || (target.players && target.players.size === 0)) {
        if (target.timer) { try { clearTimeout(target.timer); } catch { } }
        rooms.delete(roomId);
      }
    }, 60_000);
  }

  function startRoom(roomId) {
    const room = rooms.get(roomId);
    if (!room || room.state !== 'waiting') return;
    room.state = 'running';
    room.idx = 0;
    room.asked = 0;
    if (room.timer) clearTimeout(room.timer);
    // first question
    // first question
    const q = room.words[room.idx];
    room.roundState = 'active';
    room.roundRank = 1;
    room.answeredPlayers.clear();

    // Broadcast choices if present
    broadcast(roomId, {
      type: 'question',
      index: room.idx,
      id: q?.id ?? null,
      word: q?.word ?? null,
      meaning: q?.meaning ?? null,
      choices: q?.choices ?? null, // Send choices
      prevWord: null,
      prevMeaning: null,
      progress: { current: 1, total: room.maxQuestions || room.words.length }
    });
    scheduleQuestionTimer(roomId);
  }

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      const { type } = msg || {};
      if (type === 'create') {
        const { room, name, limitSec, words, questionCount } = msg;
        if (!room || !name || !Array.isArray(words) || !words.length) {
          ws.send(JSON.stringify({ type: 'error', message: 'invalid_create' }));
          return;
        }
        if (rooms.has(room)) {
          ws.send(JSON.stringify({ type: 'error', message: 'room_exists' }));
          return;
        }
        // Helper to normalize but preserve quiz data
        const normalizeWord = (w) => ({
          id: String(w.id || ''),
          word: String(w.word || ''),
          meaning: String(w.meaning || ''),
          // Preserve quiz fields if present
          choices: Array.isArray(w.choices) ? w.choices : undefined,
          correctAnswer: w.correctAnswer ? String(w.correctAnswer) : undefined,
          originalId: w.originalId ? String(w.originalId) : undefined
        });

        let normalized = words.map(normalizeWord).filter(w => w.word && w.meaning);
        // Only shuffle if NOT in quiz mode? Or just shuffle anyway?
        // Quiz mode chunks might be related.
        // However, user didn't strictly say "keep order". But if I generated 4 questions for 1 word, 
        // they share the same ID prefix maybe?
        // Let's shuffle. Quiz mode is usually random.
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
          quizMode: Boolean(msg.quizMode),
          // Quiz state tracking
          roundState: 'active', // 'active' | 'ending'
          roundRank: 1,
          answeredPlayers: new Set()
        };
        rooms.set(room, r);
        ws._room = room; ws._name = name; r.players.set(name, ws); r.scores.set(name, 0);
        broadcast(room, { type: 'lobby', players: Array.from(r.players.keys()), timeLimit: r.timeLimit, maxQuestions });
      } else if (type === 'join') {
        const { room, name } = msg;
        const r = rooms.get(room);
        if (!r) { ws.send(JSON.stringify({ type: 'error', message: 'room_not_found' })); return; }
        if (r.players.has(name)) { ws.send(JSON.stringify({ type: 'error', message: 'name_in_use' })); return; }
        // Allow mid-join when running as well
        r.players.set(name, ws); r.scores.set(name, 0);
        ws._room = room; ws._name = name;
        // If running, avoid sending a full 'lobby' that might reset timers/ui; send minimal players update instead
        if (r.state === 'running') {
          broadcast(room, { type: 'players', players: Array.from(r.players.keys()) });
          const q = r.words[r.idx];
          ws.send(JSON.stringify({ type: 'score', scores: toScores(r) }));
          ws.send(JSON.stringify({ type: 'question', index: r.idx, id: q?.id ?? null, word: q?.word ?? null, meaning: q?.meaning ?? null, choices: q?.choices ?? null, prevWord: null, prevMeaning: null, progress: { current: r.asked + 1, total: r.maxQuestions || r.words.length } }));
        } else {
          // waiting state: send full lobby to all
          broadcast(room, { type: 'lobby', players: Array.from(r.players.keys()), timeLimit: r.timeLimit, maxQuestions: r.maxQuestions });
        }
      } else if (type === 'start') {
        const { room } = msg; const r = rooms.get(room);
        if (!r) return; if (ws !== r.host) return; startRoom(room);
      } else if (type === 'answer') {
        const { room, name, text } = msg; const r = rooms.get(room);
        if (!r || r.state !== 'running') return;
        const q = r.words[r.idx]; if (!q) return;

        // Validation Logic
        let ok = false;
        if (q.choices && q.correctAnswer) {
          // Strict match against correctAnswer
          ok = String(text || '').trim() === String(q.correctAnswer).trim();
        } else {
          // Legacy/Fall-back matching
          ok = String(text || '').trim().toLowerCase() === q.meaning.trim().toLowerCase();
        }
        // Notify all about the answer attempt with content (correct or not)

        // Notify attempt
        broadcast(room, { type: 'answered', by: name, text: String(text || ''), correct: !!ok });

        if (ok) {
          // Prevent double points if same user answers again (client should block, but server safeguards)
          if (r.answeredPlayers && r.answeredPlayers.has(name)) return;
          if (r.answeredPlayers) r.answeredPlayers.add(name);

          r.lastCorrectBy = name;
          const currentScore = r.scores.get(name) || 0;

          // Scoring logic
          let points = 1;
          if (r.roundRank === 1) points = 5;
          else if (r.roundRank === 2) points = 3;
          else if (r.roundRank === 3) points = 2;
          else points = 1; // 4th onwards

          r.scores.set(name, currentScore + points);
          r.roundRank = (r.roundRank || 1) + 1;

          broadcast(room, { type: 'score', scores: toScores(r) });

          // If this is the FIRST correct answer, trigger "Ending" phase
          if (r.roundState !== 'ending') {
            r.roundState = 'ending';
            // Shorten timer to 3 seconds
            if (r.timer) clearTimeout(r.timer);
            r.timer = setTimeout(() => {
              // Advance question logic (duplicated from scheduleQuestionTimer expiry, extracted for cleanliness?)
              // Inline for now to minimize refactor risk
              const room = rooms.get(roomId); // refresh ref
              if (!room || room.state !== 'running') return;

              room.asked = (room.asked || 0) + 1;
              if (room.maxQuestions && room.asked >= room.maxQuestions) {
                const lastQ = room.words[room.idx];
                room.state = 'ended';
                if (room.timer) { clearTimeout(room.timer); room.timer = null; }
                broadcast(roomId, { type: 'end', scores: toScores(room), endReason: 'finished', lastId: lastQ?.id ?? null, lastWord: lastQ?.word ?? null, lastMeaning: lastQ?.meaning ?? null });
                scheduleRoomCleanup(roomId);
                return;
              }

              const prevQ = room.words[room.idx];
              room.idx = (room.idx + 1) % room.words.length;
              const nq = room.words[room.idx];

              // Reset round
              room.roundState = 'active';
              room.roundRank = 1;
              room.answeredPlayers.clear();

              broadcast(roomId, {
                type: 'question',
                index: room.idx,
                id: nq?.id ?? null,
                word: nq?.word ?? null,
                meaning: nq?.meaning ?? null,
                choices: nq?.choices ?? null,
                prevWord: prevQ?.word ?? null,
                prevMeaning: prevQ?.meaning ?? null,
                prevAnswerer: room.lastCorrectBy || null,
                timeLimit: room.timeLimit,
                progress: { current: room.asked + 1, total: room.maxQuestions || room.words.length }
              });
              room.lastCorrectBy = null;
              scheduleQuestionTimer(roomId);
            }, 3000); // 3 seconds delay
          }
        } else {
          // Wrong answer: -2 points
          // Prevent multiple penalties? Maybe not, spamming wrong answers should result in heavy penalty.
          const currentScore = r.scores.get(name) || 0;
          r.scores.set(name, currentScore - 2);
          broadcast(room, { type: 'score', scores: toScores(r) });
        }
      }
    });
    ws.on('close', () => {
      const room = ws._room; const name = ws._name;
      if (!room || !rooms.has(room)) return;
      const r = rooms.get(room);
      if (r.players.has(name)) r.players.delete(name);
      if (r.players.size === 0) {
        if (r.timer) { try { clearTimeout(r.timer); } catch { } }
        // Keep ended rooms listed for 60s; if running and last disconnect, end room gracefully
        if (r.state === 'running') {
          r.state = 'ended';
          broadcast(room, { type: 'end', scores: toScores(r) });
        }
        // leave in map for a short time to be listed as ended with 0 players
        setTimeout(() => { if (rooms.get(room) === r && r.players.size === 0) rooms.delete(room); }, 60_000);
      } else {
        // Only broadcast participant list change; do NOT send 'lobby' during running
        if (r.state === 'running') {
          broadcast(room, { type: 'players', players: Array.from(r.players.keys()) });
        } else {
          broadcast(room, { type: 'lobby', players: Array.from(r.players.keys()) });
        }
      }
    });
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`server is running on port ${port}`);
  });
}

cron.schedule('0 30 * * * *', () => {

  const now = moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss');

  console.log(`[${now}] ⏰ 毎時リマインダー: SchTrigger を実行します`);

  SchTrigger();

});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User]

});

client.commands = new Collection();

const categoryFoldersPath = path.join(process.cwd(), "commands");
const commandFolders = fs.readdirSync(categoryFoldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(categoryFoldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".mjs"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    import(pathToFileURL(filePath).href).then((module) => {
      client.commands.set(module.data.name, module);
    });
  }
}

const handlers = new Map();

const handlersPath = path.join(process.cwd(), "handlers");
const handlerFiles = fs.readdirSync(handlersPath).filter((file) => file.endsWith(".mjs"));

for (const file of handlerFiles) {
  const filePath = path.join(handlersPath, file);
  import(pathToFileURL(filePath).href).then((module) => {
    handlers.set(file.slice(0, -4), module);
  });
}

client.on("interactionCreate", async (interaction) => {
  await handlers.get("interactionCreate").default(interaction);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  await handlers.get("voiceStateUpdate").default(oldState, newState);
});

client.on("messageCreate", async (message) => {
  if (message.author.id == client.user.id || message.author.bot) return;
  await handlers.get("messageCreate").default(message);
});

client.on("clientReady", async () => {
  await client.user.setActivity('🥔', { type: ActivityType.Custom, state: "🥔を栽培中" });
  console.log(`${client.user.tag} がログインしました！`);
  const channel = await client.channels.fetch('1390928894118596650')//'1390928894118596650'); // てるまない雑談1162776615445594122   ,1201294753040453642
  channel.send('replit')
  try {
    await performRestoreFromGist(true);
    console.log('Successfully restored from Gist backup');
  } catch (e) {
    console.error('Failed to auto-restore from Gist:', e.message);
  }
});


Notification.sync({ alter: true });
YoutubeFeeds.sync({ alter: true });
YoutubeNotifications.sync({ alter: true });

CommandsRegister();
if (process.env.TOKEN) {
  client.login(process.env.TOKEN).catch(e => console.error("Discord login failed:", e));
} else {
  console.log("No Discord TOKEN provided, skipping login.");
}
runWebserver();

async function trigger() {
  const youtubeNofications = await YoutubeNotifications.findAll({
    attributes: [
      [Sequelize.fn('DISTINCT', Sequelize.col('channelFeedUrl')), 'channelFeedUrl'],
    ]
  });
  await Promise.all(
    youtubeNofications.map(async n => {
      checkFeed(n.channelFeedUrl);
    })
  );
}

async function checkFeed(channelFeedUrl) {

  const youtubeFeed = await YoutubeFeeds.findOne({
    where: {
      channelFeedUrl: channelFeedUrl,
    },
  });

  const checkedDate = new Date(youtubeFeed.channelLatestUpdateDate);
  let latestDate = new Date(youtubeFeed.channelLatestUpdateDate);

  const feed = await parser.parseURL(channelFeedUrl);
  const videos = feed.items.map(i => {
    const now = new Date(i.isoDate);

    if (now > checkedDate) {
      if (now > latestDate) {
        latestDate = now
      }
      return i;
    }
  });

  const notifications = await YoutubeNotifications.findAll({
    where: {
      channelFeedUrl: channelFeedUrl,
    },
  });
  const youtubeChannelId = channelFeedUrl.split('=').at(1);
  //const youtubeChannel = await youtubei.getChannel(youtubeChannelId);

  videos.forEach(async v => {
    if (!v) return;
    const youtubeVideolId = v.link.split('=').at(1);
    const youtubeVideo = await youtubei.getVideo(youtubeVideolId);

    const embed = new EmbedBuilder()
      .setColor(0xcd201f)
      .setAuthor({ name: v.author, url: `https://www.youtube.com/channel/${youtubeChannelId}` })
      .setTitle(v.title)
      .setURL(v.link)
      .setDescription(youtubeVideo.description)
      .setImage(youtubeVideo.thumbnails.best)
      .setTimestamp(new Date(v.isoDate));

    //.setThumbnail(youtubeChannel.thumbnails.best)

    notifications.forEach(n => {
      const channel = client.channels.cache.get(n.textChannelId);
      channel.send({ embeds: [embed] });
    });
  });

  YoutubeFeeds.update(
    { channelLatestUpdateDate: latestDate.toISOString() },
    {
      where: {
        channelFeedUrl: channelFeedUrl,
      },
    },
  );
}
import { dailyTrigger } from './commands/samples/daymath.mjs'
import { askQuiz } from './commands/samples/wordQuiz.mjs'
import { sendJsonAsText } from './commands/samples/wordQuiz.mjs'
let wcount = 1;
async function SchTrigger() {

  const now = moment().tz("Asia/Tokyo");

  const hour = now.hour();
  console.log('課題確認トリガー' + now + hour)

  let channelId = '1188202806851682314';
  let filePath = 'commands/samples/wordlist.json';
  sendJsonAsText(client, channelId, filePath)
  if (hour === 6 || hour === 23) {

    // channel を取得（例：特定のチャンネルIDを指定）
    console.log('課題確認トリガー' + now + hour)
    const channel = await client.channels.fetch('1162776615445594122'); // てるまない雑談


    const period = hour === 6 ? 'AM' : 'PM';

    sendReminders(channel, period);

  } else if (hour === 4) {
    const channel2 = await client.channels.fetch('838468033789558848'); //一般'838468033789558848
    dailyTrigger(channel2)
    console.log('積分');
  } else if (hour > 4 && hour < 23) {
    const channelId = '838468033789558848';
    const today = new Date(); // 日付を番号に変換する例 (例: 8月19日なら19
    const dayNumber = today.getDate();
    wcount++;
    askQuiz(client, channelId, wcount)
  }

  // Trigger gist backup after schedule work
  try { await backupToGist(); } catch { }
}

// Best-effort backup to gist on each trigger
async function backupToGist() {
  try {
    await axios.post('http://localhost:5000/api/admin/backup/gist', {}, { timeout: 3000 });
  } catch { }
}


//追加
client.on('messageCreate', async (message) => {

  // ボット自身のメッセージは無視

  if (message.author.bot) return;

  // リプライされたメッセージか確認
  if (message.mentions.has('1187343608026771496')) {

    if (message.reference && message.reference.messageId) {

      const repliedChannel = message.channel;
      const repliedMessageId = message.reference.messageId;

      // 返信元のメッセージを取得

      const repliedMessage = await repliedChannel.messages.fetch(repliedMessageId);

      const attachment = repliedMessage.attachments.first();
      if (!attachment || !attachment.contentType.startsWith('image')) {
        //画像なし

        try {
          // リプライ元のチャンネルを取

          let content = message.content + '以降は、以前のメッセージを添付しています。→→' + repliedMessage.content;
          const keyword = '<@1187343608026771496>'
          content = content.replace(new RegExp(keyword, "g"), "");
          console.log(content);
          runai(content, message, 1);
        } catch (error) {
          console.error('リプライコンテントがない', error)
        }
        return;
      }

      try {
        //urlからデータ
        const response = await axios.get(attachment.url, {
          responseType: 'arraybuffer',
        });
        const imageData = response.data;
        const mimeType = attachment.contentType;

        // 画像データをBase64にエンコード
        const base64Image = Buffer.from(imageData).toString('base64');


        // Gemini APIに送信するコンテンツを準備
        let promptText = message.content.replace(`<@${client.user.id}>`, '').trim();

        console.log(promptText)
        const parts = [
          { text: promptText },
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
        ];

        // まずは「考え中...」のメッセージを送信

        runai(parts, message, 1);
      } catch (error) {
        console.error('画像リプライコンテントがない', error)
      }
    } else {
      runai(0, message, 0)
    }
  }
  if (message.reference) {

    try {

      // リプライ対象のメッセージを取得

      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);

      // ボットが送信したメッセージにリプライされた場合のみ反応

      if (repliedMessage.author.id === client.user.id) {

        // リプライにリアクションを追加

        await message.react('😅');

        console.log(`リアクションを追加しました: ${message.content}`);


      }

    } catch (error) {

      console.error('リプライ処理中にエラーが発生しました:', error);

    }

  }

});
client.on('messageReactionAdd', async (reaction, user) => {

  if (reaction.partial) {

    try {

      await reaction.fetch();
      console.log('リアクションあり')
    } catch (error) {

      console.error('リアクションの取得に失敗しました:', error);

      return;

    }

  }

  const message = reaction.message;

  // Botが送信したメッセージかどうか

  if (message.content.includes('あたま')) {

    //message.author?.bot && 

    const channel = message.channel;

    channel.send(`${user.toString()}あたま`);

  }
  if (reaction.emoji.name === '💩') {
    if (user.id === '1163105759492571156') {
      // reaction から message を辿って channel を指定する
      reaction.message.channel.send("<@1163105759492571156>うんこ置くな");
    }
  }


});







client.on('messageCreate', async message => {
  // ボットのメッセージは無視
  if (message.author.bot) {
    if (/ターボ/.test(message.content)) {
      await message.channel.send('<:GCGGarrettTurbo:1352270869170225233>')
    } else if (/サーブ/.test(message.content)) {
      await message.channel.send('<a:serve:1352267714974060644><a:serve:1352267714974060644><a:serve:1352267714974060644><a:serve:1352267714974060644>')
    } else if (/<@838466692299882518>あたま/.test(message.content)) {
      await message.channel.send('<@1163105759492571156>あたま');
    }

    else return;
  }
  // メッセージに「漏らして」または「💩」が含まれる場合
  if (/漏らして|💩/.test(message.content)) {
    await message.channel.send('ぶりっ💩'); // メッセージ送信
    await message.react('💩'); // 💩リアクションを追加
  }
  if (/？？？|ふちる|？る/.test(message.content)) {
    await message.channel.send('そんなコマンドないで');
  }
  if (/？る？/.test(message.content)) {
    await message.channel.send('る？は田美子やで');
  }
  if (/shiny|いろち|色|shundo/.test(message.content)) {
    await message.react('✨');
  }
  if (/gg|GG|Gg/.test(message.content)) {
    await message.react('<a:GoodGay:1339928519731445852>');
  }
  if (/ふ？/.test(message.content)) {
    await message.react('😥');
  }
  if (/なにこ|ごろり|発射|本当かな/.test(message.content)) {
    await message.react('<a:Gorouri:1339929066249392221>');
  }
  if (/消|けし|けす|キレ芸/.test(message.content)) {
    await message.react('<:Kire_gay:1345682703818690650>');
  }
  if (/うわ|うん|きつ|けんけん/.test(message.content)) {
    await message.react('<:Kitsu:1346466382283280485>');
  }
  if (/うわ|うんた|けん/.test(message.content)) {
    await message.react('<:uwa:1337797911156887635>');
  }
  if (/ちょんす/.test(message.content)) {
    await message.react('🇨');
    await message.react('🇭');
    await message.react('🇴');
    await message.react('🇳');
    await message.react('🇸');
  }
  if (/<@838466692299882518>あたま|<@838466692299882518> あたま|<@1236945333511258165>あたま/.test(message.content)) {
    await message.channel.send('<@1163105759492571156>あたま');
  }


});

import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
let aisikibetsu, max;



/**

const API_KEY = process.env.GOOGLE_API_KEY;
if (API_KEY === undefined) {
  console.log("APIki-なし")
}
let ai;
if (API_KEY) {
  ai = new GoogleGenAI(API_KEY, {});
} else {
  console.log("API Key missing, AI features disabled.");
}
async function runai(content, message, aisikibetsu) {
  const talk = message.content;
  if (aisikibetsu === 0) {
    if (!ai) {
      await message.channel.send("APIキーが設定されていないため、AI機能は利用できません。");
      return;
    }
    max = 1000;

    const chat = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: talk + "（##回答の内容は短く簡潔に。）",
      config: {
        maxOutputTokens: 1800,
      },
    })
    console.log(chat.text);
    if (chat.text !== undefined) {
      await message.channel.send(chat.text);
    } else {
      await message.channel.send("字数エラー");
      console.log("字数エラー");
    }
  } else if (aisikibetsu === 1) {
    if (!ai) {
      await message.channel.send("APIキーが設定されていないため、AI機能は利用できません。");
      return;
    }
    message.channel.send('考え中です。これには数分かかる場合もあります。');

    try {

      let result = await ai.models.generateContentStream({
        model: "gemini-2.0-flash-thinking-exp",
        contents: content,
        config: { // 前回確認した通り、configで問題ないならこれでOK
          temperature: 0.7, // 応答のランダム性を調整 (0.0 - 1.0)
          topP: 0.9, // サンプリング時の確率閾値を調整
          topK: 40, // サンプリング時の上位K個のトークンに限定
        },
      });

      let fullResponse = '';
      let lastSentMessage = null; // 最後に送信したDiscordメッセージオブジェクト
      const MAX_DISCORD_MESSAGE_LENGTH = 2000; // Discordのメッセージ最大文字数

      // ストリーム応答を逐次処理
      for await (const chunk of result) {
        const chunkText = chunk.text;
        fullResponse += chunkText;

        // 2000文字を超えたら、その部分を送信し、fullResponseをクリア
        // ただし、最後のチャンクでない限り、既存メッセージの編集は行わない
        if (fullResponse.length >= MAX_DISCORD_MESSAGE_LENGTH) {
          const partToSend = fullResponse.substring(0, MAX_DISCORD_MESSAGE_LENGTH);

          // 2000文字に達したら常に新しいメッセージとして送信
          // lastSentMessage = null の場合でも新規送信になる
          lastSentMessage = await message.channel.send(partToSend);

          fullResponse = fullResponse.substring(MAX_DISCORD_MESSAGE_LENGTH); // 送信した部分をfullResponseから削除
        }
      }

      // ストリームが完全に終了した後、fullResponseに残っているテキストを処理
      if (fullResponse.length > 0) {
        // 残りがある場合、まだ送信されたメッセージがなければ新規で、
        // 既にメッセージが送信されていれば、それが最後の部分なのでそのメッセージを編集
        if (lastSentMessage) {
          // 最後のメッセージが存在する場合、そのメッセージに追記する形で編集
          // ただし、Discord APIの文字数制限があるので、実際には新しいメッセージとして送る方が安全
          // ここは新規メッセージとして送るロジックに統一します
          await message.channel.send(fullResponse);
        } else {
          // まだメッセージが一つも送信されていない（応答が2000文字未満だった）場合
          await message.channel.send(fullResponse);
        }
      }
    } catch (error) {
      console.error('Gemini APIからの応答中にエラーが発生しました:', error);
      message.reply('Gemini APIからの応答中にエラーが発生しました。');
    }
  } else if (aisikibetsu === 2) {



    // Gemini APIにストリーミングリクエストを送信
    const result = await model.generateContentStream({ contents: [{ role: 'user', parts }] });

    let fullText = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;

      // 最初のメッセージを編集して、回答を追記
      await message.edit(fullText);
    }


  }
}

*/


import OpenAI from "openai";
// キーの取得（名前は適宜合わせてください。DeepSeekのキーが入っている前提です）
const D_API_KEY = process.env.Deepseek_API;

if (D_API_KEY === undefined) {
  console.log("APIキーなし");
}

let ai;
if (D_API_KEY) {
  // DeepSeek用に初期化 (BaseURLを設定)
  ai = new OpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: D_API_KEY
  });
} else {
  console.log("API Key missing, AI features disabled.");
}

async function runai(content, message, aisikibetsu) {
  const talk = message.content;

  // --- パターン0: 通常の会話 (gemini-2.0-flash-exp 相当 -> deepseek-chat) ---
  if (aisikibetsu === 0) {
    if (!ai) {
      await message.channel.send("APIキーが設定されていないため、AI機能は利用できません。");
      return;
    }

    try {
      const completion = await ai.chat.completions.create({
        model: "llama-3.3-70b-versatile", // 高速な通常モデル
        messages: [
          { role: "user", content: talk + "（##回答の内容は短く簡潔に。）" }
        ],
        max_tokens: 1800, // maxOutputTokens の代わり
        stream: false,
      });

      const responseText = completion.choices[0].message.content;

      console.log(responseText);
      if (responseText) {
        await message.channel.send(responseText);
      } else {
        await message.channel.send("エラー：回答が得られませんでした。");
      }
    } catch (e) {
      console.error(e);
      await message.channel.send("エラーが発生しました");
    }

    // --- パターン1: 思考/長文生成 (gemini-2.0-flash-thinking-exp 相当 -> deepseek-reasoner) ---
  } else if (aisikibetsu === 1) {
    if (!ai) {
      await message.channel.send("APIキーが設定されていないため、AI機能は利用できません。");
      return;
    }
    message.channel.send('考え中です。llama-3.3-70b-versatileが推論しています...');

    try {
      const stream = await ai.chat.completions.create({
        model: "llama-3.3-70b-versatile", // 推論強化モデル (DeepSeek R1)
        messages: [
          { role: "user", content: content }
        ],
        stream: true,
        // ※ DeepSeek Reasoner は temperature 等のパラメータ指定をサポートしていないため削除しました
      });

      let fullResponse = '';
      const MAX_DISCORD_MESSAGE_LENGTH = 2000;

      for await (const chunk of stream) {
        // DeepSeekのストリームからテキストを取得
        // reasonerモデルの場合、reasoning_content（思考過程）も返ってきますが、
        // ここでは content（最終回答）のみを取得するようにしています。
        const chunkText = chunk.choices[0]?.delta?.content || '';

        if (!chunkText) continue; // 空の場合はスキップ

        fullResponse += chunkText;

        // Discordの2000文字制限処理
        if (fullResponse.length >= MAX_DISCORD_MESSAGE_LENGTH) {
          const partToSend = fullResponse.substring(0, MAX_DISCORD_MESSAGE_LENGTH);
          await message.channel.send(partToSend);
          fullResponse = fullResponse.substring(MAX_DISCORD_MESSAGE_LENGTH);
        }
      }

      // 残りのテキストを送信
      if (fullResponse.length > 0) {
        await message.channel.send(fullResponse);
      }

    } catch (error) {
      console.error('DeepSeek APIからの応答中にエラーが発生しました:', error);
      message.reply('DeepSeek APIからの応答中にエラーが発生しました。');
    }

    // --- パターン2: 既存メッセージの編集 (ストリーミング) ---
  } else if (aisikibetsu === 2) {
    // 元のコードで未定義だった部分を補完しています
    if (!ai) return;

    try {
      const stream = await ai.chat.completions.create({
        model: "deepseek-chat",
        messages: [{ role: 'user', content: content }], // parts ではなく content を使用
        stream: true
      });

      let fullText = '';
      let msgToEdit = null; // 編集対象のメッセージ

      // 最初に「考え中...」などのメッセージを送っておき、それを編集する場合
      // もし既に編集したいメッセージがある場合はそれを引数で渡すなどの変更が必要です
      // ここでは便宜上、新規にメッセージを送ってそれを編集していくスタイルにします
      msgToEdit = await message.channel.send("生成中...");

      let updateCount = 0; // API制限回避のため更新頻度を調整用

      for await (const chunk of stream) {
        const chunkText = chunk.choices[0]?.delta?.content || '';
        fullText += chunkText;

        // Discord APIのレート制限（Rate Limit）に引っかからないよう、
        // 毎回 edit するのではなく、一定量たまるか時間が経過してから edit するのが定石ですが
        // とりあえず元のロジックに近い形で書きます

        // (あまりに高速にeditするとDiscord APIでエラーになるため、本来は間引き処理が必要です)
        updateCount++;
        if (updateCount % 10 === 0) { // 10チャンクごとに更新（簡易的な間引き）
          await msgToEdit.edit(fullText.substring(0, 2000)); // 2000文字以内で編集
        }
      }
      // 最後に確実に全文で更新
      await msgToEdit.edit(fullText.substring(0, 2000));

    } catch (e) {
      console.error(e);
    }
  }
}