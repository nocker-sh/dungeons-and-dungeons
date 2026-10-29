---
{
  "entity": "[[concept/lore/monsters/mitsuashi-marsh.json]]"
}
---

# スワンプアイ

## 暮らし（制作案）

湿った泥の多い場所に住むスクラップアイの個体差。苔色のずんぐりした体で、腹には太い縞が並ぶ。尾はシャベルの形で、鉄くずを拾うより、泥に埋まった物を掘り出して積む。

積んだ山はいつも泥で汚れていて、倒れたあと、泥のついた歯車が山から転がり出る。

## 未決定

- 数値とワザは既存の同じ深さの敵を基準にした暫定値。仲間化は未設定。

## 制作メモ

同じ種の特徴を残し、形と大きな模様を変えた姿。

制作時の形の指示：Muted moss green with cream belly; squat wide body, asymmetrical eye stalks bent outward, short broad shovel tail, three broad dark bands across belly. Exactly TWO legs. Keep goofy fang and watchful stalk-eyes aimed at viewer.

## 画像から確認した造形

淡緑の眼柄獣、白腹の緑横帯、二眼柄と大足。青緑のスクラップアイと配色を区別。

## 攻撃の動作と画像

攻撃の内容を先に決める制作定義。攻撃名と近接・遠距離は実行用JSON、ワザの効果と確率は content のJSONを正とし、数値は引き続き暫定値。共通の[[monster-attacks|攻撃仕様]]を使う。

通常攻撃：大足を前へ出し、二本の目の柄と尾を保つ。

- 対応ワザID：`20196775-1b91-4425-954b-a67b54e00cef`。ため込んだ鉄塊を画面手前のプレイヤーへ放つ。目の柄を腕として描かず、短い腕を引き伸ばさない。
- 対応ワザID：`c2576d5a-ca55-4beb-ac73-7884f9dcea47`。本人の手、または城門の内側から歯車を前へ放つ。歯車は体の部品にしない。

顔と視線、打撃面や飛び道具の先端・軌道は画面手前のプレイヤーへ向ける。横や地面への攻撃にしない。手前ほど大きく、発射元と重なる遠近で示す。通常と並べ、顔・目と瞳・体形・部位数・接続・固有模様・殻や翼の比率を確認する。元PNG・参照・プロンプト・生成出力の記録は [[concept/prompts/monster-attacks.json]]。人の画像承認はAIの確認と分ける。
