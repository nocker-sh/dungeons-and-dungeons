---
{
  "entity": "[[concept/lore/monsters/haribote-moss.json]]"
}
---

# アンバーホッグ

## 暮らし（制作案）

洞窟の湿った奥に住むジェムホッグの個体差。苔色の毛に白い縞が走り、背の結晶は苔と泥に染まって琥珀色にくすんでいる。結晶を寝かせ気味に並べ、湿った岩に背中を押しつけて冷やす。

倒れたあと、苔の下から結晶が出てくる。

## 未決定

- 数値とワザは既存の同じ深さの敵を基準にした暫定値。仲間化は未設定。

## 制作メモ

同じ種の特徴を残し、形と大きな模様を変えた姿。

制作時の形の指示：SUBSPECIES of same hedgehog. Muted moss green and cream fur, short wider triangular ochre backspikes laid sideways, two broad cream flank bands, shorter ears and wide low four-legged body. Same cute face toward viewer.

## 画像から確認した造形

緑白帯の胴、黄金の背結晶、黒足。赤結晶のジェムホッグと混ぜない。

## 攻撃の動作と画像

攻撃の内容を先に決める制作定義。攻撃名と近接・遠距離は実行用JSON、ワザの効果と確率は content のJSONを正とし、数値は引き続き暫定値。共通の[[monster-attacks|攻撃仕様]]を使う。

通常攻撃：四足獣の前脚と重い胴を前へ出す。

- 対応ワザID：`876376fe-bbcf-420c-9e0d-247a8de30481`。通常攻撃と同じ部位・動作を使う。本人の輪郭を固定し、威力や状態効果は戦闘の結果演出で示す。
- 対応ワザID：`9f72649e-cc75-4e44-8424-1c7841ec2eeb`。四足を踏ん張り、背中の結晶を身震いで前へ撒く。結晶の色は本人の背中と揃え、全部を消さない。

顔と視線、打撃面や飛び道具の先端・軌道は画面手前のプレイヤーへ向ける。横や地面への攻撃にしない。手前ほど大きく、発射元と重なる遠近で示す。通常と並べ、顔・目と瞳・体形・部位数・接続・固有模様・殻や翼の比率を確認する。元PNG・参照・プロンプト・生成出力の記録は [[concept/prompts/monster-attacks.json]]。人の画像承認はAIの確認と分ける。
