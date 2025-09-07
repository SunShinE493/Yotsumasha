# ベースイメージを指定
FROM node:20-alpine

# リポジトリ全体をコンテナの /app ディレクトリにコピー
COPY . /app

# Discordボットの依存関係をインストール
WORKDIR /app
RUN npm install

# Word Memory Gameの依存関係をインストール
WORKDIR /app/WordMemoryGame
RUN npm install

# Word Memory Gameのビルドを実行
RUN npm run build

# 複数のプロセスを同時に起動
CMD ["/bin/sh", "-c", "node /app/main.mjs & node /app/WordMemoryGame/dist/index.js"]
