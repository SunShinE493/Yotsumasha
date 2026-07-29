import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import express from "express";
import { Client, Collection, Events, GatewayIntentBits, ActivityType, EmbedBuilder, Partials } from "discord.js";
import { createServer } from "http";
import { WebSocketServer } from 'ws';
import next from 'next';
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
//aaaa

// Import routes. 
import { registerRoutes, performRestoreFromGist } from './server/routes.mjs';

//aaa

const youtubei = new Youtubei();

const dev = process.env.NODE_ENV === 'development';
console.log(`[DEBUG] Next.js mode: ${dev ? 'development' : 'production'}`);
const nextApp = next({ dev, dir: path.join(process.cwd(), 'aura-timetable') });
const nextHandler = nextApp.getRequestHandler();

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



// SPA fallback: only for non-API, non-assets, non-aura, non-file-extension paths
app.get(/^\/(?!api)(?!assets)(?!aura)(?!.*\.[^\/]+$).*/, (req, res) => {
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
  // Prepare Next.js app
  try {
    await nextApp.prepare();
    console.log("Next.js app prepared");
  } catch (err) {
    console.error("Failed to prepare Next.js app:", err);
  }

  // Set up Express middleware for JSON parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Register routes with auth system
  try {
    // Load persisted in-memory data before wiring routes
    try { await storage.loadFromDisk?.(); } catch { }
    await registerRoutes(app);
    console.log("Routes registered successfully");

    // Protect and serve aura-timetable
    app.all('/aura*', (req, res) => {
      // API call protections are handled by their own routes (optionalAuthentication)
      // This is for Next.js page requests
      if (req.method === 'GET' && !req.isAuthenticated()) {
        const accept = req.headers.accept || '';
        if (accept.includes('text/html')) {
          // Redirect browser requests to the auth page
          return res.redirect(`/auth?redirect=${encodeURIComponent(req.originalUrl)}`);
        }
      }
      return nextHandler(req, res);
    });
  } catch (error) {
    console.error("Failed to register routes:", error);
  }

  const server = createServer(app);
  // --- WebSocket Real-time Battle ---
  const rooms = new Map(); // roomId -> { host, timeLimit, maxQuestions, asked, words, state, players: Map(name->ws), scores: Map(name->number>, idx, timer }
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

    if (pathname.startsWith('/aura')) {
      // Let Next.js handle its own WebSockets if any (HMR in dev mode)
      return;
    }

    // Default to bot's WebSocket logic
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

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
              const roomObj = rooms.get(room); // refresh ref
              if (!roomObj || roomObj.state !== 'running') return;

              roomObj.asked = (roomObj.asked || 0) + 1;
              if (roomObj.maxQuestions && roomObj.asked >= roomObj.maxQuestions) {
                const lastQ = roomObj.words[roomObj.idx];
                roomObj.state = 'ended';
                if (roomObj.timer) { clearTimeout(roomObj.timer); roomObj.timer = null; }
                broadcast(room, { type: 'end', scores: toScores(roomObj), endReason: 'finished', lastId: lastQ?.id ?? null, lastWord: lastQ?.word ?? null, lastMeaning: lastQ?.meaning ?? null });
                scheduleRoomCleanup(room);
                return;
              }

              const prevQ = roomObj.words[roomObj.idx];
              roomObj.idx = (roomObj.idx + 1) % roomObj.words.length;
              const nq = roomObj.words[roomObj.idx];

              // Reset round
              roomObj.roundState = 'active';
              roomObj.roundRank = 1;
              roomObj.answeredPlayers.clear();

              broadcast(room, {
                type: 'question',
                index: roomObj.idx,
                id: nq?.id ?? null,
                word: nq?.word ?? null,
                meaning: nq?.meaning ?? null,
                choices: nq?.choices ?? null,
                prevWord: prevQ?.word ?? null,
                prevMeaning: prevQ?.meaning ?? null,
                prevAnswerer: roomObj.lastCorrectBy || null,
                timeLimit: roomObj.timeLimit,
                progress: { current: roomObj.asked + 1, total: roomObj.maxQuestions || roomObj.words.length }
              });
              roomObj.lastCorrectBy = null;
              scheduleQuestionTimer(room);
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

cron.schedule('0 0 * * * *', () => {

  const now = moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss');

  console.log(`[${now}] ⏰ 毎時リマインドチェックを実行します`);

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




import { dailyTrigger } from './commands/samples/daymath.mjs';
import { askQuiz } from './commands/samples/wordQuiz.mjs';
import { GoogleGenAI } from "@google/genai"; // ※元のコードに残っていましたが、下部でOpenAI互換を使用しているため未使用なら削除可
import OpenAI from "openai";

// --- 設定: GitHub Gist連携用 ---
const GIST_TOKEN = process.env.GIST_TOKEN || ''; // ここにGitHubトークンを設定
const GIST_ID = process.env.GIST_ID || '';           // ここに保存先のGist IDを設定
const GIST_FILENAME = 'wordlistmemory.json';
const SCHEDULE_FILENAME = 'schedule.json';

import { getGistFile, updateGistFile, appendToGistFile } from './shared/gistUtils.mjs';

let wcount = 1;

// --- スケジュールトリガー ---
async function SchTrigger() {
  const now = moment().tz("Asia/Tokyo");
  const hour = now.hour();
  console.log('スケジュール確認トリガー: ' + now.format('YYYY-MM-DD HH:mm'));

  // 1. Gistから予定を読み込んでリマインドチェック
  try {
    const schedule = await getGistFile(SCHEDULE_FILENAME) || [];
    const todayStr = now.format('YYYY-MM-DD');
    const currentHourStr = now.format('HH');

    // その日の、現在の時間に該当する予定を探す
    const matchedTasks = schedule.filter(task => {
      if (task.due !== todayStr) return false;
      const taskHour = task.time ? task.time.split(':')[0] : null;
      return taskHour === currentHourStr;
    });

    for (const task of matchedTasks) {
      const targetChannelId = task.channel || '1162776615445594122'; // デフォルト: てるまない雑談
      try {
        const channel = await client.channels.fetch(targetChannelId);
        if (channel) {
          channel.send(`⏰ **リマインド**: 「${task.name}」の時間です (${task.time})。<@&1370184233938583624>`);
        }
      } catch (err) {
        console.error(`Failed to send reminder to channel ${targetChannelId}:`, err);
      }
    }
  } catch (err) {
    console.error('Failed to process hourly reminders:', err);
  }

  // 2. 既存の定時処理
  if (hour === 26) {
    const channel2 = await client.channels.fetch('838468033789558848');
    dailyTrigger(channel2);
    console.log('積分');
  } else if (hour > 23 && hour < 23) {
    const channelId = '838468033789558848';
    wcount++;
    askQuiz(client, channelId, wcount);
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

// --- メインのメッセージイベントハンドラ ---
client.on('messageCreate', async (message) => {

  // ボット自身のメッセージは無視
  if (message.author.bot) return;

  // リプライされたメッセージか確認（Botへのメンション）
  // IDはBot自身のものに書き換えてください
  const MY_BOT_ID = '1187343608026771496';

  if (message.mentions.has(MY_BOT_ID)) {

    // 1. 画像リプライの処理
    if (message.reference && message.reference.messageId) {
      const repliedChannel = message.channel;
      const repliedMessageId = message.reference.messageId;

      try {
        const repliedMessage = await repliedChannel.messages.fetch(repliedMessageId);
        const attachment = repliedMessage.attachments.first();

        // 画像がない場合（テキストのみのリプライなど）
        if (!attachment || !attachment.contentType.startsWith('image')) {
          try {
            let content = message.content + '以降は、以前のメッセージを添付しています。→→' + repliedMessage.content;
            const keyword = `<@${MY_BOT_ID}>`;
            content = content.replace(new RegExp(keyword, "g"), "");
            console.log(content);
            runai(content, message, 1);
          } catch (error) {
            console.error('リプライコンテントがない', error)
          }
          return;
        }

        // 画像がある場合
        try {
          const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
          const imageData = response.data;
          const mimeType = attachment.contentType;
          const base64Image = Buffer.from(imageData).toString('base64');

          let promptText = message.content.replace(`<@${client.user.id}>`, '').trim(); // client.user.idを使用

          console.log(promptText)
          // ※Gemini用のpayload構造ですが、runai側でOpenAI系を使っているため、
          // 画像処理を行う場合はrunai側も画像対応（GPT-4oなど）に修正する必要があります。
          // ここでは既存コードの構造を維持します。
          const parts = [
            { text: promptText },
            { inlineData: { data: base64Image, mimeType: mimeType } },
          ];
          runai(parts, message, 1); // ここで画像処理用の分岐が必要かもしれません
        } catch (error) {
          console.error('画像リプライ処理エラー', error)
        }
      } catch (error) {
        console.error('リプライ取得エラー', error);
      }
    }
    // 2. 通常のメンション（画像リプライではない場合）
    else {
      let content = message.content.replace(new RegExp(`<@!?${MY_BOT_ID}>`, 'g'), '').trim();

      // ▼▼▼ 追加機能: 単語リスト登録機能 / 予定登録機能 ▼▼▼
      if (content.includes("予定に追加")) {
        const extractedData = await extractScheduleJson(content, message);

        if (extractedData && extractedData.name && extractedData.due) {
          const jsonString = JSON.stringify(extractedData, null, 2);
          const confirmMsg = await message.channel.send(
            `以下の予定を追加しますか？\n\`\`\`json\n${jsonString}\n\`\`\``
          );

          await confirmMsg.react('✅');
          await confirmMsg.react('❌');

          const filter = (reaction, user) => ['✅', '❌'].includes(reaction.emoji.name) && !user.bot;
          const collector = confirmMsg.createReactionCollector({ filter, time: 600000 });

          collector.on('collect', async (reaction, user) => {
            if (reaction.emoji.name === '✅') {
              await message.channel.send('Gistに予定を保存しています...');
              const success = await appendToGistFile(SCHEDULE_FILENAME, [extractedData]);
              if (success) {
                await message.channel.send(`✅ Gist (${SCHEDULE_FILENAME}) に予定を追加しました！`);
              } else {
                await message.channel.send('❌ Gistへの保存に失敗しました。');
              }
              collector.stop('accepted');
            } else if (reaction.emoji.name === '❌') {
              await message.channel.send('キャンセルしました。');
              collector.stop('cancelled');
            }
          });
          return;
        }
      }

      // 単語リスト登録 (既存)
      const wordListPattern = /[a-zA-Z]+.*[ー\-].+/;
      if (wordListPattern.test(content)) {
        const extractedData = await extractWordListJson(content);
        if (extractedData && Array.isArray(extractedData) && extractedData.length > 0) {
          const jsonString = JSON.stringify(extractedData, null, 2);
          const confirmMsg = await message.channel.send(
            `以下の内容をリストに追加しますか？\n\`\`\`json\n${jsonString}\n\`\`\``
          );

          await confirmMsg.react('✅');
          await confirmMsg.react('❌');

          const filter = (reaction, user) => ['✅', '❌'].includes(reaction.emoji.name) && !user.bot;
          const collector = confirmMsg.createReactionCollector({ filter, time: 600000 });

          collector.on('collect', async (reaction, user) => {
            if (reaction.emoji.name === '✅') {
              await message.channel.send('Gistに追加しています...');
              const success = await appendToGistFile(GIST_FILENAME, extractedData);
              if (success) {
                await message.channel.send(`✅ Gist (${GIST_FILENAME}) に ${extractedData.length}件追加しました！`);
              } else {
                await message.channel.send('❌ Gistへの追加に失敗しました。');
              }
              collector.stop('accepted');
            } else if (reaction.emoji.name === '❌') {
              await message.channel.send('キャンセルしました。');
              collector.stop('cancelled');
            }
          });
          return;
        }
      }
      // ▲▲▲ 追加機能終了 ▲▲▲

      // 通常のAI会話
      runai(content, message, 0);
    }
  }

  // ボット自身のメッセージへのリプライ検知（リアクション用）
  if (message.reference) {
    try {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (repliedMessage.author.id === client.user.id) {
        await message.react('😅');
        console.log(`リアクションを追加しました: ${message.content}`);
      }
    } catch (error) {
      console.error('リプライ処理中にエラーが発生しました:', error);
    }
  }
});

// --- リアクションイベント ---
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
    const channel = message.channel;
    channel.send(`${user.toString()}あたま`);
  }
  if (reaction.emoji.name === '💩') {
    if (user.id === '1163105759492571156') {
      reaction.message.channel.send("<@1163105759492571156>うんこ置くな");
    }
  }
});

// --- その他の自動応答用 messageCreate ---
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

  // 自動応答ルール
  if (/漏らして|💩/.test(message.content)) {
    await message.channel.send('ぶりっ💩');
    await message.react('💩');
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
    await message.react('🇨'); await message.react('🇭'); await message.react('🇴'); await message.react('🇳'); await message.react('🇸');
  }
  if (/<@838466692299882518>あたま|<@838466692299882518> あたま|<@1236945333511258165>あたま/.test(message.content)) {
    await message.channel.send('<@1163105759492571156>あたま');
  }
});

// --- AI設定 (OpenAI / Groq) ---
const G_API_KEY = process.env.GroqApi;
if (G_API_KEY === undefined) {
  console.log("Groq APIキーなし");
}

let ai;
let lai;
if (G_API_KEY) {
  lai = new OpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: G_API_KEY
  });
} else {
  console.log("API Key missing, Groq AI features disabled.");
}

// --- AI実行関数 ---
async function runai(content, message, aisikibetsu) {
  const talk = (typeof content === 'string') ? content : "（画像が送信されましたが、現在のモデルではテキストのみ処理します）"; // 画像ペイロード対策

  // --- パターン0: 通常の会話 ---
  if (aisikibetsu === 0) {
    if (!lai) {
      await message.channel.send("APIキーが設定されていないため、AI機能は利用できません。");
      return;
    }

    try {
      const completion = await lai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "user", content: talk + "（##回答の内容は短く簡潔に。）" }
        ],
        max_tokens: 1800,
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

    // --- パターン1: 思考/長文生成 ---
  }
  else if (aisikibetsu === 1) {
    if (!lai) {
      await message.channel.send("Groq APIキーが設定されていないため、AI機能は利用できません。");
      return;
    }
    message.channel.send('考え中です...');

    try {
      const discordCulture = "\n\n(注意: Discordで返信するため、####や$$は使用禁止です。見出しは###や**太字**を、数式や強調はコードブロック(```)や太字を使用してください。)";

      let textContent = talk;
      if (Array.isArray(content) && content[0].text) {
        textContent = content[0].text;
      }
      textContent += discordCulture;

      const stream = await lai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "user", content: textContent }
        ],
        stream: true,
      });

      let fullResponse = '';
      const MAX_DISCORD_MESSAGE_LENGTH = 2000;

      for await (const chunk of stream) {
        const chunkText = chunk.choices[0]?.delta?.content || '';
        if (!chunkText) continue;

        fullResponse += chunkText;

        if (fullResponse.length >= MAX_DISCORD_MESSAGE_LENGTH) {
          const partToSend = fullResponse.substring(0, MAX_DISCORD_MESSAGE_LENGTH);
          await message.channel.send(partToSend);
          fullResponse = fullResponse.substring(MAX_DISCORD_MESSAGE_LENGTH);
        }
      }

      if (fullResponse.length > 0) {
        await message.channel.send(fullResponse);
      }

    } catch (error) {
      console.error('APIからの応答中にエラーが発生しました:', error);
      message.reply('APIからの応答中にエラーが発生しました。');
    }
  }
  // --- パターン2: 既存メッセージの編集 ---
  else if (aisikibetsu === 2) {
    if (!lai) return;

    try {
      const stream = await lai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: 'user', content: talk }],
        stream: true
      });

      let fullText = '';
      let msgToEdit = await message.channel.send("生成中...");
      let updateCount = 0;

      for await (const chunk of stream) {
        const chunkText = chunk.choices[0]?.delta?.content || '';
        fullText += chunkText;

        updateCount++;
        if (updateCount % 10 === 0) {
          await msgToEdit.edit(fullText.substring(0, 2000)).catch(() => { });
        }
      }
      await msgToEdit.edit(fullText.substring(0, 2000)).catch(() => { });

    } catch (e) {
      console.error(e);
    }
  }
}

// 1. AIを使ってテキストから単語リストJSONを抽出する関数
async function extractWordListJson(text) {
  if (!lai) return null;

  try {
    const prompt = `
    以下のテキストから「英単語」と「意味」のペアを抽出し、JSON配列形式で出力してください。
    他の解説は一切不要です。JSONのみを出力してください。

    フォーマット:
    [
      {"word": "英単語", "meaning": "意味"},
      {"word": "英単語", "meaning": "意味"}
    ]

    テキスト:
    ${text}
    `;

    const completion = await lai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // 確実性を高める
      stream: false,
    });

    let content = completion.choices[0].message.content;

    // コードブロック(```json ... ```)の除去
    content = content.replace(/```json|```/g, '').trim();

    // JSONとしてパースできるか確認
    return JSON.parse(content);
  } catch (e) {
    console.error('JSON Extraction Error:', e);
    return null;
  }
}

// 2. Gistに単語リストを追記する関数
async function addToGist(newEntries) {
  if (!GIST_TOKEN || !GIST_ID) {
    console.error('GitHub Token or Gist ID is missing.');
    return false;
  }

  try {
    // 1. 現在のGistデータを取得
    const getResponse = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Authorization: `token ${GIST_TOKEN}` }
    });

    const file = getResponse.data.files[GIST_FILENAME];
    let currentData = [];

    if (file && file.content) {
      try {
        currentData = JSON.parse(file.content);
      } catch (e) {
        console.error('Existing Gist content is not valid JSON, starting fresh.');
      }
    }

    // 2. データを結合
    const updatedData = [...currentData, ...newEntries];

    // 3. Gistを更新 (PATCH)
    await axios.patch(`https://api.github.com/gists/${GIST_ID}`, {
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(updatedData, null, 2)
        }
      }
    }, {
      headers: { Authorization: `token ${GIST_TOKEN}` }
    });

    return true;
  } catch (error) {
    console.error('Failed to update Gist:', error.response?.data || error.message);
    return false;
  }
}

// 3. AIを使って予定をJSONに変換する関数
async function extractScheduleJson(text, message) {
  if (!lai) return null;

  try {
    const now = moment().tz("Asia/Tokyo");
    const todayStr = now.format('YYYY-MM-DD (dddd) HH:mm');

    const prompt = `
    以下のテキストから「予定の内容」「日付」「時間（24時間表記）」「チャンネルID」を抽出し、JSON形式で出力してください。
    基準日時: ${todayStr}

    ルール:
    - 「明日」「14時」などの相対的な表現は基準日時から計算してください。
    - 時間が指定されていない場合は「00:00」としてください。
    - チャンネルIDは「${message.channel.id}」をそのまま使用してください。

    フォーマット:
    {
      "name": "予定の内容",
      "due": "YYYY-MM-DD",
      "time": "HH:mm",
      "channel": "チャンネルID"
    }

    ※解説は不要です。JSONのみを出力してください。

    テキスト:
    ${text}
    `;

    const completion = await lai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      stream: false,
    });

    let content = completion.choices[0].message.content;
    content = content.replace(/```json|```/g, '').trim();
    return JSON.parse(content);
  } catch (e) {
    console.error('Schedule Extraction Error:', e);
    return null;
  }
}



import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
let aisikibetsu, max;




const API_KEY = process.env.GOOGLE_API_KEY;
if (API_KEY === undefined) {
  console.log("APIki-なし")
}
if (API_KEY) {
  ai = new GoogleGenAI(API_KEY, {});
} else {
  console.log("API Key missing, AI features disabled.");
}
/**
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
        const chunkText = chunk.text || "";
        if (!chunkText) continue;
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


