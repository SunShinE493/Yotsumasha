import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

import Sequelize from "sequelize";
import * as YoutubeIdResolver from '@gonetone/get-youtube-id-by-url';
import Parser from 'rss-parser';

import YoutubeFeeds from "../../models/youtubeFeeds.mjs";
import YoutubeNotifications from "../../models/youtubeNotifications.mjs";
const parser = new Parser();


export const data = new SlashCommandBuilder()
  .setName("youtube")
  .setDescription(
    "YouTube チャンネルの新着動画をお知らせするよ～"
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("add")
      .setDescription("実行したテキストチャンネルに通知設定を追加するよ～")
      .addStringOption(option =>
        option
          .setName('url')
          .setDescription('チャンネルの URL を指定してね')
          .setRequired(true)
        )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("list").setDescription("すべての設定を確認するよ～")
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("delete").setDescription("設定を削除するよ～")
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand == "add") {
    await interaction.deferReply();
    
    const url = interaction.options.getString('url');
    
    const id = await YoutubeIdResolver.channelId(url);
    if (!id) {
      await interaction.editReply({content: "エラーが発生しました。",});
      return;
    }

    const feedUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=" + id;
    
    const youtubeNoficationCount = await YoutubeNotifications.count({
      where: {
        guildId: interaction.guildId,
        textChannelId: interaction.channelId,
        channelFeedUrl: feedUrl,
      },
    });
    if (youtubeNoficationCount > 0) {
      await interaction.editReply({content: "そのチャンネルは既に設定されています。",});
      return;
    }
    
    const feed = await parser.parseURL(feedUrl);

    let latestDate = new Date(feed.items[0].isoDate);

    feed.items.forEach(i => {
      const now = new Date(i.isoDate);
      if (now > latestDate) {
        latestDate = now
      }
    });

    const youtubeFeed = YoutubeFeeds.create({
      channelFeedUrl: feedUrl,
      channelLatestUpdateDate: latestDate.toISOString(),
    });

    const youtubeNofications = YoutubeNotifications.create({
      guildId: interaction.guildId,
      textChannelId: interaction.channelId,
      channelName: feed.title,
      channelUrl: url,
      channelFeedUrl: feedUrl,
    });

    await Promise.all([youtubeFeed, youtubeNofications]);

    const embed = new EmbedBuilder()
      .setColor(0x5cb85c)
      .setTitle(`<#${interaction.channelId}> に YouTube チャンネル通知を設定しました！`)
      .setDescription(`${feed.title}\n${url}`);

    await interaction.editReply({
      content: "",
      embeds: [embed],
    });

  } else if (subcommand == "list") {
    const notificationTextChannels = await YoutubeNotifications.findAll({
      where: {
        guildId: interaction.guildId,
      },
      attributes: [
        [Sequelize.fn('DISTINCT', Sequelize.col('textChannelId')) ,'textChannelId'],
      ]
    });
    
    if (notificationTextChannels.length == 0) {
      await interaction.reply("設定は見つかりませんでした。");
      return;
    }

    const embeds = await Promise.all(
      notificationTextChannels.map(async n => {
        const youtubeNofications = await YoutubeNotifications.findAll({
          where: {
            guildId: interaction.guildId,
            textChannelId: n.textChannelId,
          },
        });
        const channelsArr = youtubeNofications.map(n => `「${n.channelName}」 ${n.channelUrl}`);
        const channels = channelsArr.join("\n");

        return new EmbedBuilder()
                .setColor(0x0099ff)
          .setTitle(`<#${n.textChannelId}> に通知を送信する YouTube チャンネル`)
          .setDescription(channels);
      })
    );

    await interaction.reply({
      content: "",
      embeds: embeds,
    });
  } else if (subcommand == "delete") {
    const notifications = await YoutubeNotifications.findAll({
      where: {
        textChannelId: interaction.channelId,
      },
    });
    
    const notificationSelectMenuOptions = notifications.map(n => 
      new StringSelectMenuOptionBuilder()
        .setLabel(n.channelName)
        .setDescription(n.channelUrl)
        .setValue(n.channelFeedUrl)
    );
    
    const select = new StringSelectMenuBuilder()
                        .setCustomId('youtube-delete')
                        .setPlaceholder('削除する通知設定')
                        .addOptions(notificationSelectMenuOptions)
                        .setMinValues(1)
                        .setMaxValues(notifications.length);
    
                const row = new ActionRowBuilder()
                        .addComponents(select);
    
    const response = await interaction.reply({
                        content: '削除する通知設定を選択してください。',
                        components: [row],
                });

    const collectorFilter = (i) => i.customId === "youtube-delete" && i.user.id === interaction.user.id;

    const collector = response.createMessageComponentCollector({
      collectorFilter,
      time: 30000,
    });

    collector.on("collect", async (collectedInteraction) => {
      const notificationsArr = await Promise.all(
        collectedInteraction.values.map(async (channelFeedUrl) => {
          const youtubeNofication = await YoutubeNotifications.findOne({
            where: {
              channelFeedUrl: channelFeedUrl,
              textChannelId: interaction.channelId,
            },
          });
          await youtubeNofication.destroy();
          return youtubeNofication.channelName;
        })
      );

      const channels = notificationsArr.join("\n");

      const embed = new EmbedBuilder()
        .setColor(0x5cb85c)
        .setTitle(`通知を削除したチャンネル`)
        .setDescription(channels);

      await collectedInteraction.update({
        content: `削除完了～👍`,
        embeds: [embed],
        components: [],
      });
    });
  }
}