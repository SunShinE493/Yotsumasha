# ベースイメージを指定
FROM node:20-alpine

# アプリケーションのコードをコンテナの /app ディレクトリにコピー
COPY . /app

# Discordボットの依存関係をインストール
WORKDIR /app
RUN npm install

# Word Memory Gameの依存関係をインストール
WORKDIR /app/WordMemoryGame
RUN npm install

# Word Memory Gameのビルドを実行
# これにより、dist/server/index.js が生成されることを期待
RUN npm run build

# アプリケーションを起動
# /app と /app/WordMemoryGame を正しいパスで指定
CMD ["/bin/sh", "-c", "node /app/main.mjs & node /app/WordMemoryGame/dist/server/index.js"]
