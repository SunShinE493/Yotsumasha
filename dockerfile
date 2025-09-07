# ベースイメージを指定
FROM node:20-alpine

# アプリケーションのコードをコンテナの /app ディレクトリにコピー
COPY . /app

# Discordボットの依存関係をインストール
WORKDIR /app
RUN npm install
# ... (前の行は省略)
# Word Memory Gameのビルドを実行
RUN npm run build

# デバッグ用コマンド：ビルド後のdistディレクトリの中身を確認
RUN ls -l dist/

# アプリケーションを起動
# /app と /app/WordMemoryGame を正しいパスで指定
CMD ["/bin/sh", "-c", "node /app/main.mjs & node /app/WordMemoryGame/dist/server/index.js"]
