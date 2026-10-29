---
{
  "entity": "[[concept/lore/monsters/washinoko-snow.json]]"
}
---

# アッシュホーク

## 暮らし（制作案）

灰色の羽を持つボーンホークの個体差。胸に二本の黒い山形の帯が入り、骨の山に止まると灰をかぶった骨と見分けがつかない。骨を割るのも、骨の山の上でじっと待ってから始める。

倒れたあと、灰色の羽が骨片に混じって残る。

## 未決定

- 数値とワザは既存の同じ深さの敵を基準にした暫定値。仲間化は未設定。

## 制作メモ

同じ種の特徴を残し、形と大きな模様を変えた姿。

制作時の形の指示：Offwhite and dusty grey plumage, asymmetrical shorter fan-shaped brow feathers, two broad dark chevrons across chest, wide feathered feet. Same eagle chick silhouette and open beak, eyes toward viewer.

## 画像から確認した造形

灰白の翼、胸の白V字、黄色い嘴足。雪を青い氷結晶として足さない。

## 攻撃の動作と画像

攻撃の内容を先に決める制作定義。攻撃名と近接・遠距離は実行用JSON、ワザの効果と確率は content のJSONを正とし、数値は引き続き暫定値。共通の[[monster-attacks|攻撃仕様]]を使う。

通常攻撃：二枚の翼で体を支え、元の足の鉤爪で前を蹴る。

- 対応ワザID：`a9742f96-76fc-477c-bd58-ce2b6f9f6ea3`、`319a9920-9562-4e02-bcaf-98d3ae14f013`。通常攻撃と同じ部位・動作を使う。本人の輪郭を固定し、威力や状態効果は戦闘の結果演出で示す。

顔と視線、打撃面や飛び道具の先端・軌道は画面手前のプレイヤーへ向ける。横や地面への攻撃にしない。手前ほど大きく、発射元と重なる遠近で示す。通常と並べ、顔・目と瞳・体形・部位数・接続・固有模様・殻や翼の比率を確認する。元PNG・参照・プロンプト・生成出力の記録は [[concept/prompts/monster-attacks.json]]。人の画像承認はAIの確認と分ける。
