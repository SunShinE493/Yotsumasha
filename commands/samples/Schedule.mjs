import { SlashCommandBuilder } from 'discord.js';

import fs from 'fs';

import path from 'path';

import cron from 'node-cron';

import moment from 'moment-timezone';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);
const scheduleFilePath = path.join(__dirname, 'schedule.json');

function loadSchedule() {

  try {

    const data = fs.readFileSync(scheduleFilePath, 'utf8');

    return JSON.parse(data);

  } catch {

    return [];

  }

}

function saveSchedule(schedule) {

  fs.writeFileSync(scheduleFilePath, JSON.stringify(schedule, null, 2), 'utf8');

}

let schedule = loadSchedule();

let reminderStarted = false;

export const data = new SlashCommandBuilder()

  .setName('schedule')

  .setDescription('課題の予定を管理します')

  .addSubcommand(sub => sub

    .setName('add')

    .setDescription('課題を追加します')

    .addStringOption(opt => opt.setName('name').setDescription('課題名').setRequired(true))

    .addStringOption(opt => opt.setName('due').setDescription('締切日 (YYYY-MM-DD)').setRequired(true))

    .addStringOption(opt => opt.setName('period').setDescription('AM または PM').setRequired(true)))

  .addSubcommand(sub => sub

    .setName('list')

    .setDescription('課題一覧を表示します'))

  .addSubcommand(sub => sub

    .setName('remind')

    .setDescription('リマインドを有効にします'))

  .addSubcommand(sub => sub

    .setName('delete')

    .setDescription('課題を削除します')

    .addIntegerOption(opt => opt.setName('index').setDescription('削除する番号').setRequired(true)))

  .addSubcommand(sub => sub

    .setName('upcoming')

    .setDescription('2週間以内の課題を表示します'));

export async function execute(interaction) {

  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {

    const name = interaction.options.getString('name');

    const due = interaction.options.getString('due');

    const period = interaction.options.getString('period').toUpperCase();

    if (!isValidDate(due) || !['AM', 'PM'].includes(period)) {

      await interaction.reply('日付は YYYY-MM-DD、時間帯は AM または PM を指定してください。');

      return;

    }

    schedule.push({ name, due, period });

    saveSchedule(schedule);

    await interaction.reply(`課題「${name}」が ${due}（${period}）に追加されました。`);

  }

  else if (sub === 'list') {

    if (schedule.length === 0) return await interaction.reply('課題は登録されていません。');

    const msg = schedule.map((t, i) => `${i + 1}. ${t.name} - ${t.due} (${t.period})`).join('\n');

    await interaction.reply(`登録済みの課題:\n${msg}`);

  }

  else if (sub === 'remind') {

    if (reminderStarted) {

      await interaction.reply('リマインドは既に開始されています。');

    } else {

      startReminders(interaction.channel);

      await interaction.reply('リマインドを開始しました。');

    }

  }

  else if (sub === 'delete') {

    const index = interaction.options.getInteger('index');

    if (isNaN(index) || index < 1 || index > schedule.length) {

      await interaction.reply('有効な番号を指定してください。');

      return;

    }

    const removed = schedule.splice(index - 1, 1)[0];

    saveSchedule(schedule);

    await interaction.reply(`課題「${removed.name}」を削除しました。`);

  }

  else if (sub === 'upcoming') {

    const now = new Date();

    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const upcoming = schedule.filter(task => {

      const due = new Date(task.due);

      return due >= now && due <= twoWeeksLater;

    });

    if (upcoming.length === 0) {

      await interaction.reply('2週間以内の課題はありません。');

      return;

    }

    const list = upcoming.map(task => `- ${task.name} (${task.due} ${task.period})`).join('\n');

    await interaction.reply(`今後2週間の課題:\n${list}`);

  }

}

function isValidDate(dateString) {

  const regex = /^\d{4}-\d{2}-\d{2}$/;

  return regex.test(dateString) && !isNaN(new Date(dateString));

}

function startReminders(channel) {

  if (reminderStarted) return;

  reminderStarted = true;

  // 毎日7:00 JST にAMリマインド

  cron.schedule('0 7 * * *', () => {

    sendReminders(channel, 'AM');

  }, {

    timezone: 'Asia/Tokyo'

  });

  // 毎日19:00 JST にPMリマインド

  cron.schedule('0 21 * * *', () => {

    sendReminders(channel, 'PM');

  }, {

    timezone: 'Asia/Tokyo'

  });

}

export function sendReminders(channel, period) {

  const today = moment().tz('Asia/Tokyo').format('YYYY-MM-DD');

  const matchedTasks = schedule.filter(task => task.due === today && task.period === period);

  matchedTasks.forEach(task => {
if(period === 'AM'){
    channel.send(`リマインド: 課題「${task.name}」の締め切りが今日です。 ${task.period}  (${task.due})。<@&1370184233938583624>`);
   }
    else {
      channel.send(`リマインド: 課題「${task.name}」の締め切りが明日です。 ${task.period}  (${task.due})。<@&1370184233938583624>`);
   }
  
  console.log("リマインド: 課題「"+task.name+"」の締め切りが今日の ${task.period} です (${task.due})。");

    
  });

}

