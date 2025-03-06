# Google Forms MCP Server

このMCPサーバーは、Google FormsのAPIを使用して、フォームの作成、編集、回答の取得などの機能を提供します。

## ビルド方法

### 初期セットアップ
リポジトリをクローンした後、依存関係をインストール
```
cd google-forms-server
npm install
```

### サーバーのビルド
```
# メインのMCPサーバーをビルド
npm run build
```

### リフレッシュトークン取得スクリプトのビルド
```
# リフレッシュトークン取得スクリプトをビルド
npm run build:token
```

### 開発環境における実行
```
# サーバーを直接実行
node build/index.js

# または、npm scriptを使用
npm run start
```


## セットアップ方法

1. Google Cloud Consoleでプロジェクトを作成し、Google Forms APIを有効にします。
   - https://console.cloud.google.com/
   - APIとサービス > ライブラリから「Google Forms API」を検索して有効にします。

2. OAuth 2.0クライアントIDとシークレットを取得します。
   - APIとサービス > 認証情報 > 認証情報を作成 > OAuth クライアントID
   - アプリケーションの種類：「デスクトップアプリ」を選択

3. 環境変数を設定してリフレッシュトークンを取得します。
   ```bash
   export GOOGLE_CLIENT_ID="あなたのクライアントID"
   export GOOGLE_CLIENT_SECRET="あなたのクライアントシークレット"
   cd google-forms-server
   npm run build
   node build/get-refresh-token.js
   ```

   注意: get-refresh-token.jsの実行時にエラーが発生する場合は、以下のコマンドを実行してください。
   ```bash
   cd google-forms-server
   npm run build:token
   node build/get-refresh-token.js
   ```

4. 表示されたリフレッシュトークンをコピーします。

5. Claudeのデスクトップアプリの設定ファイルを更新します。
   - `~/Library/Application Support/Claude/claude_desktop_config.json`を開きます。
   - `mcpServers`セクションの`google-forms-server`に環境変数を追加します：
   ```json
   "google-forms-server": {
     "command": "node",
     "args": [
       "/Users/nakamotomasatoshi/application/AI/mcp-google-form/google-forms-server/build/index.js"
     ],
     "env": {
       "GOOGLE_CLIENT_ID": "あなたのクライアントID",
       "GOOGLE_CLIENT_SECRET": "あなたのクライアントシークレット",
       "GOOGLE_REFRESH_TOKEN": "取得したリフレッシュトークン"
     }
   }
   ```

6. Claudeのデスクトップアプリを再起動します。

## 使用可能なツール

このMCPサーバーは以下のツールを提供します：

1. `create_form` - 新しいGoogleフォームを作成します
2. `add_text_question` - フォームにテキスト質問を追加します
3. `add_multiple_choice_question` - フォームに選択式質問を追加します
4. `get_form` - フォームの詳細を取得します
5. `get_form_responses` - フォームの回答を取得します

## 使用例

```
フォームを作成して、いくつかの質問を追加してください。
```

Claudeは以下のようなMCPツールを使用してフォームを作成します：

1. `create_form`ツールを使用して新しいフォームを作成
2. `add_text_question`や`add_multiple_choice_question`ツールを使用して質問を追加
3. 作成されたフォームのURLを表示
