# Supabase認証と学習履歴保存

アプリ側の認証・クラウド保存処理を実装済みです。**2026-11-18にURL・公開キーの設定とAuthサービスへの疎通を確認しました。ユーザーによる一括SQLの実行成功後、実DBの5テーブルと学習データ取得関数の存在・匿名アクセス拒否を公開APIで確認しています。本人の報告・画像で登録・メール確認・ログイン、1レッスン3/3の表示と再ログイン後の履歴保持も確認済みです。実アカウント間のデータ分離と端末間同期は未確認です。** 接続設定が空の場合は、従来のゲスト学習を継続できます。

## 実装済みの動作

- 英語・ロシア語の登録、ログイン、ログアウト、メール確認、パスワード再設定。
- 公式`@supabase/ssr`によるサーバー側Cookie管理。認可には`getUser()`を使い、ローカルのログインフラグや未検証の`getSession()`を信頼しません。
- Proxyでのセッション更新とキャッシュ抑止。本番CookieはHttpOnly・Secure・SameSite=Laxです。
- プロフィールの日次目標・表示言語、学習履歴、復習キューのユーザー単位保存。
- 認証済みリクエストのユーザーIDでRLSを適用。リクエスト本文から所有者を選択できません。
- 送信された生の回答をDB内の固定正解データで採点。クライアントの`correct`フラグから履歴を作成しません。
- 採点・履歴作成・復習更新は1トランザクション。同じセッションIDの再送は重複登録しません。
- 失敗時は保存済みと表示せず、同じIDで再試行できます。キューに入ったリクエストはアカウント変更を検出して拒否します。
- ゲストの履歴はブラウザ内に残し、アカウントへ自動移行しません。クラウドの履歴はlocalStorageに保存しません。

## テーブルと権限

| テーブル | 保存対象 | authenticatedからの直接アクセス |
| --- | --- | --- |
| profiles | 表示言語・日次目標 | 自分の行の読取、言語・目標列のみ更新 |
| practice_sessions | レッスンID・完了日時・所要時間 | 自分の行の読取のみ |
| practice_answers | 生の回答・DBでの判定結果 | 自分の行の読取のみ |
| review_cards | 復習間隔・次回日時 | 自分の行の読取のみ |
| entitlements | サーバーで検証するプランと有効期限 | 自分の行の読取のみ |
| private.question_bank / lesson_questions | 固定正解とレッスン内の問題 | 直接アクセス不可 |

学習結果の更新は`submit_practice`、リセットは`reset_learning_progress`を通じて本人に限定します。これらは権限を限定した関数で、内部で`auth.uid()`を確認します。課金権限を変更する関数は公開していません。

## 接続手順

1. Supabaseプラグインを追加してアカウントへ接続し、対象の開発用プロジェクトを特定します。手動で設定する場合はSupabase管理画面を使います。
2. 以下のマイグレーションを順番に適用します。既に初期スキーマを適用したプロジェクトでは1本目を再実行せず、未適用のものだけを適用します。既存テーブルがある場合は先に内容を確認します。

   - `migrations/202611170001_initial_schema.sql`：テーブル・RLS・登録トリガー。
   - `migrations/202611170002_learning_functions.sql`：DB側採点・読込・リセット関数。
   - `migrations/202611170003_question_bank.sql`：固定100問と診断用の対応データ。
   - `migrations/202611180001_curriculum_n5_n3.sql`：N5〜N3の追加教材の正解データ（`npm run content`で自動生成）。**既存プロジェクトでは、これを1回実行しないと、ログイン中の利用者は追加レッスンの結果を保存できません。**

3. プロジェクトのConnect画面からProject URLとPublishable keyを取得し、アプリの`.env.local`に設定します。

   ```dotenv
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
   ```

   管理者用のsecret key・service_role key・DBパスワードはアプリに不要です。公開キー欄へのsecret key・service_role keyはコードで拒否します。

   `NEXT_PUBLIC_APP_URL`にはブラウザでアクセスする公開URLを設定します。CSRF対策はこのoriginとの一致を検証するため、本番URLや開発ポートを変えた場合はこの値も更新してください。サーバーの待受アドレス`0.0.0.0`や未検証の転送ヘッダーは許可originの根拠にしません。

4. Supabase Authのメール／パスワード認証とメール確認を有効にします。Site URLを`http://localhost:3000`へ設定し、ローカル開発の許可リダイレクト先に`http://localhost:3000/**`を追加します。本番では実際のHTTPSのURLに変更し、必要なコールバックURLに限定します。
5. 開発サーバーを再起動します。本番環境の`NEXT_PUBLIC_*`変更後は再ビルド・再デプロイします。
6. `/en/register`または`/ru/register`で、受信を確認できる自分のメールアドレスを使って動作を確認します。

### プラグインからプロジェクトを取得できない場合

新規・空の開発用プロジェクトでは、管理画面のSQL Editorへ[`setup.sql`](setup.sql)の全文を貼り付けて実行する方法も使えます。このファイルは上記のマイグレーションを1トランザクションへまとめたもので、ローカルPostgreSQLで適用できることを確認しています。既に同名のテーブルなどがある場合はエラーでロールバックします。既存スキーマや適用済みマイグレーションがあるプロジェクトでは、未適用のマイグレーションだけを使ってください。

アプリの接続にはProject URLとPublishable keyが必要です。`.env.local`の対応する2行を設定して開発サーバーを再起動します。プラグインを追加しただけでは、このファイルへURL・キーは自動設定されません。

### メール確認とパスワード再設定

標準のPKCEフローでは、登録時と同じブラウザでメールのリンクを開いてください。`/auth/callback`がコードをセッションへ交換します。

使用中の公式SDKには、メール申請ごとにPKCEの検証情報を分ける機能があります。サーバークライアントで`auth.experimental.appendPkceFlowIdToRedirects`を有効にし、SDKが付ける`sb_flow_id`をコールバックで検証して`exchangeCodeForSession`へ渡します。これにより、新しい申請が429で失敗しても、修正後に発行した先のメールに対応する検証情報を選べます。既に失われた古い検証情報が復元されるものではありません。

このオプションはSDK上experimentalであるため、依存更新時には`tests/supabase-session.test.ts`を確認してください。通常の`npm ci`はロックファイルの検証済みバージョンを使用します。ローカルの許可URL`http://localhost:3000/**`は追加パラメータにも対応します。本番の許可リダイレクトを限定する場合、生成されるlocale・recovery・sb_flow_idを含むコールバックを検証してください。フローIDのない従来のリンクも既存方式で処理します。

登録APIがメール確認待ちを返すと、アプリは`/en/verify-email`または`/ru/verify-email`へ移動します。認証コールバックの成功時は`NEXT_PUBLIC_APP_URL`の学習ホームへ移動します。内部の待受URLや任意の`next`パラメータへはリダイレクトしません。

確認待ち画面は`GET /api/auth/status`でSupabaseの`getUser()`による認証状態だけを確認します。トークン・メール・学習履歴は返さず、レスポンスはno-storeです。表示中は10秒間隔とフォーカス復帰時に確認し、15分後に自動確認を停止します。手動確認ボタンは引き続き使えます。別のブラウザ・端末で確認した場合は、その端末に元のブラウザのセッションは共有されないため、元の画面からログインしてください。

別のブラウザで確認できるトークン方式を使う場合は、メールテンプレートを以下のコールバックへ変更します。`SiteURL`は自分の信頼できるアプリURLに固定してください。

- 登録確認：`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
- パスワード再設定：`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

`locale=ru`を付けるとロシア語の画面へ戻ります。未指定時は英語です。任意の外部`next` URLは受け付けません。

Supabase標準のメール配信は、原則としてプロジェクトのチームに属するアドレスに制限されます。[公式SMTP案内](https://supabase.com/docs/guides/auth/auth-smtp)を確認してください。実際の利用者へ公開する前に、配信可能なSMTP設定・確認メールの到達・失効したリンクの動作を検証します。

## 動作確認の手順

1. ユーザーAを登録→メール確認→ログイン→レッスン完了。
2. 別のブラウザからAでログインし、同じ履歴が表示されることを確認。
3. 表示言語・日次目標を変更して保存、再読み込み。
4. AからログアウトしBでログイン。Aの履歴が表示されないことを確認。
5. Aのタブを開いたまま別タブでBに切り替え、Aの操作がBへ誤保存されないことを確認。
6. 保存中に通信を切り、完了扱いにならないことを確認。再接続して再送し、履歴が1件だけであることを確認。
7. Aの進捗リセットがBの履歴・アカウント・課金権限へ影響しないことを確認。
8. パスワード再設定、期限切れセッション、無効なメールリンクを確認。

## 外部接続なしの検証

```bash
npm run check
npm test -- tests/database.test.ts
npm test -- tests/auth-api.test.ts tests/auth-cookies.test.ts tests/supabase-session.test.ts tests/account-ui.test.tsx
npm run test:e2e
```

- `database.test.ts`はPGliteの実PostgreSQLエンジンで全マイグレーションを適用し、RLS、列権限、複合外部キー、採点、間隔反復、重複防止、本人だけのリセット、日次上限を確認します。
- Auth APIとUIは外部認証をモックにして確認します。公式SDKのCookie保存・次のリクエストでの確認・ログアウトも、Auth HTTPをスタブにして検証します。
- PGliteではSupabaseの`auth.users`と`auth.uid()`をテスト用に用意します。ホストされたSupabaseのJWT設定や実メール配信を検証したことにはなりません。
- 教材変更時はDB側の正解・対応表も新しいマイグレーションで更新します。アプリとseedが違うとDBテストが失敗します。

## 実接続の検証

起動中のアプリと`.env.local`に指定した実Supabaseへ`npm run test:live`で接続確認できます。16項目の実接続チェックが成功しています。このテストは変更を伴わず、実アカウントでの保存や同期を検証したものではありません。本人が行う操作と進捗は[実アカウント確認手順](../docs/live-verification.md)にまとめています。

本人の操作で、登録・メール確認・再ログイン後の履歴保持に加え、別のログイン環境でも同じ3/3が表示されることを確認しました。

DB内のアカウント分離・採点・リセットは[`verify.sql`](verify.sql)の全文をSQL Editorで実行して確認できます。postgresから一時ユーザーを作り、authenticatedロールへ切り替えて検証し、最後に全テストデータをロールバックします。ローカルで動作と異常検出を確認済みですが、実DBでは未実行です。初期セットアップの再実行や、本物のユーザーの履歴リセットは不要です。詳細は[確認手順](../docs/live-verification.md#メールを増やさずdbの分離を確認する)を参照してください。

## 制限と運用

- 学習履歴は最大1,000セッションを保持します。日次の学習保存上限はアカウントごとに200件、DB側で管理します。
- Auth APIのアプリ内制限は登録・パスワード再設定が各3回／分、ログイン等が各15回／分。進捗APIはユーザーごとに120回／分です。これらの短期制限はプロセス単位で、分散環境の全体上限ではありません。
- アプリ内制限の429には残り秒数と`Retry-After`を付けます。Supabaseの429はメール制限`email_rate_limit`とその他の制限`auth_provider_rate_limit`を区別し、解除時刻は推測しません。再設定画面の60秒待機は連続送信を抑えるもので、上流の時間単位上限の解除を保証しません。送信の自動再試行はありません。[429確認手順](../docs/live-verification.md#再設定メールの429)を参照してください。
- 本番ではSupabase Auth側のレート制限・必要なCAPTCHA・メール設定も構成します。AI質問・課金機能の上限とは別です。
- 設定した目標や学習履歴はアカウントへ保存します。表示言語のURLと端末のロケールCookieが、その画面の表示言語を決めます。
- 所要時間はクライアント申告を0〜3,600秒に制限した値です。試験の本人性や実学習時間を証明するものではありません。
- 初期スキーマにはユーザー削除時のcascadeを設定していますが、アプリ内のアカウント削除画面は未実装です。進捗リセットはアカウントを削除しません。

参照：[Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)、[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[リダイレクトURL](https://supabase.com/docs/guides/auth/redirect-urls)、[SMTP](https://supabase.com/docs/guides/auth/auth-smtp)。
