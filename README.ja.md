# Kaiwa（会話）— 日本語会話練習アプリ

[English](README.md) | 日本語

ローカル完結型の日本語会話練習アプリ。[Ollama](https://ollama.com) を通じて
自分のマシン上で完全に動作するAIパートナーと、自然な日本語のやり取りを行えます。
サブスクリプション不要、サインアップ不要、クラウド接続も不要です。

> **開発状況:** v1.0 完成 — 設定に応じたテキスト**・**音声会話、読み補助機能
> （ふりがな、ホバー辞書、翻訳、単語保存）、日本語へのインラインフィードバック、
> シナリオモードを実装済み。全体構想は `PROJECT_BRIEF.md`、開発ログは
> `STATE.md` を参照してください。

![Kaiwa — ダークテーマのチャットUI、日本語の返信・ふりがな・インラインフィードバック注釈を表示](docs/screenshot.png)

## 主な機能

- **ローカルLLMによるストリーミング会話** — 会話履歴を毎ターン、文脈として
  保持します。
- **会話中に調整可能な3つの設定:**
  - **難易度** — 初級・中級・上級・ネイティブ相当
  - **文体（レジスター）** — カジュアル・フレンドリー・丁寧・フォーマル
  - **主導権** — AI主導・バランス・ユーザー主導
- **会話モード:** 自由に話せる**フリートーク**、10種類の**シナリオ**
  （レストラン、ホテルチェックイン、面接など）、任意のテーマからモデルが
  その場で生成する**自動生成シナリオ**。
- **読み補助機能**（オプトイン、デフォルトはオフ）:
  - **ふりがな** — SudachiPyによる決定論的な漢字への振り仮名生成。
  - **ホバー辞書** — 単語の意味（JMdict）と漢字ごとの読み・意味
    （KANJIDIC2）をローカルで即座に表示。LLM呼び出しなし。
  - **翻訳** — 任意の返信を英語に翻訳（オンデマンドの別LLM呼び出し）。
  - **単語のクイック保存** — ワンクリックで単語をブラウザに保存。
- **インラインフィードバック** — 送信した各メッセージに対し、折りたたみ可能で
  邪魔にならない添削（英語での解説と、正しい日本語表現つき）を、練習中の
  文体に照らして提示します。文法添削は後で見返せるよう保存可能です。
- **音声機能** — 発話を音声認識（faster-whisperによるSTT）でテキスト化し、
  返信は音声合成（VOICEVOXによるTTS）で読み上げ。いずれもオプションで、
  テキスト入力は常に利用可能です。
- 日本語の可読性を重視した、ダークで洗練されたミニマルUI（Noto Sans JP使用）。
- クリーンなLLM**プロバイダー抽象化層** — Ollama（ローカル、デフォルト）と
  Anthropic（クラウド、オプトイン）の両方に対応。切り替えは環境変数1つの
  変更のみで完了します。

## 技術スタック

- **フロントエンド:** React + Vite + TypeScript + Tailwind CSS v4（Vitestでテスト）
- **バックエンド:** Python + FastAPI（[uv](https://docs.astral.sh/uv/) で管理、
  pytestでテスト）
- **LLM:** Ollama（ローカル、デフォルト）— `gemma3:27b`。Anthropic API
  （クラウド、オプトイン）— `claude-sonnet-4-6`。
- **日本語処理:** [SudachiPy](https://github.com/WorksApplications/SudachiPy)
  （形態素解析・ふりがな生成）、[JMdict](https://github.com/scriptin/jmdict-simplified)
  + KANJIDIC2（辞書データ）をローカルSQLiteファイルにコンパイル。
- **音声:** [faster-whisper](https://github.com/SYSTRAN/faster-whisper)（STT）、
  [VOICEVOX](https://voicevox.hiroshiba.jp/)（TTS）。

## 事前準備

以下のツールをインストールし、PATHに追加してください。

| ツール | 用途 | 備考 |
|------|--------------|-------|
| [Node.js](https://nodejs.org) 20+ | 全体 | フロントエンド |
| [Python](https://www.python.org) 3.12+ | 全体 | バックエンド |
| [uv](https://docs.astral.sh/uv/) | 全体 | Python環境・依存関係管理 |
| [Ollama](https://ollama.com) | 全体 | ローカルで起動しておく |
| [VOICEVOX](https://voicevox.hiroshiba.jp/) | 音声出力（任意） | ローカルTTSエンジン（`:50021`） |
| [ffmpeg](https://ffmpeg.org/) | 音声入力（任意） | ブラウザ音声をSTT用にデコード |

会話モデルを取得（初回のみ）:

```powershell
ollama pull gemma3:27b
```

> **モデル選定について。** `gemma3:27b` をデフォルトとしているのは、日本語を
> 安定して維持できるためです。`qwen2.5:32b` も日本語性能は優れていますが、
> 会話の途中で中国語に切り替わることがあるため、デフォルトには採用していません。
> 別のモデルを試す場合は、そのモデルを取得し `KAIWA_OLLAMA_MODEL` を設定して
> ください（詳細は「設定」を参照）。

## セットアップ

リポジトリのルートから（PowerShell）:

```powershell
# 依存関係のインストールと読み補助辞書のビルドを同時に実行
npm run setup
```

`npm run setup` はJMdictとKANJIDIC2もダウンロードし、
`backend/data/dictionary.sqlite` にコンパイルします（初回のみ数百MBの
ダウンロードが発生し、このファイルはgit管理対象外です）。後で再ビルドする
場合（例: 辞書の新バージョンへの更新時）は `npm run setup:dict` を実行して
ください。このファイルがなくてもアプリは動作しますが、ホバー辞書機能は
辞書ファイルが生成されるまで空の状態になります。

必要に応じて、サンプルファイルから環境変数ファイルを作成しデフォルト値を
上書きできます:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
```

## 起動方法

バックエンドとフロントエンドを同時に起動:

```powershell
npm run dev
```

- フロントエンド: http://localhost:5173
- バックエンド: http://localhost:8000（ヘルスチェック: `/api/health`）

事前にOllamaを起動し、設定したモデルを取得済みであることを確認してください。
音声出力を使う場合はVOICEVOXも起動してください（未起動でもTTSボタンは
問題なく無効化されます）。

個別に起動する場合: `npm run dev:backend` と `npm run dev:frontend`。

## テスト

固定しておく価値が高い部分を単体テストでカバーしています: システムプロンプト
の合成処理、ふりがな位置合わせのヒューリスティック、フィードバック/シナリオ
エンドポイントにおける防御的JSONパース、型付きAPIクライアント、会話フックの
フィードバック/返信並列処理。いずれも実際のモデル、VOICEVOX、コンパイル済み
辞書を必要としません。

```powershell
npm test            # フロントエンド（Vitest）+ バックエンド（pytest）
npm run test:frontend
npm run test:backend
```

## 設定

バックエンドの設定は `backend/.env`（プレフィックス `KAIWA_`）から読み込まれ
ます。デフォルト値のままで動作しますが、全項目は `backend/.env.example` を
参照してください。主な変更可能項目:

| 変数名 | デフォルト | 用途 |
|----------|---------|---------|
| `KAIWA_LLM_PROVIDER` | `ollama` | `ollama` または `anthropic` |
| `KAIWA_OLLAMA_MODEL` | `gemma3:27b` | 返信生成に使うOllamaモデル |
| `KAIWA_OLLAMA_BASE_URL` | `http://localhost:11434` | OllamaサーバーURL |
| `KAIWA_ANTHROPIC_API_KEY` | *(未設定)* | Anthropic APIキー（プロバイダーが`anthropic`の場合必須） |
| `KAIWA_ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Anthropicのモデル |
| `KAIWA_TEMPERATURE` | `0.7` | サンプリング温度（Ollamaのみ） |
| `KAIWA_TRANSLATION_TEMPERATURE` | `0.3` | 翻訳処理の温度（Ollamaのみ） |
| `KAIWA_FEEDBACK_TEMPERATURE` | `0.3` | フィードバック処理の温度（Ollamaのみ） |
| `KAIWA_DICTIONARY_PATH` | `data/dictionary.sqlite` | コンパイル済みJMdict + KANJIDIC2データベース |
| `KAIWA_CORS_ORIGINS` | `http://localhost:5173` | 許可するフロントエンドオリジン |
| `KAIWA_RATE_LIMIT` | *(未設定)* | IPごとの制限（例: `30/minute,500/hour`。空欄で無効） |
| `KAIWA_TTS_PROVIDER` | `voicevox` | `voicevox`（ローカル）または `google`（クラウド） |
| `KAIWA_STT_PROVIDER` | `whisper` | `whisper`（ローカル）または `google`（クラウド） |
| `KAIWA_GOOGLE_CLOUD_API_KEY` | *(未設定)* | Googleキー（音声プロバイダーが`google`の場合必須） |
| `KAIWA_GOOGLE_TTS_VOICE` | `ja-JP-Neural2-B` | Google Cloud TTSの音声 |
| `KAIWA_VOICEVOX_BASE_URL` | `http://localhost:50021` | VOICEVOXのローカルHTTP API |
| `KAIWA_VOICEVOX_SPEAKER` | `2` | VOICEVOXの話者ID |
| `KAIWA_WHISPER_MODEL` | `base` | faster-whisperのモデルサイズ |
| `KAIWA_WHISPER_DEVICE` | `cuda` | faster-whisperのデバイス（`cuda` または `cpu`） |

フロントエンド（`frontend/.env.local`）: `VITE_API_BASE_URL`（デフォルト
`http://localhost:8000`）と `VITE_STORAGE`（デフォルト `backend`、ブラウザの
localStorageを使う場合は `local`）。

### Anthropicへの切り替え

1. オプション依存関係をインストール: `uv sync --extra anthropic`（`backend/` から実行）
2. `backend/.env` に追記:
   ```
   KAIWA_LLM_PROVIDER=anthropic
   KAIWA_ANTHROPIC_API_KEY=sk-ant-...
   ```
3. 通常どおり `npm run dev` を実行 — 他の変更は不要です。

現在有効なプロバイダーとモデルはヘッダーおよび設定パネルに表示されます。
Ollamaに戻す場合は、上記2行を削除（またはコメントアウト）してください。

## ライブデモのデプロイ（クラウド）

Kaiwaはローカル完結型が基本ですが、クラウド版は各機能を設定でホスト型
プロバイダーに切り替えただけの同一アプリです — コードベースは分岐しません。
ローカル用のデフォルト設定はそのまま維持されます。

| 機能 | ローカル（デフォルト） | クラウド |
|-----------|-----------------|-------|
| LLM | Ollama | Anthropic（`KAIWA_LLM_PROVIDER=anthropic`） |
| TTS | VOICEVOX | Google Cloud（`KAIWA_TTS_PROVIDER=google`） |
| STT | faster-whisper | Google Cloud（`KAIWA_STT_PROVIDER=google`） |
| 保存データ | `/api/store` ドキュメントストア | ブラウザのlocalStorage（`VITE_STORAGE=local`） |

> クラウドTTSは音声再生はできますが、単語単位のハイライトはできません
> （Googleはモーラ単位のタイミング情報を返さないため）。カラオケ風の
> ハイライト表示はローカルVOICEVOX限定の機能です。

**バックエンド → Google Cloud Run。** コンテナ（[`backend/Dockerfile`](backend/Dockerfile)、
読み補助辞書はビルド時に組み込み済み）をCloud Runにデプロイします —
サーバーレスで、アイドル時はゼロスケールし、デモ規模のトラフィックであれば
無料です。GCPプロジェクトでの初回セットアップ（TTS/STTキーと同じ
プロジェクトで問題ありません）:

1. 各APIを有効化: Cloud Run、Cloud Build、Secret Manager、
   Text-to-Speech、Speech-to-Text。
2. シークレットをSecret Managerに `kaiwa-anthropic-api-key` と
   `kaiwa-google-cloud-api-key` として保存し、Cloud Runの実行サービス
   アカウントに *Secret Manager のシークレット アクセサー* ロールを
   付与します。
3. Google APIキーをText-to-SpeechとSpeech-to-Text APIのみに制限し
   （認証情報 → キー → API制限）、予算アラートを設定します。
   Anthropicコンソール側でも利用上限を設定してください。

デプロイ（および更新時の再デプロイ）は
[`backend/scripts/deploy_cloudrun.ps1`](backend/scripts/deploy_cloudrun.ps1)
で行います:

```powershell
.\backend\scripts\deploy_cloudrun.ps1 -ProjectId <gcp-project> -CorsOrigin https://<your-app>.vercel.app
```

このスクリプトは `gcloud run deploy --source backend` を、クラウド
プロバイダー用の環境変数、シークレットのマウント、`KAIWA_RATE_LIMIT`、
インスタンス数上限2でラップしたものです。

**フロントエンド → Vercel。** プロジェクトルートを `frontend/` に設定し
（[`frontend/vercel.json`](frontend/vercel.json) がビルドとSPAリライトを
処理します）、Vercelダッシュボード（Settings → Environment Variables →
Production）で以下を設定します:

| 変数名 | 値 |
|---|---|
| `VITE_API_BASE_URL` | Cloud RunサービスのURL（例: `https://kaiwa-api-xxxx.a.run.app`） |
| `VITE_STORAGE` | `local` |
| `VITE_ALLOW_CUSTOM_SCENARIOS` | `false` |

`VITE_ALLOW_CUSTOM_SCENARIOS=false` は「シナリオを自作する」フォームを
非表示にします。このフォームは自由記述のメモ欄を通じてシステムプロンプトに
任意の指示を注入できるため、ローカル利用では問題ありませんが、共有デプロイ
環境では望ましくありません。フリートーク・シナリオ・自動生成シナリオの
各モードには影響しません。

## スクリプト一覧

| コマンド（リポジトリルート） | 内容 |
|---------------------|------|
| `npm run setup` | 全依存関係のインストール + 辞書のビルド |
| `npm run setup:dict` | 読み補助辞書のみ（再）ビルド |
| `npm run dev` | バックエンド + フロントエンドを起動 |
| `npm run build` | フロントエンドをビルド |
| `npm test` | フロントエンド + バックエンドのテストを実行 |
| `npm run lint` | フロントエンド（ESLint）+ バックエンド（ruff）をLint |
| `npm run format` | フロントエンド（Prettier）+ バックエンド（ruff）をフォーマット |

バックエンドのモデルA/B比較ハーネス（日本語再現性の観点でモデルを比較）:

```powershell
uv run --directory backend python scripts/eval_models.py
```

## 既知の制約事項（v1.0）

- 非常に長いセッションでは、いずれモデルのコンテキストウィンドウに近づきます。
  現状は毎ターン全履歴を送信しており、要約処理は未実装です（v1.0では許容
  範囲としています）。
- 会話**途中**での文体（レジスター）変更は次の返信のトーンに反映されますが、
  モデルはそれまでの会話の文体も尊重するため、変化が緩やかになる場合が
  あります。
- フィードバックと自動生成シナリオの品質はローカルモデルの判断精度に
  依存します。レスポンスの*形式*は強制されますが、言語的な判断の正確さ
  までは保証されません。

## プロジェクト構成

ディレクトリ構成とエンジニアリング規約は [`CLAUDE.md`](CLAUDE.md)、
プロダクト全体の構想とフェーズ計画は `PROJECT_BRIEF.md` を参照してください。

## ライセンス

[MIT](LICENSE) © 2026 Luke Lakea.
