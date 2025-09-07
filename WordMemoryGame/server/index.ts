// WordMemoryGame/server/index.ts

import express, { type Request, Response, NextFunction, Application } from "express"; // Application を明示的にインポート
import { registerRoutes } from "./routes";
import { Server, IncomingMessage, ServerResponse } from "http"; // Server, IncomingMessage, ServerResponse をインポート

const app: Application = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      // log関数が利用可能であればそれを使用
      if (typeof globalThis.appLog === 'function') { // グローバルに定義されたログ関数を想定
          globalThis.appLog(logLine);
      } else {
          console.log(logLine);
      }
    }
  });

  next();
});

  (async () => {
    const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Vite関連の関数を動的にインポートするためのプレースホルダー
    let setupVite: (app: Application, server: Server<typeof IncomingMessage, typeof ServerResponse>) => Promise<void>; // 型を修正
    let serveStatic: (app: Application) => boolean; // 型を修正
    let appLog: (message: string) => void;

  // `process.env.BUILD_TARGET` が存在しない、または 'server' 以外の場合にVite関連のモジュールをロード
  // これは主に開発環境 (tsx) での実行時、または通常のNode.js実行時にVite関連を有効にするため
  const isServerBuild = process.env.BUILD_TARGET === 'server';
  const isProduction = process.env.NODE_ENV === "production";

    if (!isServerBuild) {
      try {
        const viteModule = await import("./vite");
        setupVite = viteModule.setupVite as (app: Application, server: Server<typeof IncomingMessage, typeof ServerResponse>) => Promise<void>; // 型アサーションを追加
        serveStatic = viteModule.serveStatic as (app: Application) => boolean; // 型アサーションを追加
        appLog = viteModule.log;
      } catch (error) {
        console.error("Failed to load Vite module:", error);
        setupVite = async (app: Application, server: Server<typeof IncomingMessage, typeof ServerResponse>) => { /* no-op */ }; // 型を修正
        serveStatic = (app: Application) => { console.error("Vite serveStatic not loaded."); return false; }; // 型を修正
        appLog = (message) => console.log(`[FALLBACK LOG] ${message}`);
      }
    } else {
      setupVite = async (app: Application, server: Server<typeof IncomingMessage, typeof ServerResponse>) => { /* no-op */ }; // 型を修正
      serveStatic = (app: Application) => { console.error("Vite serveStatic not loaded. Serving static files directly."); return false; }; // 型を修正
      appLog = (message) => console.log(`[SERVER BUILD LOG] ${message}`);
    }

  // ログ関数をグローバルスコープに設定し、ミドルウェアからアクセス可能にする
  globalThis.appLog = appLog;

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes

  if (!isProduction || process.env.NODE_ENV === "development") {
    // 開発環境または明示的に開発モードの場合
    // 動的インポートされたsetupViteを使用
    if (!isServerBuild && setupVite) { // setupViteがロードされていることを確認
        await setupVite(app, server);
        appLog("Vite development server enabled.");
    } else if (isServerBuild) {
        // tscによるサーバービルドで実行される場合、Vite関連のセットアップはスキップ
        appLog("Skipping Vite setup in server build mode.");
    } else {
        appLog("Falling back to static serving (Vite setup failed or skipped).");
        // setupViteがロードされていない場合のフォールバック（例: 静的ファイル配信のみ）
        app.use(express.static('client/dist'));
        app.get("*", (req, res) => {
            res.sendFile("client/dist/index.html", { root: process.cwd() });
        });
    }
  } else {
    // 本番環境の場合
    // 動的インポートされたserveStaticを使用
    let served = false;
    if (!isServerBuild && serveStatic) { // serveStaticがロードされていることを確認
        served = serveStatic(app);
    } else {
        // serveStaticがロードされていない場合、直接静的ファイルを配信
        app.use(express.static('client/dist'));
        app.get("*", (req, res) => {
            res.sendFile("client/dist/index.html", { root: process.cwd() });
        });
        served = true; // 静的ファイル配信を試みたのでtrue
    }

    if (!served) {
      appLog("Falling back to development mode due to missing build (or Vite module not loaded)");
      if (!isServerBuild && setupVite) {
          await setupVite(app, server);
      } else {
          appLog("Cannot fallback to Vite dev mode (Vite module not loaded).");
      }
    } else {
        appLog("Serving static files for production.");
    }
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    appLog(`serving on port ${port}`);
  });
})();