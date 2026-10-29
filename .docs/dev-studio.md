---
title: 開発スタジオ
status: active
updated: 2026-10-27
routes: [/dev/layouts, /dev/studio, /dev/frame]
source: "[[development/studio/scenarios.ts]]"
---

# 開発スタジオ

自分とAIが、実際のゲームのレイアウトと演出を同じ条件で確認するための環境。`/dev/layouts` にレイアウト一覧、`/dev/studio` に操作をまとめ、`/dev/frame/{scene}` に同じゲームの画面を表示する。

画面の条件編集は [[client/components/dev/dev-studio.tsx]]、タイムラインの表示は `studio-timeline.tsx`、iframeの起動待ち・シークの直列化・キャンセル・再生とキーボード操作は [[client/dev/use-studio-playback.ts]] が担当する。条件変更前の描画結果は世代番号で破棄し、逆戻りは同じ条件のiframeを再起動する。

## やることと完了条件

1. 場面、3人の隊列、敵の組み合わせ、HP、乱数の種、表示サイズを指定する。実行用データとエンジンから開始状態を作り、本物の保存を変更しない。
2. タイムラインで再生・停止・任意時刻への移動・コマ送りを行う。逆戻りは同じ初期状態から再実行し、途中のReact状態を巻き戻したふりをしない。
3. 演出の時計を制御する。待ち時間、requestAnimationFrame、Web Animationsを同じ時刻で進め、見た目の乱数も固定する。
4. 画面のボタン操作を時刻付きで再現する。戦闘の狙った敵への実行（「放つ」）・防御などを同じ操作経路で再生する。
5. 要素の位置・アニメーション・ゲーム状態・操作履歴・エラーをJSONで取得し、レイアウトの枠線も表示できるようにする。
6. CLIからPNG、指定した時刻の連続フレーム、JSONの検証記録を書き出す。UIの指定をJSONとして保存し、CLIで再利用する。

優先順位は同じ状態の再現、任意時刻の撮影、操作と検査、UIの使いやすさの順。ここでの「画像生成」はゲーム画面をレンダリングしたPNGの出力を指す。

## 検証

- 同じシナリオと種と時刻を2回描画し、状態・配置・演出が一致する。PNGの完全一致は別途厳密に検証し、不一致を許容して成功扱いにしない。
- 戦闘の0秒・2秒・実行後の画像に実際の変化がある。逆戻り後の画像が最初の描画と一致する。
- 異なる仲間・敵・HPを指定すると、エンジンの問い合わせと画面が一致する。
- 縦・横のサイズをiframeの実寸で再現し、親の縮尺をゲームのviewportへ混ぜない。
- CLIの不正な指定は理由を返して失敗し、取得したエラーを成功として扱わない。
- 既存のゲームと人物・画像の`/dev`ページを保持する。型・関連テスト・整形・ビルドとブラウザ操作を確認する。

## レイアウト一覧

`https://dnd.localhost/dev/layouts` で実装済み72パターンを確認できる。基本画面、バッグの各分類・詳細・対象、仲間の資料・装備、施設内の各メニュー、募集・会話・召喚、宿の休息・成長・夜の会話と選択肢、探索の宝箱・罠・戦利品・分岐・中ボス・ボス・踏破、敵の数・瀕死の隊列を含む。これは登録済みのレイアウト一覧で、全キャラ・装備・操作結果の組み合わせを網羅する意味ではない。

スマホ390×844、横長1280×800、縦長768×1024を切り替え、検索とページ送りで探す。1ページ6場面の実ゲームiframeを、それぞれのメニューが開いた時刻で停止する。見出しを押すと `/dev/studio/{scene}` に移り、タイムラインで登場・途中・退場を微調整できる。台本と停止時刻は [[development/studio/patterns.ts]] に一元化し、一覧・スタジオ・CLIで共有する。

## 使い方

`https://dnd.localhost/dev/studio/battle` を開く。左に場面、中央にゲームとタイムライン、右に条件と検査を置く。スマホ・縦・横のプリセットと任意の幅・高さを選べる。iframeの内部は指定した実寸で、親ページだけで縮小する。

- 再生・停止はSpace、1コマ移動は左右キー、Shiftと左右キーで1秒、Home/Endで先頭/末尾。入力欄では通常のキー操作を優先する。
- タイムラインの演出は対象とプロパティでまとめ、バーを押すと開始時刻へ移動する。未来の演出はその時刻まで再生すると記録される。
- 「枠線」は配置の境界を表示する。`outside`は画面との矩形比較で、意図的な画面外の絵やクリップも含む。自動的に不具合と断定しない。
- 戦闘の仲間、敵1〜4体、HP、種を変更し、「操作を追加」で時刻とボタンのaria-labelを指定する。「配置」で取得できるラベルを使う。画面内でボタンの中央を押せない指定はエラーになる。
- 「シナリオJSON」で条件を保存し、読み込みで復元する。「PNG撮影コマンドをコピー」で同じ条件・時刻のCLIコマンドを得る。「検証JSON」はゲーム状態・配置・演出・操作・本文・エラーを出力する。
- 「コンポーネント・演出」ではゲームで使うWord、Revolver、隊列、閃光、カットイン、ダメージ、集中線を動かす。

能力を実装していない人物は同ロールの既存データを元に表示用の能力を作る。数値はゲームの完成したバランスではなく、作品JSONへも書き戻さない。隊列と乱数の種は保存付きの場面にも適用する。敵とHPの指定は組み合わせ戦闘で行う。開始状態は `development/scenarios/` で作り、通常プレビューにも共有する。Reactは共通の `GameApp` にその状態・消費済みの乱数環境を注入し、初期化で乱数やIDを二重消費しない。

深い探索の見本は初期隊列で到達できるよう、復元境界でHP・疲れ・ワザ回数を回復してから同じエンジンの操作を行う。掘り出し物の見本は初期ガラクタを3個用意して通常の鑑定を行う。いずれも開発用の開始条件で、戦闘・報酬・鑑定の規則を差し替えない。画像はその場面の使用分を先にデコードし、読み込みエラーは表示する。

## CLI

開発サーバーを起動してから実行する。PlaywrightのChromiumが必要。未導入の環境は `bunx playwright install chromium`。場面・仲間・敵のslugと初期条件は `vp run studio list` で取得できる。

```sh
# 仲間と敵とHPを指定した戦闘の2秒後
vp run studio capture --party hero,rivet,husky --foes haribote-adult,hiyokobu --hp 100,25,0 --seed 77 --at 2000 --out /tmp/battle.png

# 4秒後に狙っている敵へ放ち、その500ms後を撮る
vp run studio capture --actions '[{"at":4000,"label":"放つ"}]' --at 4500 --out /tmp/attack.png

# カットインの登場・保持・退場をまとめる
vp run studio frames --scene components --actions '[{"at":1000,"label":"カットイン"}]' --times 0,1000,1600,2600 --out /tmp/cut-in

# 施設内のメニューも台本と停止時刻を自動適用
vp run studio capture --scene guild-quests --out /tmp/quests.png
vp run studio capture --scene room-night-choice --out /tmp/choice.png

# UIで保存した条件を再利用
vp run studio capture --config /tmp/battle.json --at 2000 --size 1280x800 --out /tmp/wide.png
vp run studio inspect --config /tmp/battle.json --at 2000 --out /tmp/inspection.json
```

PNGと同名の `.inspection.json` を保存する。`frames` は指定順のPNG・検証JSON・`manifest.json`・`contact-sheet.png` を生成する。時刻はms、最大60秒。`--guides`で枠線を含め、`--base-url`または`E2E_BASE_URL`でサーバーを指定する。開発サーバーの再読み込みを避けるため、出力先は `/tmp` または `node_modules/.cache/studio` にする。

操作が実行できなかった場合も、失敗した画面とエラーを含む検証JSONを保存して非ゼロで終了する。初期条件の不備は起動時に理由を返す。

`--verify`は同じ条件を2回描画し、PNGのSHA-256を完全一致で比較する。不一致を許容して成功にはしない。不一致時は通常PNGに加えて `.repeat.png`・`.diff.png`・両方の検証JSONを保存し、非ゼロで終了する。同じゲーム状態・配置・補間値でも、Chromeの小さい回転画像のラスタライズに差が残る中間フレームを確認している。全時刻・別OS・別ブラウザで画素まで一致する保証はまだない。

## 実装の境界

`StudioRuntime` は仮想時計とアニメーションの寿命を持つ。橋渡しの型は [[client/dev/studio-types.ts]]、DOMの計測・ガイド・押せる対象の探索は `studio-dom.ts`。DOMの補助処理からゲーム状態や時計を進めない。

条件入力は `studio-conditions.tsx`、再生とフレームの操作は既存の再生フックが持つ。戦闘では進行管理の `BattleDirector` と一行動の結果を見せる `result-playback.ts` を分け、どちらもゲームの数値や行動結果を決めない。

## AIからの操作

`/dev/frame/{scene}?config={JSON}` は単独でゲームを開く。JSONはURLエンコードする。初期化エラーは `window.__devStudioError`、操作可能な起動状態と処理完了は `window.__devStudio.ready` と `settled` を確認する。最初の画面は `advance` が指定時刻の描画を終えてから表示する。それ以前の `snapshot` は拒否する。初期化中のエラーと終了時には表示待ちを解除する。単独フレームの起動待ちは [[scripts/studio-browser.ts]] の `waitForStudio` を使う。フレーム内のrAF・タイマーは仮想時計で止まるため、起動前後で捕まえた時計に左右されないよう、監視はNode側の時計で行う。

```ts
await window.__devStudio.advance(2000)
const result = await window.__devStudio.snapshot()
window.__devStudio.inspect()
window.__devStudio.guides(true)
window.__devStudio.click("放つ")
window.__devStudio.configure(config)
```

`advance`は前進だけ。逆戻りは`configure`で初期化してから進める。再現用のボタン操作は`config.actions`に入れる。`click`は aria-label か `data-action` が一致する要素の、他の部品に隠れていない点を押す（真ん中から外へ探す）。タイマー・rAF・見た目の乱数・Web AnimationsとCSSのアニメーションをiframe内で制御し、本物の保存にはMemoryStorageで触れない。Reactとゲームエンジンの規則は共有する。motion の描画ループは読み込み時の本物の requestAnimationFrame を使うので、仮想の時計のフレームごとにスタジオが回し、本物のフレームからは回さない。絵の読み込み（`loadArtwork`）は実時間で終わるので、時計を進める前に読み終わりを待つ。予約が尽きても、待ちの続きが新しく予約しないことを確かめてから指定時刻へ飛ぶ。そのため一度に進めても刻んで進めても同じ状態になる。


フレームを終了すると、ブラウザの描画完了を待つ処理も `AbortError` で中断し、予約済みの実フレームを取り消す。待っているのが一枚目でも二枚目でも、終了後のコールバックから次の予約を作らない。正常時は従来どおり二枚の実フレームを待ち、その後にアニメーションの時刻を書き直さない。最初の指定時刻までの中間描画を表示しないことで、現行Chromiumの2秒後のPNG完全一致は受入チェックを通過した。全時刻・別OS・別ブラウザの一致は別途検証する。

## 受入の実行

`vp run e2e:studio` で指定隊列・敵・HP、2秒後の画像一致、演出の進行、800msのカットインの途中表示と退場、保存保護、iframe実寸、巻き戻し、コマ送り、再生停止、場面のパス遷移、JSONの書き出し・復元、キー操作を確認する。成果物は `node_modules/.cache/studio/acceptance` に保存する。失敗時も画面と状態を保存する。

スタジオの検証で、`components/canvas/play.ts` の個別transitionが共通のduration・delay・repeatを引き継いでいなかった不具合を発見した。`inherit: true` を渡し、指定した800msのカットインが600ms後にも残り、所定の時間に退場することを実画面で確認する。

`vp run e2e:layouts` は登録済み場面×3サイズのPNGと検査JSONを `node_modules/.cache/studio/layouts` に出力し、起動・台本・ゲーム状態・エラーと一覧の検索・サイズ切替を確認する。`LAYOUT_SCENES` と `LAYOUT_VIEWPORTS` で問題の場面を指定して再確認できる。共有の時間基準と戦闘の完了条件は [[animation-rules|演出時間と再現のルール]]。

## 会話の確認と再生

`/dev/conversations` は上部に本番と共通の `EventConversationView` / `Conversation` によるプレビュー、その下にセリフのタイムラインを表示する。条件設定なしで表示でき、セリフを選ぶとその位置から再生する。プレビューで進めた位置もタイムラインへ反映する。

会話一覧は宿・宝箱・分岐・アイテム入手の全件を場面別に並べ、人物・タイトル・セリフで検索できる。デバッグ条件と場面の絞り込みは設けない。編集・保存・書き出し機能も設けない。

会話も他のデータページと同じ `/dev/$category/$entry` で開く。例えば `/dev/conversations/alda-mayu-inn`。共通のカテゴリ画面とナビゲーションを使い、選択した会話と場面はURLから復元する。存在しない会話IDはカテゴリ一覧へ戻す。
