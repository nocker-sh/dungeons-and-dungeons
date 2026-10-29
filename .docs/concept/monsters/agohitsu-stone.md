---
{
  "entity": "[[concept/lore/monsters/agohitsu-stone.json]]"
}
---

# サバトホーン

## 暮らし（制作案）

灰色の毛に白い稲妻の縞が走る、サバトゴートの個体差。横へ張り出した黄土色の角を祭壇の石柱で研ぐ癖があり、柱の低いところにはこすった跡が並ぶ。かじる物は同じだが、紙より固い封蝋を好む。

倒れたあと、研いでいた角の削りかすが黄土色の粉になって足もとに残る。

## 未決定

- 数値とワザは既存の同じ深さの敵を基準にした暫定値。仲間化は未設定。

## 制作メモ

同じ種の特徴を残し、形と大きな模様を変えた姿。

制作時の形の指示：SUBSPECIES of same sheep monster with hanging long angular beard. Dusty slate wool with cream beard, squat broad four-legged body, two big blocky sideways crooked ochre horns rather than short upright horns; three broad cream zigzag stripes on flanks. Same sleepy clever gaze toward viewer. No clothing.

## 画像から確認した造形

幅広の巻いた金角、白いジグザグ胴模様、灰緑四足。短角の元種と区別。

## 攻撃の動作と画像

攻撃の内容を先に決める制作定義。攻撃名と近接・遠距離は実行用JSON、ワザの効果と確率は content のJSONを正とし、数値は引き続き暫定値。共通の[[monster-attacks|攻撃仕様]]を使う。

通常攻撃：元の蹄を前へ出す。

- 対応ワザID：`871cd85b-2b84-4d04-a8f8-56a8a84ab34a`、`2ef5781b-1583-4562-91da-7a26f6866d66`。本人の目や両手の前から角張った呪いの波を放つ。眼の発光や追加の瞳で表現しない。
- 対応ワザID：`b32f5694-90f9-4180-a703-7cc3bf39fb7a`。通常攻撃と同じ部位・動作を使う。本人の輪郭を固定し、威力や状態効果は戦闘の結果演出で示す。

顔と視線、打撃面や飛び道具の先端・軌道は画面手前のプレイヤーへ向ける。横や地面への攻撃にしない。手前ほど大きく、発射元と重なる遠近で示す。通常と並べ、顔・目と瞳・体形・部位数・接続・固有模様・殻や翼の比率を確認する。元PNG・参照・プロンプト・生成出力の記録は [[concept/prompts/monster-attacks.json]]。人の画像承認はAIの確認と分ける。
