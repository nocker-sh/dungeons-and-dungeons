# 開発と検証

## 起動と依存

```sh
vp install
portless dnd vp run dev
```

開発URLは `https://dnd.localhost`。依存は[[pnpm-lock.yaml]]で固定し、CIは `vp install --frozen-lockfile` を使う。CLIは `vp run cli`、直接実行は `vp exec bun <file>`。CLIのimportは `@/` から定義元を参照する。

## 責務と依存

- [[lib/wiz|エンジン]]はReact・DOM・保存先・作品データへ依存しない。ユースケースが操作、Queryが表示値と操作可否を所有し、互いに規則を複製しない。
- [[content|作品ルール]]は数値・ワザ・台本と組み立て、[[concept/data|表示データ]]は名前・紹介・台詞・画像参照を所有する。設定本文は[[concept/README|設定資料の方針]]に従い、配信データから参照しない。
- [[development|開発支援]]は場面準備・測定を扱う。画面の公開URLとソースの配置を混同しない。
- 乱数・時計・ID・保存先はDIする。見た目の乱数をゲームの抽選へ流用しない。
- 外部のエンジン複製元を直接変更しない。複製側を変更したら既存試験とprovenanceの理由・ローカルハッシュを保つ。

## 保存の境界

保存の構成は規則の版と保存形式の版で判断する。表示名や数値を変更しただけで既存保存を拒否しない。一方、保存が指すIDが現行データにあるかを検証し、消えたIDを別の対象へ読み替えない。

読み込めない保存は上書きしない。失敗した操作で資産・報酬を変更せず、保存削除はプレイヤーが明示して選んだときだけ行う。名前・ワザ・品物の説明は正本から引き、変化する能力・HP・経験値だけを保存する。

Reactはエンジンの状態を複製しない。起動、復元、購読、自動保存には寿命を持たせ、画面を離れた後の遅い完了を新しいセッションへ適用しない。

## 画面と場面確認

ゲームはCanvas部品、style属性、motion/reactで描画する。Canvas部品はページ側のCSSから分離する。ゲーム画面へCSSファイルを追加しない。

場面確認は `/previews/{slug}`、動きを止める場合は `?still`。条件・仮想時計・操作の再現は[[dev-studio]]、演出の寿命と遷移は[[animation-rules]]を参照する。戦闘ではエンジンの1行動分の出来事に対応する演出を再生する。

開発画面は実行データと現在のエンジンを確認するために使う。裏設定や制作メモを表示しない。

## ブラウザなしで遊ぶ・測る

[[builder/README|CLIの操作と測定条件]]に従う。CLIの保存とブラウザの開発用保存を共有すれば、同じ場面の規則と見た目を別々に確認できる。開発用の保存共有を本番の保存へ適用しない。

```sh
vp run cli play --new --save /tmp/run.json "depart layer0" "advance"
vp run cli inspect
```

## ソースとテスト

- re-exportを作らず、定義元から直接importする。1ファイルからexportする関数は1つまで。
- コンポーネントのファイル名は名前のkebab-case。`index.tsx` は使わない。propsとオブジェクト入力のフックは `type Props` と `props: Props` を使い、分割代入しない。
- 単体テストは同名の実装の隣。横断・結合・データ全体の検証は[[tests]]、ブラウザ検証は[[tests/e2e]]へ置く。
- 規約は `vp run check:source`、資料のWikiリンクは `vp run check:docs`、資料のID・生活設備・配置は `vp run check:concept` で検査する。
- 変更に応じた確認は[[verification]]、受入条件は[[features]]を正とする。過去の成功件数を現在の合格として扱わない。

## PWAと公開

Service Workerは本番だけで登録する。自アプリのキャッシュだけを扱い、保存データの削除と資源キャッシュの更新を分ける。オフライン再開の受入条件は[[features#オフライン再開]]を参照する。

静的HTMLの生成は `vp run build`、公開は `vp run deploy`。公開操作は依頼された範囲で行う。環境設定は[[void.config.ts]]と[[vite.config.ts]]、PWA定義は[[public/manifest.json]]・[[public/sw.js]]を参照する。

`VITE_EQUIPMENT_IMAGES=off` は装備画像を記号へ切り替える。ビルド時の値なので変更後は開発サーバーを再起動する。画像の取り込み・品質確認は[[artwork]]へまとめる。
