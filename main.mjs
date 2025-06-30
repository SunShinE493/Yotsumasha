import fs from "fs";
import path from "path";
import express from "express";
import { Client, Collection, Events, GatewayIntentBits, ActivityType, EmbedBuilder, Partials } from "discord.js";
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

const youtubei = new Youtubei();


let postCount = 0;
const app = express();
app.listen(3000);
app.post('/', function(req, res) {
  console.log(`Received POST request.`);
  
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
})

cron.schedule('0 14 * * * *', () => {

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

client.on("ready", async () => {
  await client.user.setActivity('🥔', { type: ActivityType.Custom, state: "🥔を栽培中" });
  console.log(`${client.user.tag} がログインしました！`);
});

Notification.sync({ alter: true });
YoutubeFeeds.sync({ alter: true });
YoutubeNotifications.sync({ alter: true });

CommandsRegister();
client.login(process.env.TOKEN);


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


async function SchTrigger() {

  const now = moment().tz("Asia/Tokyo");

  const hour = now.hour();
console.log('課題確認トリガー'+now+hour)

  if (hour === 6 || hour === 23) {

    // channel を取得（例：特定のチャンネルIDを指定）
console.log('課題確認トリガー'+now+hour)
    const channel = await client.channels.fetch('1162776615445594122'); // てるまない雑談


    const period = hour === 6 ? 'AM' : 'PM';

    sendReminders(channel, period);

  }

}


//追加
client.on('messageCreate', async (message) => {

    // ボット自身のメッセージは無視

    if (message.author.bot) return;

    // リプライされたメッセージか確認

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
    if (/？？？|ふちる|る？|？る/.test(message.content)) {
        await message.channel.send('そんなコマンドないで');
      }
    if (/る？/.test(message.content)) {
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
  if (/<@838466692299882518>あたま/.test(message.content)) {
        await message.channel.send('<@1163105759492571156>あたま');
      }

  
});
