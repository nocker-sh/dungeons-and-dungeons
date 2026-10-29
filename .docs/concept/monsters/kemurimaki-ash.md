---
{
  "entity": "[[concept/lore/monsters/kemurimaki-ash.json]]"
}
---

# アッシュレイス

## 暮らし（制作案）

2層・錆びた鉄橋に住みついた、灰色の煙の魔物。鉄骨のすすと錆の粉を巻きこみ、黄土色のまだらを浮かべた二本の巻き角を立てる。通ったあとの手すりは黒く汚れ、冒険者の作業着にもすすが移る。

倒れたあと、すすの山の中に錆びた歯車が埋まっている。

## 未決定

- 数値とワザは既存の同じ深さの敵を基準にした暫定値。仲間化は未設定。

## 制作メモ

同じ種の特徴を残し、形と大きな模様を変えた姿。

制作時の形の指示：Warm grey smoke with dusty ochre patches; wider low smoky head and TWO separate angular smoke curls branching upward, zigzag tail. Friendly strange face, flat eyes directed viewer. Sparse dots only, no blur.

## 画像から確認した造形

砂灰の煙、二つの巻きと黒点眼。紫の煙や炎を混ぜない。

## 攻撃の動作と画像

攻撃の内容を先に決める制作定義。攻撃名と近接・遠距離は実行用JSON、ワザの効果と確率は content のJSONを正とし、数値は引き続き暫定値。共通の[[monster-attacks|攻撃仕様]]を使う。

通常攻撃：本人の灰煙の塊を前へ出す。

- 対応ワザID：`84b5c834-0808-49c0-b9ba-2f5bcb9e084b`。通常攻撃と同じ部位・動作を使う。本人の輪郭を固定し、威力や状態効果は戦闘の結果演出で示す。

顔と視線、打撃面や飛び道具の先端・軌道は画面手前のプレイヤーへ向ける。横や地面への攻撃にしない。手前ほど大きく、発射元と重なる遠近で示す。通常と並べ、顔・目と瞳・体形・部位数・接続・固有模様・殻や翼の比率を確認する。元PNG・参照・プロンプト・生成出力の記録は [[concept/prompts/monster-attacks.json]]。人の画像承認はAIの確認と分ける。
