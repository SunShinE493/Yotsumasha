import { Sequelize, DataTypes } from "sequelize";

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: ".data/db.sqlite3",
  logging: false,
});

const YoutubeFeeds = sequelize.define("YoutubeFeeds", {
  channelFeedUrl: {
    type: DataTypes.STRING,
  },
  channelLatestUpdateDate: {
    type: DataTypes.STRING,
  },
});

export default YoutubeFeeds;