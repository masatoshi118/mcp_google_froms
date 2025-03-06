#!/usr/bin/env node
// @ts-ignore
import { google } from 'googleapis';
import * as http from 'http';
import * as url from 'url';
// @ts-ignore
import open from 'open';
// @ts-ignore
import destroyer from 'server-destroy';

// このスクリプトを実行する前に、以下の環境変数を設定してください
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('環境変数 GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を設定してください');
  process.exit(1);
}

// OAuth2クライアントの初期化
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// 認証スコープの設定
const scopes = [
  'https://www.googleapis.com/auth/forms',
  'https://www.googleapis.com/auth/drive'
];

async function main() {
  // 認証URLの生成
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // リフレッシュトークンを強制的に取得するために必要
  });

  // ローカルサーバーの起動
  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url) {
        throw new Error('No URL in request');
      }

      // コールバックURLからコードを取得
      const queryParams = url.parse(req.url, true).query;
      const code = queryParams.code;

      if (code) {
        // コードをトークンに交換
        const { tokens } = await oauth2Client.getToken(code as string);
        
        // レスポンスを返す
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>認証成功</title>
          </head>
          <body>
            <h1>認証成功！</h1>
            <p>このウィンドウを閉じて、ターミナルに戻ってください。</p>
          </body>
          </html>
        `);

        // リフレッシュトークンを表示
        console.log('\n=== リフレッシュトークン ===');
        console.log(tokens.refresh_token);
        console.log('========================\n');
        console.log('このリフレッシュトークンを環境変数 GOOGLE_REFRESH_TOKEN に設定してください。');
        
        // サーバーを停止
        server.destroy();
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>エラー</title>
          </head>
          <body>
            <h1>認証コードが見つかりません</h1>
          </body>
          </html>
        `);
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>エラー</title>
        </head>
        <body>
          <h1>エラーが発生しました</h1>
          <p>${e}</p>
        </body>
        </html>
      `);
      console.error('Error:', e);
    }
  }).listen(3000, () => {
    // ブラウザで認証URLを開く
    console.log('認証URLを開きます...');
    open(authorizeUrl, { wait: false });
  });

  destroyer(server);
}

main().catch(console.error);
