# e2e：ブラウザで画面を確かめる

開発サーバー（`https://dnd.localhost`）が動いている前提。相手は `E2E_BASE_URL` で変えられる。

```sh
bun run e2e:flows          # 操作の確認（バッグ・対象選び・戦闘・召喚・会話・出撃）をスマホとPCで
bun run e2e:visual:base    # いまの見た目を基準として撮る（/previews の全場面×2サイズ）
bun run e2e:visual         # 撮り直して基準と比べる。差が 2% を超えた場面があれば失敗
bun run e2e:layouts        # 全登録パターン×3サイズとレイアウト一覧（PNG・検査JSON）
bun run e2e:timing         # 敵のHPを出さないこと、被害の確定・行動順・次の指示の時刻、カットインの時間
bun e2e/town-entrances.ts  # 店の入口への追従・ダンジョンボタンの固定配置・縦横切替・施設移動
bun e2e/onboarding.ts     # 初期3人・容姿選択・ギルド登録・容姿変更・初出撃と途中再開
bun e2e/battle-effects.ts  # 漫画画像の実再生を停止・再開し、手番の完了と動きを減らす設定を確認
bun run e2e:animation      # 実再生を停止・再開し、ダメージ・手番・二重入力・施設遷移を確認
bun run e2e:studio         # スタジオの時計・条件・描画・操作・保存保護を確認
bun e2e/resident-scenes.ts # 場所に入ったときの場面・同じ夜に繰り返さない・ギルドの会話が未読へ進む
```

- 画面を変える前に `e2e:visual:base` を撮り、変えた後に `e2e:visual` で比べる。差分画像は `node_modules/.cache/visual/next/diff/`。
- 撮影は `/previews/{slug}?still` を開く。入りの演出は早送り、繰り返しの動き・手持ちカメラの揺れは止める。
- 画像はリポジトリの外（`node_modules/.cache`）に書く。リポジトリ直下に書くと開発サーバーが再読み込みして撮影が崩れる。
- 押す操作は、要素が画面の中で止まるのを待ってから、見えている部分の中心を押す（`e2e/lib.ts` の `press` / `tap`）。

任意時刻のPNG、配置・状態・演出の検査、時刻付き操作のCLIは [開発スタジオ](../.docs/dev-studio.md)。

レイアウトの成果物は `node_modules/.cache/studio/layouts/`。問題の再確認は `LAYOUT_SCENES=bag-target LAYOUT_VIEWPORTS=スマホ bun run e2e:layouts`。画像の厳密一致を調べる `e2e:studio` は許容差を持たず、ブラウザの中間画像に差がある場合は失敗する。

`e2e:animation` はダメージの実アニメーションを1.8秒停止し、行動順・入力が先へ進まないこと、再開後にダメージの数字が数え上がり次の手番（行動順の顔）へ1つだけ進むことを確認する。敵のHPは画面に出さない。停止・再開後のPNGと状態JSONは `node_modules/.cache/studio/animation/`。進行を制御する実装は固定タイマーを使わず、Motionの完了通知を待つ。

`bun e2e/defeated.ts` はスタンプダックとダックリングを実際の攻撃で倒し、ダメージ到着までは通常画像、その後に戦闘不能画像を表示して退場する順序をスマホ・PCで確認する。PNGは `node_modules/.cache/studio/defeated/`。

## 武器のワザ付け替え

以下は320・390・1280pxの3幅で確認する。実行中のサーバーに対して `bun e2e/<台本名>.ts` を使用する。PNGは `/tmp/dnd-inscription-*` に保存する。

| 台本                                                     | 確認する内容                                                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [inscription-rarity-uses.ts](inscription-rarity-uses.ts) | N/R/SR、未装備/主人公装備の名前・持ち主・操作グループ、現在と候補の最大使用回数、選択取消の保存保持       |
| [inscription-reach.ts](inscription-reach.ts)             | 剣・魔法銃の現在の効果説明と射程、候補の近接/遠距離・射程なし                                             |
| [inscription-keyboard.ts](inscription-keyboard.ts)       | 初期フォーカス、Tab/Shift+Tab循環、Escape/Backspaceによる取消・閉じる、起点への復帰                       |
| [inscription-exhausted.ts](inscription-exhausted.ts)     | クリックとEnterで書2冊を実消費、選択枠だけ変更、書不足の無効状態と理由、無効候補を飛ばすTab、他の資産保持 |
| [inscription-equipped.ts](inscription-equipped.ts)       | 装備中の実変更、仲間の武器Queryへワザ反映、持ち主・強化・能力・使用履歴保持                               |
| [inscription-empty.ts](inscription-empty.ts)             | 武器なしの入手先案内、閉じるへのフォーカス、TabとEscape、保存保持                                         |

書・強化・レア度・武器なしの条件は保存境界で準備する。購入・装備・枠変更は台本内で実行する。これらは鑑定抽選や自然な強化進行、実際のスクリーンリーダー音声、変更後のワザを戦闘で使うことの検証とは区別する。

## 鍛冶屋の強化・生産

320・390・1280pxの3幅で、金貨と材料の不足案内から実行結果まで確認する。

| 台本                                               | 確認する内容                                                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [smithy-shortages.ts](smithy-shortages.ts)         | 強化・生産それぞれの金貨不足、材料不足、両方不足。案内とQueryの一致、拒否ボタンを押した後の保存全体の保持（18ケース）              |
| [smithy-ready.ts](smithy-ready.ts)                 | 準備済みの実成功と通知。必要分だけ消費し、選択装備だけ+1／生産品1本追加。再実行拒否で通知を消し、開き直しまで保存を保持（6ケース） |
| [smithy-repair-notice.ts](smithy-repair-notice.ts) | 個別・全部修理の成功通知、対象防具だけ耐久回復、費用だけ消費し他の保存を保持（6ケース）                                            |

`bun e2e/smithy-shortages.ts`、`bun e2e/smithy-ready.ts` で実行する。PNGは `/tmp/dnd-smithy-shortages-*`、`/tmp/dnd-smithy-ready-*`。金貨と材料は保存境界で準備し、強化・生産は画面から実行する。対象は台本が選ぶ最初の強化候補と最初の生産レシピ。全レシピの到達性や自然な素材収集の検証とは区別する。

## 防具の入手と比較

以下は320・390・1280pxの3幅で確認する。`bun e2e/<台本名>.ts` で実行する。

| 台本                                                 | 確認する内容                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [shop-armor-appraisal.ts](shop-armor-appraisal.ts)   | 0〜2層の魔術系防具に鑑定からの入手案内、非候補には案内なし、閲覧の保存保持（9ケース）         |
| [shop-armor-comparison.ts](shop-armor-comparison.ts) | 購入前の全対象の防具名・耐久・能力比較、装備中と防具なし、鑑定案内、閲覧の保存保持（9ケース） |
| [bag-equipment.ts](bag-equipment.ts)                 | 武器と防具の比較・取消・装備・探索中制限。防具の消耗・耐久切れ・満タンの案内切替（6ケース）   |
| [bag-broken-comparison.ts](bag-broken-comparison.ts) | 耐久切れ防具を渡す前の警告、取消の保存全体保持（3ケース）                                     |

到達層・消耗・防具なしは保存境界で準備する。比較と案内の検証を、自然な入手頻度の測定とは区別する。鑑定の実入手と装備は `src/lib/content/exploration-armor.test.ts`、進行の目標は `bun builder/cli.ts check --json` で確認する。最近の測定は [魔術系防具の追加記録](../.docs/verification/mage-armor-appraisal-2026-10-10.json)。

## 宿の金貨不足と突破後の帰還

`bun e2e/room-shortage.ts` は320・390・1280pxで、無料宿と有料2部屋の金貨0・1G不足・必要額ちょうどを確認する（21条件）。不足額表示と、拒否時の保存全体の保持を確認する。

`bun e2e/reforge-growth.ts` は同じ3幅でアルマの固定武器を実際に鍛え直す。次段の表示と素材2本の使用、金貨消費、攻撃力28→30、戦闘Queryとの一致を確認する。全固定武器の性能比較はbuilderで別に測る。

`bun e2e/return-summary.ts` は同じ3幅で全5層の突破後と戦利品がない状態を確認する（18条件）。戦利品・帰還所持金・宿で育つ仲間・次の挑戦、表示の可読性と帰還ボタンとの非重複を確認し、画面の帰還操作で金貨・持ち物・経験値を保持する。最深層は踏破結果から街へ戻る。到達と戦利品は検証用の保存から準備し、自然な探索の突破頻度とは区別する。PNGは `/tmp/dnd-return-summary-*`。

## 全滅後の立て直し

`bun e2e/wipe-recovery-route.ts` は320・390・1280pxで、全滅結果を閉じ、宿から屋根裏の宿泊ボタンへ移動し、街へ戻って商店街から鍛冶屋の修理一覧を開く。施設への到達と一覧の対象数、移動・閲覧での資産保持を確認する。宿泊と修理そのものの実行は `room-morning.ts` と `smithy-repair-notice.ts` で別に検証する。PNGは `/tmp/dnd-wipe-recovery-route-*`。

## 画像更新とオフライン保存

`bun e2e/service-worker-cache.ts` は専用HTTPサーバーを起動し、本物のService Workerで同名画像の更新、HTTPキャッシュの再検証、オフライン画像とホーム、ハッシュ付きビルド資源の保存優先、HTTPエラーの保存拒否、保存容量不足でも応答を維持することを確認する。一括保存による同名画像の更新と、不正なURL値・HTTP失敗の除外も確認する。ゲームの開発サーバーは不要。ゲーム全体のオフライン操作とは区別する。

## 行動が異なる亜種

`bun e2e/monster-variants.ts` は390・1280pxで、各層の終盤の敵2体をStudioへ読み込み、5亜種と最終ボスの専用画像・名前・最大HP・閲覧中の保存保持を確認する。PNGは `/tmp/dnd-monster-variants-*`。自然な探索からの登場・行動・保存再開は `src/lib/content/monster-variants.test.ts`、一周の消耗と突破ペースは `bun builder/cli.ts check` と同じシードによる `fun` の変更前後比較で別に測る。

# 街・農場の単発戦闘

`bun e2e/quick-quests.ts` は320/390/1280幅で6依頼を実際の「戦う」と戦闘のボタンで操作し、背景・自動精算・探索進行の保持を確認する。表示・操作を安定して検査するため高いHP・能力と最深層の店装備を用意し、難度は `builder/quick-quests.ts` の実際の敵を使う別測定で確認する。仮想時計を進める前に戦闘エフェクトの画像デコードを待つ。編集中のHMRは検査ページのWebSocketだけで止める。`bun e2e/quick-quest-entry.ts` は街からギルドのクエストへの入口と戻る操作、3人編成を3幅、`bun e2e/quick-quest-defeat.ts` は敗北後の復帰・没収なし・再挑戦を3幅で確認する。

## 最初の相棒ロクスと主人公の衣装

`bun e2e/lox.ts` は320・390・1280幅で、初期契約ロクス、街の「ロクスと話す」、初回会話と選択肢、次の会話、主人公の防具・本人の成長案内なし、既存衣装への着替えと資産・能力保持を実際の操作で確認する。PNGは `/tmp/dnd-lox-*`。接続先は既定のPortless `https://dnd.localhost`、必要なら `E2E_BASE_URL` で稼働中の開発サーバーを指定する。会話の保存再開と物語の条件は `demon-hero.test.ts` で確認する。

## 物語から悪魔と契約する

`bun e2e/demon-contracts.ts` は320・390・1280幅で秘密の部屋を開き、ヌイとの出会い・選択肢・素材と契約料の支払い・ロクスの合体維持・ヌイとザザが並ぶ友達の場面・加入後の直接会話を実際の操作で確認する。進行と資金・素材は検証用に用意する。自然な素材入手や探索難度は別測定。PNGは `/tmp/dnd-contract-*`。

## 世界地図・契約書・四人の冒頭

`bun e2e/world-contracts.ts` は320/390/1280幅で、四人の立ち絵会話、初回案内、村の情報による道の解放、契約書でのヌイ召喚、加入前の無料再会、金のリンゴの採集、正式加入を実際の操作で確認する。0層突破と資金は保存で用意する。制作タイムラインの上限を守るため、村から帰った時点で実際の保存を使って再起動する。PNGは `/tmp/dnd-world-*`。

`bun e2e/unidentified-weapons.ts` は同じ3幅で、未鑑定の武器を武器屋で調べ、元の強化とワザを保持した鑑定結果を確認する。店へ持ち込む武器は保存で用意する。敵からの未鑑定生成・全滅時の表示・保存復元・鑑定前の操作拒否はエンジンテストで確認する。PNGは `/tmp/dnd-unidentified-*`。
