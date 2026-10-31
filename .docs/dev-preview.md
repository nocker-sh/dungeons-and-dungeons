# AI向けのグラフィック確認と動作確認

## 目的と使い分け

`/dev/view` はグラフィック確認、`/dev/play/{scene}` は動作確認に使う。同じ場面・シード・隊列・敵・HP・台本から、同じ初期状態を作る。ゲーム本体と同じエンジン・画面を使い、保存先はメモリに閉じる。

- `view` は指定時刻まで描画して停止する。クリック・タップ・ホバー・キー・ゲームパッドでは状態を変えない。URLで指定した台本だけを再生する。
- `play` は同じ時刻まで初期状態を再現した後、時計を動かして入力を受け付ける。画面遷移・戦闘・買い物などの動作をそのまま確認する。URLを開き直すと同じ初期条件へ戻る。
- 条件を編集しながら時刻を移動する作業には[[dev-studio]]を使う。

## 入口

```text
/dev/view?scene=battle&seed=77&party=hero,rivet,husky&foes=haribote-adult,hiyokobu&hp=100,25,0&at=2000
/dev/play/town?seed=77
/dev/play/guild-quests?seed=77
/dev/view?scene=battle&width=1280&height=800&guides=1
/dev/view?catalog=1
```

`catalog=1` は、現在登録されている場面・人物・敵のslug、場面ごとの停止時刻、指定できるパラメータをJSONで表示する。一覧は実行用データと既存のシナリオから作り、別の手書き一覧を持たない。

場面は[[development/studio/scenarios.ts]]、URL境界は[[development/studio/preview-query.ts]]を正とする。新しい種類の初期状態は既存のシナリオへ追加し、同じカタログへ反映する。

## 再現条件

| 指定 | 意味 |
| --- | --- |
| `scene` | viewで開く場面。playではパスの場面を使う |
| `seed` | ゲームと見た目の乱数の種 |
| `party` | 先頭が`hero`の異なる3人。カンマ区切りのslug |
| `foes` | 組み合わせ戦闘の敵。カンマ区切りのslug |
| `hp` | 組み合わせ戦闘の各人の残りHP百分率 |
| `width`・`height` | ゲームの実際のviewport。親の画面サイズから独立する |
| `at` | 起動時に描画する時刻（ms）。省略時は場面の登録時刻 |
| `actions` | `[{"at":4000,"label":"放つ"}]`形式のJSON台本。URLエンコードする |
| `duration` | 初期再現用のタイムライン上限。playの継続時間は制限しない |
| `guides` | `1`で配置の枠線、`0`で非表示 |

登録済みのメニュー場面は必要な操作台本も引き継ぐ。`actions`を指定した場合はその台本で置き換える。敵とHPは組み合わせ戦闘に適用し、街や保存付き場面の状態へ勝手に変換しない。

未知のパラメータ、重複指定、存在しないslug、無効な隊列や時刻は理由を表示して起動しない。playのパスと`scene`が食い違う場合も拒否する。URLの誤字を別の初期状態へ読み替えない。

## AIから検査する

```ts
await page.goto(baseUrl + "/dev/view?scene=battle&seed=77&at=2000")
await page.waitForFunction(() => window.__devPreview?.ready || window.__devPreview?.error)
const failure = await page.evaluate(() => window.__devPreview?.error)
if (failure) throw new Error(failure)
const inspection = await page.evaluate(() => window.__devPreview?.inspect())
await page.locator("iframe").screenshot({ path: outputPath })
```

`window.__devPreview` はモード、読み込み段階（`stage`）、起動完了、エラー、検査結果を返す。読み込み待ちの間も、接続・画像・初期化・指定時刻の描画のどこで止まったかを確認できる。検査結果は[[client/dev/studio-types.ts]]の `StudioInspection` と共通で、条件、仮想時刻、ゲーム状態、隊列、戦闘、要素の矩形、画像参照、演出、台本の実行結果を含む。親の検査窓口にはクリックやゲーム状態の書き換えを公開しない。

playの入力はiframe内の通常のボタンへ行う。検査結果は実行中の時刻を含むので、初期状態の比較にはviewかURLの再読込を使う。矩形の `outside` は意図的な画面外・クリップも含み、それだけで不具合と判断しない。

`stage` が `connecting` のままで検査結果が `null` なら、フレームの起動処理より前で止まっている。ブラウザのConsoleとNetworkでモジュール・画像の取得を確認する。プロキシ経由だけで失敗する場合は、開発サーバーが出力する直接接続URLを `E2E_BASE_URL` に指定し、配信経路とゲームの不具合を切り分ける。

大きい画面を確認するときは、指定した幅・高さ以上にブラウザを広げるかiframe自体を撮影する。親の余白をゲームの構図へ混ぜない。

## 実装と検証

URL検証とカタログ生成はサーバーで行う。グラフィック確認の親ページへシナリオ生成・エンジンの全依存を読み込ませず、描画するフレームだけにゲームを起動する。

起動・台本・固定時計は既存の[[client/components/dev/frame.tsx]]と[[client/dev/studio-runtime.ts]]を共有する。viewは指定時刻の補間結果をスタイルへ確定して停止する。入力遮断はフレームの寿命に結び付け、playや通常のプレビューへ残さない。開発サーバーの依存キャッシュはポートごとに分け、テスト用キャッシュとも分離する。ゲームの遅延読込で使う依存は起動時に最適化し、初回表示中の再最適化を避ける。

`PLAYWRIGHT_SOFTWARE=1 vp exec bun tests/e2e/dev-preview.ts` で、viewの入力無効と同条件の画像再現、台本付きメニュー、playでの操作と継続、保存の保護、実寸、無効な場面の表示を確認する。PNGの完全一致は同じブラウザ・ソフトウェア描画で比較する。GPU描画では同じ配置でも輪郭の濃さに微差が生じることがある。既存のChromeを使う環境では `PLAYWRIGHT_CHANNEL=chrome` を指定できる。
