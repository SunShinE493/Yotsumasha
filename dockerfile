# ベースイメージを指定
FROM node:20-alpine

# Discordボットの依存関係をインストール
WORKDIR /app/discord-bot
COPY package.json .
COPY package-lock.json .
RUN npm install

# Word Memory Gameの依存関係をインストール
WORKDIR /app/word-memory-game
COPY WordMemoryGame/package.json .
COPY WordMemoryGame/package-lock.json .
RUN npm install

# アプリケーションのコードをコピー
COPY . /app

# 複数のプロセスを同時に起動
CMD ["/bin/sh", "-c", "node /app/discord-bot/main.mjs & node /app/word-memory-game/dist/server/index.js"]
