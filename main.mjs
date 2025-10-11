import fs from "fs";
import path from "path";
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

// Import routes
import { registerRoutes } from './server/routes.mjs';

//aaa

const youtubei = new Youtubei();

 
let postCount = 0;
const app = express();
const port = 5000;

// Serve static files from dist directory (built React app) - BEFORE any routes
const distDir = path.join(process.cwd(), 'dist');
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
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(distDir, 'index.html'));
});
app.post('/api', function(req, res) {
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
app.get('/', function(req, res) {
  res.send('<a href="https://note.com/exteoi/n/n0ea64e258797</a> に解説があります。');
});

// Lightweight keep-alive endpoint (pre-auth/CSRF). Define BEFORE auth middleware registration.
app.post('/', function(req, res) {
  // No CSRF required for this keep-alive ping
  res.status(204).end();
});

// Static and SPA fallback moved above to take precedence over legacy routes

async function runWebserver(){
  // Set up Express middleware for JSON parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Register routes with auth system
  try {
    // Load persisted in-memory data before wiring routes
    try { await storage.loadFromDisk?.(); } catch {}
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
      try { ws.send(data); } catch {}
    }
    if (room.host) { try { room.host.send(data); } catch {} }
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
      broadcast(roomId, { type: 'question', index: room.idx, id: nq?.id ?? null, word: nq?.word ?? null, meaning: nq?.meaning ?? null, prevWord: prevQ?.word ?? null, prevMeaning: prevQ?.meaning ?? null, timeLimit: room.timeLimit, progress: { current: room.asked + 1, total: room.maxQuestions || room.words.length } });
      scheduleQuestionTimer(roomId);
    }, r.timeLimit * 1000);
  }

  // Schedule deletion of a room 60s after it ends
  function scheduleRoomCleanup(roomId) {
    const r = rooms.get(roomId);
    if (!r) return;
    if (r.cleanupTimer) { try { clearTimeout(r.cleanupTimer); } catch {} }
    r.cleanupTimer = setTimeout(() => {
      const target = rooms.get(roomId);
      if (!target) return;
      // Only remove if still ended or empty
      if (target.state === 'ended' || (target.players && target.players.size === 0)) {
        if (target.timer) { try { clearTimeout(target.timer); } catch {} }
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
    const q = room.words[room.idx];
    broadcast(roomId, { type: 'question', index: room.idx, id: q?.id ?? null, word: q?.word ?? null, meaning: q?.meaning ?? null, prevWord: null, prevMeaning: null, progress: { current: 1, total: room.maxQuestions || room.words.length } });
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
        let normalized = words.map(w => ({ id: String(w.id||''), word: String(w.word||''), meaning: String(w.meaning||'') })).filter(w => w.word && w.meaning);
        normalized = normalized.sort(() => Math.random() - 0.5);
        const maxQuestions = Math.max(1, Math.min(Number(questionCount)||normalized.length, normalized.length));
        const r = {
          host: ws,
          timeLimit: Math.max(5, Number(limitSec)||30),
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
          ws.send(JSON.stringify({ type: 'question', index: r.idx, id: q?.id ?? null, word: q?.word ?? null, meaning: q?.meaning ?? null, prevWord: null, prevMeaning: null, progress: { current: r.asked + 1, total: r.maxQuestions || r.words.length } }));
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
        const ok = String(text||'').trim().toLowerCase() === q.meaning.trim().toLowerCase();
        // Notify all about the answer attempt with content (correct or not)
        broadcast(room, { type: 'answered', by: name, text: String(text||''), correct: !!ok });
        if (ok) {
          r.lastCorrectBy = name;
          const prev = r.scores.get(name) || 0; r.scores.set(name, prev + 1);
          r.asked = (r.asked || 0) + 1;
          if (r.maxQuestions && r.asked >= r.maxQuestions) {
            r.state = 'ended';
            if (r.timer) { clearTimeout(r.timer); r.timer = null; }
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
        } else {
          // wrong answer: keep same question; do nothing else
        }
      }
    });
    ws.on('close', () => {
      const room = ws._room; const name = ws._name;
      if (!room || !rooms.has(room)) return;
      const r = rooms.get(room);
      if (r.players.has(name)) r.players.delete(name);
      if (r.players.size === 0) {
        if (r.timer) { try { clearTimeout(r.timer); } catch {} }
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
  server.listen(port,'0.0.0.0',()=>{
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
    import(filePath).then((module) => {
      client.commands.set(module.data.name, module);
    });
  }
}

const handlers = new Map();

const handlersPath = path.join(process.cwd(), "handlers");
const handlerFiles = fs.readdirSync(handlersPath).filter((file) => file.endsWith(".mjs"));

for (const file of handlerFiles) {
  const filePath = path.join(handlersPath, file);
  import(filePath).then((module) => {
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
});


Notification.sync({ alter: true });
YoutubeFeeds.sync({ alter: true });
YoutubeNotifications.sync({ alter: true });

CommandsRegister();
client.login(process.env.TOKEN);
runWebserver();

async function trigger() {
  const youtubeNofications = await YoutubeNotifications.findAll({
    attributes: [
      [Sequelize.fn('DISTINCT', Sequelize.col('channelFeedUrl')) ,'channelFeedUrl'],
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
      .setAuthor({ name: v.author, url: `https://www.youtube.com/channel/${youtubeChannelId}`})
      .setTitle(v.title)
     .setURL(v.link)
      .setDescription(youtubeVideo.description)
     .setImage(youtubeVideo.thumbnails.best)
      .setTimestamp(new Date(v.isoDate));
    
    //.setThumbnail(youtubeChannel.thumbnails.best)

    notifications.forEach( n => {
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
import {dailyTrigger} from './commands/samples/daymath.mjs'
import {askQuiz} from './commands/samples/wordQuiz.mjs'
import { sendJsonAsText } from './commands/samples/wordQuiz.mjs'
let wcount = 1;
async function SchTrigger() {

  const now = moment().tz("Asia/Tokyo");

  const hour = now.hour();
console.log('課題確認トリガー'+now+hour)

  let channelId = '1188202806851682314';
  let filePath = 'commands/samples/wordlist.json';
  sendJsonAsText(client, channelId, filePath) 
  if (hour === 6 || hour === 23) {

    // channel を取得（例：特定のチャンネルIDを指定）
console.log('課題確認トリガー'+now+hour)
    const channel = await client.channels.fetch('1162776615445594122'); // てるまない雑談


    const period = hour === 6 ? 'AM' : 'PM';

    sendReminders(channel, period);

  }else if (hour === 4){
    const channel2 = await client.channels.fetch('838468033789558848'); //一般'838468033789558848
dailyTrigger(channel2)
    console.log('積分');
  }else if(hour > 4 && hour < 23) {
    const channelId = '838468033789558848';
    const today = new Date(); // 日付を番号に変換する例 (例: 8月19日なら19
     const dayNumber = today.getDate();
     wcount++;
    askQuiz(client, channelId, wcount)
  }

}


//追加
client.on('messageCreate', async (message) => {

    // ボット自身のメッセージは無視

    if (message.author.bot) return;

    // リプライされたメッセージか確認
if(message.mentions.has('1187343608026771496')) {

if (message.reference&&message.reference.messageId) {

  const repliedChannel = message.channel; 
  const repliedMessageId = message.reference.messageId;

  // 返信元のメッセージを取得

  const repliedMessage = await repliedChannel.messages.fetch(repliedMessageId);
  
    const attachment = repliedMessage.attachments.first();
    if (!attachment || !attachment.contentType.startsWith('image')) {
      //画像なし

  try {
  // リプライ元のチャンネルを取

  let content= message.content +'以降は、以前のメッセージを添付しています。→→' +repliedMessage.content;
    const keyword = '<@1187343608026771496>'
  content = content.replace(new RegExp(keyword, "g"), "");
    console.log(content);
  runai(content, message , 1);
  } catch (error) {
  console.error('リプライコンテントがない',error)
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
      
  runai(parts,message,1);
    } catch (error) {
    console.error('画像リプライコンテントがない',error)
    }
}else{
  runai(0,message, 0)
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

});







client.on('messageCreate', async message => {
    // ボットのメッセージは無視
    if (message.author.bot) {
      if(/ターボ/.test(message.content)){
        await message.channel.send('<:GCGGarrettTurbo:1352270869170225233>')
      }else if(/サーブ/.test(message.content)){
        await message.channel.send('<a:serve:1352267714974060644><a:serve:1352267714974060644><a:serve:1352267714974060644><a:serve:1352267714974060644>')
      }else   if (/<@838466692299882518>あたま/.test(message.content)) {
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
let aisikibetsu,max;

 

  const API_KEY = process.env.GOOGLE_API_KEY;
if(API_KEY === undefined){
  console.log("APIki-なし")
}
  const ai = new GoogleGenAI(API_KEY,{});
  async function runai(content,message,aisikibetsu){
    const talk = message.content;
    if(aisikibetsu === 0){
      max = 1000;
    
  const chat = await ai.models.generateContent({
    model : "gemini-2.5-flash",
    contents : talk + "（##回答の内容は短く簡潔に。）",
    config : {
      maxOutputTokens : 1800,
    },
  })
  console.log(chat.text);
  if(chat.text !== undefined){
    await message.channel.send(chat.text);
  }else{
    await message.channel.send("字数エラー");
    console.log("字数エラー");
  }
    } else if(aisikibetsu === 1){
      message.channel.send('考え中です。これには数分かかる場合もあります。');

      try {
    
        let result = await ai.models.generateContentStream({
        model: "gemini-2.5-pro",
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
}else if (aisikibetsu === 2){



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