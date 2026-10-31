# e2e：ブラウザで画面を確かめる

開発サーバー（`https://dungeon.localhost`）が動いている前提。相手は `E2E_BASE_URL` で変えられる。

```sh
vp run e2e:flows          # 操作の確認（バッグ・対象選び・戦闘・召喚・会話・出撃）をスマホとPCで
vp exec bun tests/e2e/click-target.ts    # クリック共通処理が覆い・切り抜きを待ち、脈打つ対象も押す（サーバー不要）
vp run e2e:visual:base    # いまの見た目を基準として撮る（/previews の全場面×2サイズ）
vp run e2e:visual         # 撮り直して基準と比べる。差が 2% を超えた場面があれば失敗
vp run e2e:layouts        # 全登録パターン×3サイズとレイアウト一覧（PNG・検査JSON）
vp run e2e:timing         # 敵のHPを出さないこと、被害の確定・行動順・次の指示の時刻、カットインの時間
vp exec bun tests/e2e/town-entrances.ts  # 店の入口への追従・ダンジョンボタンの固定配置・縦横切替・施設移動
vp exec bun tests/e2e/entrance-artwork-failure.ts # 4画面サイズで背景失敗時の入口・施設移動・画像の再読込を確認
vp exec bun tests/e2e/save-storage.ts   # 開発用保存の通信エラー・削除待ち・再開（共有ファイルは変更しない）
vp exec bun tests/e2e/unreadable-save.ts # 読めない保存の安全な初期選択・Tab循環・パッド操作・保存保持・明示削除と再開
vp exec bun tests/e2e/settings-keyboard.ts # 設定のTab循環・確認取消・閉じるキーとパッドB・フォーカス復帰・保存保持
vp exec bun tests/e2e/battle-picker-keyboard.ts # 戦闘の道具の使用可否、戻ると道具決定をEnter/Space/パッドAで操作・対象取消・連打時の消費と手番
vp exec bun tests/e2e/battle-menu-selection.ts # 3画面幅で道具・スキルから戻ったときの武器選択保持、取消時の状態不変、選択したワザの実行
vp exec bun tests/e2e/battle-artwork-failure.ts # スマホ・PCで味方のワザ・敵の攻撃・突入エフェクトの通信失敗を再現し、勝利後の探索と敗北後の街へ戻れることを確認
vp exec bun tests/e2e/shop-stone-stock.ts # 説明欄のキーで誤購入しないこと、契約石の購入前後・保存復元・所持金不足での資産保持
vp exec bun tests/e2e/list-exit-lock.ts  # 募集入替ボタンの重なり・退場中の操作と資産保持・開き直した後の操作
vp exec bun tests/e2e/list-sale-input.ts # 売切後に残りの行へ選択を戻し、Enter／パッドAの連打で閉じたり別の品を売ったりしない（3幅）
vp exec bun tests/e2e/list-scroll.ts     # 長い一覧のつまみで両端へ移動・ドラッグ取消・複数ポインター・タッチ操作
vp exec bun tests/e2e/list-resize.ts     # 高さ変更・行の登場と減少にスクロールつまみが追従、売り切り時の所持金・選択解除
vp exec bun tests/e2e/list-action-bounds.ts # 縦横5サイズで長い主操作の文字を確認。通常・ホバー・脈動中の画面内・黒帯回避、横画面で一覧との分離・14px以上、実行結果
vp exec bun tests/e2e/stand-input.ts # 仲間詳細のTab・矢印・パッドで背景を操作しないこと、仲間切替・取消・背景復帰・保存保持
vp exec bun tests/e2e/bag-input.ts # バッグの入力範囲、Esc/Backspace/Bで閉じる、対象取消・回復薬1個の使用・背景復帰
vp exec bun tests/e2e/bag-pending-use.ts # 戦利品・宝箱・罠の結果表示中に回復し、道具1個の消費と結果・戦利品の保持を確認（3幅）
vp exec bun tests/e2e/item-target-cancel.ts # 対象選択の取消・再選択と回復、薬と同じIDの武器がある保存でも使用と装備を区別（3幅）
vp exec bun tests/e2e/discovery-gold.ts # 露店での支払い後、持ち帰り金貨・帰還手当て・保存復元・帰還後の残高を確認（3幅）
vp exec bun tests/e2e/discovery-gamepad.ts # 探索イベントの選択肢へスクロール追従し、右スティックで説明を読む。祝福の取消・確定も確認
vp exec bun tests/e2e/bag-dialogs.ts # 背景の持ち出し設定・ワザ付け替えがキーを奪わず、前面から順に閉じて元に戻る
vp exec bun tests/e2e/hero-editing.ts # 改名・容姿のTab循環、IME・文字削除、衣装欄のキー保持、パッド選択後のEnter、写真選択、取消・保存範囲
vp exec bun tests/e2e/modal-gamepad-scroll.ts # ワザ付け替えと持ち出し準備のパッド選択・固定見出し・右スティック・マウス切替・保存保持
vp exec bun tests/e2e/list-detail-scroll.ts # 短いスマホ画面の品物説明をキー・右スティックで読み、選択・保存を保持
vp exec bun tests/e2e/result-scroll.ts # 全滅・踏破の結果をTabで選び、キー・右スティックで末尾まで読む。終了と資産保持も確認
vp exec bun tests/e2e/return-summary.ts # 全層の帰還まとめをキー・右スティックで読み、誤帰還の防止・収支・持ち帰る物を確認
vp exec bun tests/e2e/supplies-save.ts   # 旧保存で道具が別の束に分かれている場合の持ち替え・自動保存・再起動
vp exec bun tests/e2e/onboarding.ts     # 初期3人・容姿選択・IME確定での誤登録防止・ギルド登録・容姿変更・初出撃と途中再開
vp exec bun tests/e2e/battle-effects.ts  # 漫画画像の実再生を停止・再開し、手番の完了と動きを減らす設定を確認
vp run e2e:animation      # 実再生を停止・再開し、ダメージ・手番・二重入力・施設遷移を確認
vp run e2e:studio         # スタジオの時計・条件・描画・操作・保存保護を確認
vp exec bun tests/e2e/studio-input.ts    # スタジオの修飾キー・入力部品・ボタンと再生ショートカットの共存を確認
vp exec bun tests/e2e/studio-lifecycle.ts # スタジオの起動失敗・処理待ちからの場面切り替えと時計の再起動を確認
vp exec bun tests/e2e/studio-import.ts   # シナリオJSONの再選択・読込順・時刻の上限・場面変更後の読込取消を確認
vp exec bun tests/e2e/studio-actions.ts  # 表示用ラベルの操作拒否と、攻撃・カットインの実行を2幅で確認
vp exec bun tests/e2e/room-levelup-exit.ts # 成長前後の値・就寝前の説明をアクセシビリティツリーで確認し、退場待ちと資産保持も確認
vp exec bun tests/e2e/room-growth-preview.ts # 成長予定の公開・宿泊後の条件非表示と、通常プレビュー／編成変更後の成長を確認
vp exec bun tests/e2e/room-growth-input.ts # 成長予定欄のキーで宿泊料金を払わず、泊まるを選んだときだけ支払い・成長
vp exec bun tests/e2e/room-perks.ts # 全室の料金・回復効果をアクセシビリティツリーで確認し、配置・保存保持も検証
vp exec bun tests/e2e/room-growth-readability.ts # 5画面サイズで成長後の数値が人物に隠れず、画面内に収まることを確認
vp exec bun tests/e2e/studio-artwork.ts  # 未登場の敵画像なしで起動し、戦闘突入時の画像読み込みと必要な画像のエラー表示を確認
vp exec bun tests/e2e/resident-scenes.ts # 場所に入ったときの場面・同じ夜に繰り返さない・ギルドの会話が未読へ進む
vp exec bun tests/e2e/night-talk.ts # 初期編成で宿泊から二人雑談へ進み、両方の返答・親しさ表示・資産保持・保存復元・重複拒否を3幅で確認
```

- 画面を変える前に `e2e:visual:base` を撮り、変えた後に `e2e:visual` で比べる。差分画像は `node_modules/.cache/visual/next/diff/`。
- 撮影は `/previews/{slug}?still` を開く。入りの演出は早送り、繰り返しの動き・手持ちカメラの揺れは止める。
- 画像はリポジトリの外（`node_modules/.cache`）に書く。リポジトリ直下に書くと開発サーバーが再読み込みして撮影が崩れる。
- 押す操作は、入場を待ち、クリック位置の受け手と対象への実際のクリック到達を確認する（`tests/e2e/lib.ts` の `press` / `tap`）。脈打つボタンの演出は止めない。

任意時刻のPNG、配置・状態・演出の検査、時刻付き操作のCLIは [開発スタジオ](../.docs/dev-studio.md)。

レイアウトの成果物は `node_modules/.cache/studio/layouts/`。問題の再確認は `LAYOUT_SCENES=bag-target LAYOUT_VIEWPORTS=スマホ vp run e2e:layouts`。画像の厳密一致を調べる `e2e:studio` は許容差を持たず、ブラウザの中間画像に差がある場合は失敗する。

`e2e:animation` はダメージの実アニメーションを1.8秒停止し、行動順・入力が先へ進まないこと、再開後にダメージの数字が数え上がり次の手番（行動順の顔）へ1つだけ進むことを確認する。敵のHPは画面に出さない。停止・再開後のPNGと状態JSONは `node_modules/.cache/studio/animation/`。進行を制御する実装は固定タイマーを使わず、Motionの完了通知を待つ。

`vp exec bun tests/e2e/defeated.ts` はスタンプダックとダックリングを実際の攻撃で倒し、ダメージ到着までは通常画像、その後に戦闘不能画像を表示して退場する順序をスマホ・PCで確認する。PNGは `node_modules/.cache/studio/defeated/`。

## 武器のワザ付け替え

以下は320・390・1280pxの3幅で確認する。実行中のサーバーに対して `vp exec bun tests/e2e/<台本名>.ts` を使用する。PNGは `/tmp/dnd-inscription-*` に保存する。

| 台本                                                     | 確認する内容                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [inscription-rarity-uses.ts](inscription-rarity-uses.ts) | N/R/SR、未装備/主人公装備の名前・持ち主・操作グループ、現在と候補の最大使用回数、選択取消の保存保持           |
| [inscription-weapon-plus.ts](inscription-weapon-plus.ts) | 未強化と+3の識別、候補の強化込み使用回数、選択取消の保存保持                                                  |
| [inscription-use.ts](inscription-use.ts)                 | 強化武器の指定枠だけを変更、書1冊の実消費、他の武器と金貨の保持                                               |
| [inscription-reach.ts](inscription-reach.ts)             | 剣・魔法銃の現在の効果説明と射程、候補の近接/遠距離・射程なし                                                 |
| [inscription-keyboard.ts](inscription-keyboard.ts)       | 初期フォーカス、Tab/Shift+Tab循環、Escape/Backspace/パッドBによる段階別の取消・閉じる、起点への復帰・保存保持 |
| [inscription-exhausted.ts](inscription-exhausted.ts)     | クリックとEnterで書2冊を実消費、選択枠だけ変更、書不足の無効状態と理由、無効候補を飛ばすTab、他の資産保持     |
| [inscription-equipped.ts](inscription-equipped.ts)       | 装備中の実変更、仲間の武器Queryへワザ反映、持ち主・強化・能力・使用済み回数の保持、保存復元                   |
| [inscription-empty.ts](inscription-empty.ts)             | 武器なしの入手先案内、閉じるへのフォーカス、TabとEscape、保存保持                                             |

書・強化・レア度・武器なしの条件は保存境界で準備する。購入・装備・枠変更は台本内で実行する。これらは鑑定抽選や自然な強化進行、実際のスクリーンリーダー音声、変更後のワザを戦闘で使うことの検証とは区別する。

## 鍛冶屋の強化・生産

320・390・1280pxの3幅で、金貨と材料の不足案内から実行結果まで確認する。

| 台本                                               | 確認する内容                                                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [smithy-shortages.ts](smithy-shortages.ts)         | 強化・生産それぞれの金貨不足、材料不足、両方不足。案内とQueryの一致、拒否ボタンを押した後の保存全体の保持（18ケース）              |
| [smithy-ready.ts](smithy-ready.ts)                 | 準備済みの実成功と通知。必要分だけ消費し、選択装備だけ+1／生産品1本追加。再実行拒否で通知を消し、開き直しまで保存を保持（6ケース） |
| [smithy-repair-notice.ts](smithy-repair-notice.ts) | 個別・全部修理の成功通知、対象防具だけ耐久回復、費用だけ消費し他の保存を保持（6ケース）                                            |

`vp exec bun tests/e2e/smithy-shortages.ts`、`vp exec bun tests/e2e/smithy-ready.ts` で実行する。PNGは `/tmp/dnd-smithy-shortages-*`、`/tmp/dnd-smithy-ready-*`。金貨と材料は保存境界で準備し、強化・生産は画面から実行する。対象は台本が選ぶ最初の強化候補と最初の生産レシピ。全レシピの到達性や自然な素材収集の検証とは区別する。

## 防具の入手と比較

以下は320・390・1280pxの3幅で確認する。`vp exec bun tests/e2e/<台本名>.ts` で実行する。

| 台本                                                 | 確認する内容                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [shop-armor-appraisal.ts](shop-armor-appraisal.ts)   | 0〜2層の魔術系防具に鑑定からの入手案内、非候補には案内なし、閲覧の保存保持（9ケース）         |
| [shop-armor-comparison.ts](shop-armor-comparison.ts) | 購入前の全対象の防具名・耐久・能力比較、装備中と防具なし、鑑定案内、閲覧の保存保持（9ケース） |
| [bag-equipment.ts](bag-equipment.ts)                 | 武器と防具の比較・取消・装備・探索中制限。防具の消耗・耐久切れ・満タンの案内切替（6ケース）   |
| [bag-equipment-cost.ts](bag-equipment-cost.ts)       | 装備150個追加時の候補Query回数・一覧件数・閲覧中の保存保持（3幅）                             |
| [bag-broken-comparison.ts](bag-broken-comparison.ts) | 耐久切れ防具を渡す前の警告、取消の保存全体保持（3ケース）                                     |

到達層・消耗・防具なしは保存境界で準備する。比較と案内の検証を、自然な入手頻度の測定とは区別する。鑑定の実入手と装備は `content/exploration-armor.test.ts`、進行の目標は `vp run cli check --json` で確認する。

## 宿の金貨不足と突破後の帰還

`vp exec bun tests/e2e/room-shortage.ts` は320・390・1280pxで、無料宿と有料2部屋の金貨0・1G不足・必要額ちょうどを確認する（21条件）。不足額表示と、拒否時の保存全体の保持を確認する。

`vp exec bun tests/e2e/reforge-growth.ts` は同じ3幅で固定武器を実際に鍛え直す。通常のIDと「:」を含むIDの両方で、次段の表示、選んだ素材2本だけの消費、金貨消費、攻撃力28→30、戦闘Queryとの一致、保存の復元を確認する。全固定武器の性能比較はbuilderで別に測る。

`vp exec bun tests/e2e/return-summary.ts` は同じ3幅で全5層の突破後と戦利品がない状態を確認する（18条件）。戦利品・帰還所持金・宿で育つ仲間・次の挑戦、表示の可読性と帰還ボタンとの非重複を確認し、画面の帰還操作で金貨・持ち物・経験値を保持する。最深層は踏破結果から街へ戻る。到達と戦利品は検証用の保存から準備し、自然な探索の突破頻度とは区別する。PNGは `/tmp/dnd-return-summary-*`。

## 全滅後の立て直し

`vp exec bun tests/e2e/wipe-stacks.ts` は320・390・1280pxで、同じ戦利品が複数の束に分かれた保存から実際の戦闘で全滅し、損失数・持ち帰り数・結果表示・保存復元・結果を閉じる際の資産保持を確認する。PNGは `/tmp/dnd-wipe-stacks-*`。

`vp exec bun tests/e2e/wipe-recovery-route.ts` は320・390・1280pxで、全滅結果を閉じ、宿から屋根裏の宿泊ボタンへ移動し、街へ戻って商店街から鍛冶屋の修理一覧を開く。施設への到達と一覧の対象数、移動・閲覧での資産保持を確認する。宿泊と修理そのものの実行は `room-morning.ts` と `smithy-repair-notice.ts` で別に検証する。PNGは `/tmp/dnd-wipe-recovery-route-*`。

## 画像更新とオフライン保存

`vp exec bun tests/e2e/service-worker-cache.ts` は専用HTTPサーバーを起動し、本物のService Workerで同名画像の更新、HTTPキャッシュの再検証、オフライン画像とホーム、ハッシュ付きビルド資源の保存優先、HTTPエラーの保存拒否、保存容量不足でも応答を維持することを確認する。実配信と同じ `Vary: Origin` 付きのJSを一括保存し、オフラインでモジュールとして読み込めることも確認する。キャッシュの読み取りに失敗しても、ハッシュ付き資源を通信から取得できることも確認する。一括保存による同名画像の更新と、不正なURL値・HTTP失敗の除外も確認する。ゲームの開発サーバーは不要。ゲーム全体のオフライン操作とは区別する。

## 行動が異なる亜種

`vp exec bun tests/e2e/monster-variants.ts` は390・1280pxで、各層の終盤の敵2体をStudioへ読み込み、5亜種と最終ボスの専用画像・名前・最大HP・閲覧中の保存保持を確認する。PNGは `/tmp/dnd-monster-variants-*`。自然な探索からの登場・行動・保存再開は `content/monster-variants.test.ts`、一周の消耗と突破ペースは `vp run cli check` と同じシードによる `fun` の変更前後比較で別に測る。

# 街・農場の単発戦闘

`vp exec bun tests/e2e/quick-quests.ts` は320/390/1280幅で6依頼を実際の「戦う」と戦闘のボタンで操作し、背景・自動精算・探索進行の保持を確認する。表示・操作を安定して検査するため高いHP・能力と最深層の店装備を用意し、難度は `builder/quick-quests.ts` の実際の敵を使う別測定で確認する。仮想時計を進める前に戦闘エフェクトの画像デコードを待つ。編集中のHMRは検査ページのWebSocketだけで止める。`vp exec bun tests/e2e/quick-quest-entry.ts` は街からギルドのクエストへの入口と戻る操作、3人編成を3幅、`vp exec bun tests/e2e/quick-quest-defeat.ts` は敗北後の復帰・没収なし・再挑戦を3幅で確認する。

## 最初の相棒ロクスと主人公の衣装

`vp exec bun tests/e2e/lox.ts` は320・390・1280幅で、初期契約ロクス、街の「ロクスと話す」、初回会話と選択肢、次の会話、主人公の防具・本人の成長案内なし、既存衣装への着替えと資産・能力保持を実際の操作で確認する。PNGは `/tmp/dnd-lox-*`。接続先は既定のPortless `https://dungeon.localhost`、必要なら `E2E_BASE_URL` で稼働中の開発サーバーを指定する。会話の保存再開と物語の条件は `demon-hero.test.ts` で確認する。

## 物語から悪魔と契約する

`vp exec bun tests/e2e/demon-contracts.ts` は320・390・1280幅で秘密の部屋を開き、ヌイとの出会い・選択肢・素材と契約料の支払い・ロクスの合体維持・ヌイとザザが並ぶ友達の場面・加入後の直接会話を実際の操作で確認する。進行と資金・素材は検証用に用意する。自然な素材入手や探索難度は別測定。PNGは `/tmp/dnd-contract-*`。

## 世界地図・契約書・四人の冒頭

`vp exec bun tests/e2e/world-contracts.ts` は320/390/1280幅で、四人の立ち絵会話、初回案内、村の情報による道の解放、契約書でのヌイ召喚、加入前の無料再会、金のリンゴの採集、正式加入を実際の操作で確認する。0層突破と資金は保存で用意する。制作タイムラインの上限を守るため、村から帰った時点で実際の保存を使って再起動する。PNGは `/tmp/dnd-world-*`。

`vp exec bun tests/e2e/unidentified-weapons.ts` は同じ3幅で、未鑑定の武器を武器屋で調べ、元の強化とワザを保持した鑑定結果を確認する。店へ持ち込む武器は保存で用意する。敵からの未鑑定生成・全滅時の表示・保存復元・鑑定前の操作拒否はエンジンテストで確認する。PNGは `/tmp/dnd-unidentified-*`。

`vp exec bun tests/e2e/equipment-row-keys.ts` は320・390・1280pxで、操作名や品物IDと同じIDの武器を鑑定・個別装備・取り外し・再装備する。おまかせ装備やまとめて鑑定との混同、選んでいない品の消費、保存復元を確認する。

本番成果物の再開確認は、`vp run build` 後に `vp run preview --host 127.0.0.1 --port 4367` を起動し、`E2E_BASE_URL=http://127.0.0.1:4367 vp exec bun tests/e2e/offline-start.ts` を実行する。スマホ・PCで初回に読み込んだホームをオフラインで再読み込みし、会話・保存内容・画像の保持を確認する。サービスワーカーの準備より前に画像の取得を始め、応答を遅らせた場合も確認する。登録を拒否される環境では、未処理の例外を出さずにオンラインで会話を進め、保存から再開できることを確認する。

`E2E_BASE_URL=http://127.0.0.1:4367 vp exec bun tests/e2e/service-worker-reload.ts` は本番 preview のスマホ・PCで2回ずつ再読み込みし、ホームのHTML取得が毎回1回で、会話と保存内容が変わらないことを確認する。

`vp exec bun tests/e2e/service-worker-cache.ts` は実際のサービスワーカーを専用のローカルサーバーに登録し、同名画像の更新・オフライン取得・保存領域の読み書き失敗を確認する。別用途のキャッシュに同じURLの応答を用意し、旧版だけの削除・別用途の内容保持・ゲーム専用キャッシュからの読み込みも確認する。

`vp exec bun tests/e2e/keyboard-shortcuts.ts` はスマホ・PC幅でCtrl/Cmd/Alt付きのキーイベントを送り、仲間の詳細・行き先・会話を変更せず、標準動作を妨げないことを確認する。修飾キーなしの数字・方向キー・Enterは引き続きゲームを操作できることも確認する。
