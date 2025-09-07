# ベースイメージを指定
FROM node:20-alpine

# Discordボットの依存関係をインストール
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# Word Memory Gameの依存関係をインストール
WORKDIR /app/WordMemoryGame
COPY ./WordMemoryGame/package.json ./WordMemoryGame/package-lock.json ./
RUN npm install

# アプリケーションのコードをコピー
COPY . /app

# 複数のプロセスを同時に起動
CMD ["/bin/sh", "-c", "node /app/main.mjs & node /app/WordMemoryGame/dist/server/index.js"]
