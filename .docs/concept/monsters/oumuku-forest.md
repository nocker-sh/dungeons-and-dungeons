---
{
  "entity": "[[concept/lore/monsters/oumuku-forest.json]]"
}
---

# リーフパロット

## 暮らし（制作案）

葉のような冠羽と、黄土色の翼の先を持つエコーパロットの個体差。片足で立ち、もう片方の足でつかんだ拾い物をくちばしの近くへ持ち上げて、時間をかけて確かめる。気に入らなければ手すりの外へ落とす。まねる声は小さく、ひとりごとのように聞こえる。

倒れたあと、確かめていた途中の歯車が足もとに転がる。

## 制作上の決め事（確定）

- 脚は二本。片足で立ち、もう片方をくちばしの近くへ上げる姿を保つ（ユーザー指定）。

## 未決定

- 数値とワザは既存の同じ深さの敵を基準にした暫定値。仲間化は未設定。

## 制作メモ

同じ種の特徴を残し、形と大きな模様を変えた姿。

制作時の形の指示：Muted olive green and ivory parrot, crown becomes THREE broad leaflike swept-back feathers, hooked charcoal beak kept, broad ochre stripe at each wing tip, wider compact body and two feet. Same clever tilted face and eyes directed viewer.

## 画像から確認した造形

緑の翼と黄色い翼先、白顔と大黒嘴。旧一様緑の案と羽先の配色を区別。

## 攻撃の動作と画像

攻撃の内容を先に決める制作定義。攻撃名と近接・遠距離は実行用JSON、ワザの効果と確率は content のJSONを正とし、数値は引き続き暫定値。共通の[[monster-attacks|攻撃仕様]]を使う。

通常攻撃：二枚の翼で体を支え、元の足の鉤爪で前を蹴る。

- 対応ワザID：`d1d46bed-7671-42b0-90c1-e330a16f3fec`。本人の翼、ハサミ、または手の払いに合わせて、少数の角張った風を前へ飛ばす。部位を別種から借りない。

顔と視線、打撃面や飛び道具の先端・軌道は画面手前のプレイヤーへ向ける。横や地面への攻撃にしない。手前ほど大きく、発射元と重なる遠近で示す。通常と並べ、顔・目と瞳・体形・部位数・接続・固有模様・殻や翼の比率を確認する。元PNG・参照・プロンプト・生成出力の記録は [[concept/prompts/monster-attacks.json]]。人の画像承認はAIの確認と分ける。
