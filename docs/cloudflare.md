# Cloudflare Workersへの公開準備

2026-11-18、公開先としてCloudflareを選択しました。ユーザーはアカウント登録とWrangler認証を完了し、**「Cloudflareは無料枠のみ、勝手に課金しない」**と明示しました。有料プラン変更・支払方法登録・有料サービス追加は行いません。無料枠で動かせない場合は停止して結果を報告します。2026-11-18に本人のターミナルから初回公開しました（下の「現在の状況」を参照）。

初回の認証権限ではWorker一覧の取得は成功しましたが、公開用サブドメインの取得は権限不足でした。`workers_scripts:write`と`workers_routes:write`を指定した追加認証を開始しています。契約情報を読むBilling権限は今回のWrangler認証に含められないため、Workers Free（$0）の表示確認は本人へ依頼中です。`default_usage_model=standard`というAPI応答はプランが無料かどうかの判定には使いません。無料プラン確認と必要な認証が完了するまで公開を実行しません。

## 実装した構成

- Next.js 16.4.6を維持し、OpenNext 1.20.17とWrangler 4.164.0でWorkers用にビルドします。追加パッケージはバージョン固定、npmのロックファイルを更新しています。
- `wrangler.json`にWorker、静的アセット、自己参照、認証・進捗用のレート制限を設定しました。R2・D1・KV・Imagesを追加作成する設定はありません。DB・認証は現在のSupabaseを継続します。
- 認証の制限キーはCloudflareが設定する`CF-Connecting-IP`と操作名をハッシュ化します。通常の開発サーバーではCloudflareのヘッダーを信用しません。進捗APIはサーバーで確認したユーザーIDを使います。
- WorkersではネイティブのRate Limiting bindingを利用し、bindingの欠落・障害時にインメモリ制限へ退避しません。制限はCloudflare拠点ごとに概算で適用され、世界全体での厳密な予算上限ではありません。DB側の日次演習上限は継続します。
- アカウント関連APIと動的ページは既存の非共有キャッシュ設定を維持します。長期キャッシュは`/_next/static/*`のみです。認証コールバックは`no-referrer`です。
- Workersログの常時収集を設定で無効にしています。認証リンクのURLやトークンを保存しないよう、ログ設定を変更するときは内容も確認してください。

## ローカル検証

Node.js **22.22.2以上**とnpmを使用します。既存の`.env.local`は上書きしません。

```bash
npm ci
npm run check

# メールの戻り先・CSRF・メタデータを検証用ポートに合わせてビルド
NEXT_PUBLIC_APP_URL=http://127.0.0.1:8787 npm run build:cloudflare
npm run check:cloudflare
npm run preview:cloudflare
```

別ターミナルで次を実行します。

```bash
npx playwright install chromium
npm run test:e2e:cloudflare
```

表示先は`http://127.0.0.1:8787/en`または`/ru`です。`preview:cloudflare`はローカル実行で、公開ではありません。`check:cloudflare`はアップロードしないdry-runです。通常の開発は今までどおり`npm run dev`で行えます。

`.env.cloudflare.local`が存在するとCloudflareコマンドはそちらを優先します。ローカル検証にはこのファイルを置かず、実公開の準備時に作成してください。既に実公開用ファイルがある場合は、別の作業コピーでローカル検証してください。

## 初回公開に必要なアカウント操作

1. [Cloudflare Dashboard](https://dash.cloudflare.com/sign-up)で無料アカウントを作り、メールを確認します。Workers Freeのまま進め、有料プラン・ドメイン購入・R2追加は行いません。
2. `npx wrangler login --device --browser=false --scopes account:read user:read workers_scripts:write workers_routes:write`で認証を開始します。CLIが表示する公式URLを自分のブラウザで開き、短いコードを入力して承認します。コードは5分で期限切れになります。APIトークンやパスワードをチャットに貼る必要はありません。デバイス方式はlocalhostへの接続が不要なので、WSLやリモート環境でも使えます。認証後は`npx wrangler whoami`で接続を確認します。契約変更の権限は要求しません。DashboardのWorkersのプランがFree（$0）であることも確認してから公開します。
3. DashboardのWorkers & Pagesで自分の`workers.dev`サブドメインを確認・設定します。Worker名は`nyantan-nihongo`なので、公開先は`https://nyantan-nihongo.<自分のサブドメイン>.workers.dev`です。
4. `.env.cloudflare.example`を`.env.cloudflare.local`へコピーします。`NEXT_PUBLIC_APP_URL`に上の実URL、Supabaseの2項目には既存の`.env.local`と同じ公開設定を入れます。`BILLING_ENABLED=false`を維持し、秘密鍵・service_roleは使用しません。
5. SupabaseのAuthentication → URL Configurationで、Site URLを実公開URLへ設定します。Redirect URLsには実ドメインの`/auth/callback**`と`/auth/confirm**`を許可します。別のドメインを許可する広いワイルドカードは使いません。ローカル開発の許可URLは別に残せます。独自メールテンプレートの`SiteURL`も実公開先と一致させます。
6. `npm run deploy:cloudflare`を実行します。localhostや未設定URLではビルド・公開を開始せずに停止します。公開用URLで再ビルドし、同じURLをWorkerの環境変数にも設定します。Dashboardで管理する他の変数は`--keep-vars`で保持します。

公開前に既存の同名Workerがあれば内容を確認してください。アカウント登録完了・CLI認証待ちの現段階では、こちらから作成・上書きは行っていません。

## サイト名とURLの変更（2026-11-25）

サイト名を「Nyantan Nihongo」に、Worker名を`nihongo-ai`から`nyantan-nihongo`に変えました。次回の`npm run deploy:cloudflare`で新しいWorkerとして作られ、公開先は https://nyantan-nihongo.nihongo-jp.workers.dev になります。workers.dev のサブドメインも、メールアドレスに近い`fifatvgame`から`nihongo-jp`に変えます（Dashboard の Workers & Pages → Account details → Subdomain。無料。アカウントの全 Worker の URL が変わります）。

- 古いWorker（`nihongo-ai`）は自動では消えません。新しいURLで動作を確かめた後、Dashboardから削除してください（無料枠のまま、残しておいても費用はかかりません）。
- SupabaseのAuthentication → URL Configurationで、Site URLを新しいURLに変え、Redirect URLsに新しいURLの`/auth/callback**`と`/auth/confirm**`を追加してください。これをしないと、新しいURLで登録確認・パスワード再設定のメールのリンクが使えません。
- ゲストの学習記録はブラウザのURLごとに保存されるため、古いURLで記録したゲストの記録は新しいURLには引き継がれません。ログインして保存した記録はそのまま使えます。

## 以前の状況（2026-11-19）

- **公開先**: https://nihongo-ai.fifatvgame.workers.dev（Version 479e9baa-920e-468b、Workers Free）。初回は「No access to the specified resource」で失敗し、`npx wrangler logout` → `npx wrangler login --device --browser=false` で再認証して成功しました。
- **ページ途中停止（解決済み）**: 公開直後の確認では、SSRの本文が約20KBで途切れたように見えました。2026-11-19に再確認したところ、全画面が200で`</html>`まで届き、本人のブラウザでも表示・回答・ログイン保存に問題はありませんでした。静的アセット（Workerを通らない）の取得も遅かったため、原因は公開直後の反映待ちと、検証環境（WSL）の回線の遅さと判断しました。
- **調査の制約**: WSLからは`wrangler tail`が「fetch failed」になります。CPU超過などを疑うときは、ダッシュボードの「Workers & Pages → nyantan-nihongo → Metrics」で確認してください。
- **Workerの軽量化（2026-11-20）**: 教材本文（N5〜N3、約3.9MB）を`public/content/`の静的ファイルに移し、ブラウザが必要なときに取得する方式にしました。Workerはgzip 2,924KiB → 2,157KiB（無料枠の上限3MiB）になりました。漢字の書き順・使用例も`public/kanji/`の静的ファイルで、Workerの容量に含まれません。残りの大部分はNext.js・Reactなどのフレームワーク本体です。
- **初回表示の軽量化（2026-11-22）**: 全画面を1つのルート（`[[...view]]`）で描画していたため、どのページでも全画面分のJSを読み込んでいました。画面ごとのルートに分け、教材カタログも並び順から番号・問題IDを復元する形に縮めました（284KB→196KB、gzip 67KB→47KB）。ページごとのJS（gzip）は全ページ334KB→282〜305KBです。残りの大半はReact・Next.js本体です。
- **公開待ちの変更**: 選択問題の1クリック判定。コミット済みで、まだデプロイしていません（効果音とエアロ風テーマは試した後に削除しました）。
- **デプロイの方法**: 本人のターミナルで `npm run deploy:cloudflare` を実行します。Claudeは実行しません。

## 公開前チェック（2026-11-22）

- 型チェック・Lint・Vitest **117件成功**。教材・漢字・例文の生成物は元データから再生成しても差分なし。
- 本番の依存パッケージに既知の脆弱性なし（`npm audit --omit=dev`）。開発用のOpenNext内部（glob/minimatch）に中程度3件あり、ビルド時のみ使用で公開物には含まれない。
- **セキュリティヘッダーを追加**: 本番ビルドでContent-Security-Policy（外部への接続・外部スクリプトを禁止、`frame-ancestors 'none'`）。Workerを通らない静的ファイル（教材JSON・漢字データ）にも`public/_headers`でnosniff・DENY・Referrer-Policyを付与。開発サーバーでは自動更新のためCSPを付けない。
- 公開用設定を読まない別コピーでOpenNextビルド成功。Wrangler dry-runでWorker **gzip 2,162KiB**（上限3,072KiB）、アセット638ファイル。
- workerdのローカル実行でPC・モバイルのPlaywright **57件成功**（PC不要のモバイル専用1件除外）。主要12画面と、レッスン・例文・漢字の操作でCSP違反・コンソールエラーなし。
- サーバー側（認証・進捗API）は前回公開から変更なし。同一オリジン検査・サイズ制限・レート制限（Cloudflare binding、障害時は拒否）を再確認。

## 確認済みの範囲と残作業

- 型チェック・Lint・Vitest **98件成功**。通常テストで実接続チェック16件は明示的に除外しています。
- 別実行の非変更型接続チェック **16件成功**。WorkersローカルのAPIと既存Supabaseの公開Auth設定、テーブル/RPCの匿名アクセス拒否を確認しました。アカウント作成・メール送信・学習データ変更は行っていません。
- OpenNextの本番ビルド成功。Wrangler dry-run成功、アセット524ファイル、Worker約9.2MiB（gzip約1.93MiB）。アップロードは行っていません。
- 実際のworkerdによるローカル実行で、PC・モバイルのPlaywright **43件成功、PCで不要なモバイル専用1件除外**。学習・復習・英露切替・履歴保持、APIの入力検証・CSRF・匿名アクセス拒否、認証の戻り先を確認しました。登録・メール送信・ログイン状態の画面遷移はモックを使い、実メール送信は行っていません。
- `deploy:cloudflare`がlocalhost設定で停止し、公開処理を開始しないことを確認しました。Supabaseの公開設定が空の場合も停止します。
- ローカル実行とdry-runでは、公開先のCPU上限・負荷・起動時間・可用性までは保証できません。Freeの1要求あたりCPU上限は10msなので、少人数でもSSR処理が制限を超える可能性があります。アカウント作成後、無料枠での実公開と実測が必要です。失敗しても有料プランへ自動で変更しません。
- 言語判定・認証Cookie更新は`src/middleware.ts`（Edge実行）です。Next.js 16の新名`proxy.ts`はNode.js実行に固定され、OpenNextでは実験的対応のため、正式対応のEdgeで動く旧名を使っています（ビルド時に「名前が非推奨」の通知が出ますが動作上の問題はありません）。更新時もCloudflare向けテストを実行してください。
- 実公開後のメール確認・再設定、既存アカウントの履歴表示、実DBのアカウント分離確認、一般向けメール配信、教材校閲は残っています。完了済みのローカル認証・別ブラウザ同期と区別します。

## 公式資料

- [OpenNext既存プロジェクトの設定](https://opennext.js.org/cloudflare/get-started)
- [OpenNext環境変数](https://opennext.js.org/cloudflare/howtos/env-vars)
- [Next.js機能の対応状況](https://opennext.js.org/cloudflare)
- [Workers料金](https://developers.cloudflare.com/workers/platform/pricing/)
- [Wranglerのデバイス認証](https://developers.cloudflare.com/workers/wrangler/commands/general/)
- [Workers制限](https://developers.cloudflare.com/workers/platform/limits/)
- [Rate Limiting APIの範囲・精度](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
