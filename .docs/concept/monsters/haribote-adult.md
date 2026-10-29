---
{
  "entity": "[[concept/lore/monsters/haribote-adult.json]]"
}
---

# ジェムロード

## 暮らし（制作案）

背の結晶を長年刺し足し、城壁のように広げた大人のジェムホッグ。体は低く重くなり、結晶はもう自分では直せないほど大きく、歩くたびに鳴る。それでも顔だけは幼いころのまま、口を開けて笑っているように見える。

## 守っているもの（制作案）

0層の奥にある巣穴。巣穴では幼い個体が眠っており、大人はその入口の細い道に伏せて、近づくものを背の結晶ごと押し返す。冒険者にとっては、洞窟の奥へ進むたびに通らなければならない道をふさぐ番人。

追い払っても巣穴はそこにあり、次に来るときも同じ場所に伏せている。

倒れたあと、背から外れた結晶が道いっぱいに散らばる。拾い集めるのも仕事のうち。

## 制作上の決め事（確定）

- 幼体より頭と目の比率を小さくし、体・脚・背の針を大きくした大人。

## 未決定

- 数値とワザは既存の同じ深さの敵を基準にした暫定値。既存のボス枠を引き継ぐ。仲間化は未設定。

## 制作メモ

同じ種の特徴を残し、形と大きな模様を変えた姿。攻撃絵は、後脚で押し出し、前脚を広く踏み込んだ突進中の姿。

制作時の形の指示：GROWN ADULT BOSS of same blue-grey hedgehog creature. Much massive long low quadruped torso, heavy wide shoulders, head smaller relative to body, eyes only 35% juvenile relative eye size. FOUR huge broad dull brick-red dorsal spikes splay outward like ramparts rather than vertical young spines. Cream face and belly, broad slate cheek patch. Keep endearing face and four feet, aim face/eyes at viewer. No armor.

## 画像から確認した造形

大きな白青四足獣、赤結晶と大きな拳。小型の体型を単に引き伸ばさない。

## 攻撃の動作と画像

攻撃の内容を先に決める制作定義。攻撃名と近接・遠距離は実行用JSON、ワザの効果と確率は content のJSONを正とし、数値は引き続き暫定値。共通の[[monster-attacks|攻撃仕様]]を使う。

通常攻撃：四足獣の前脚と重い胴を前へ出す。

- 対応ワザID：`9f72649e-cc75-4e44-8424-1c7841ec2eeb`。四足を踏ん張り、背中の結晶を身震いで前へ撒く。結晶の色は本人の背中と揃え、全部を消さない。
- 対応ワザID：`876376fe-bbcf-420c-9e0d-247a8de30481`。通常攻撃と同じ部位・動作を使う。本人の輪郭を固定し、威力や状態効果は戦闘の結果演出で示す。

顔と視線、打撃面や飛び道具の先端・軌道は画面手前のプレイヤーへ向ける。横や地面への攻撃にしない。手前ほど大きく、発射元と重なる遠近で示す。通常と並べ、顔・目と瞳・体形・部位数・接続・固有模様・殻や翼の比率を確認する。元PNG・参照・プロンプト・生成出力の記録は [[concept/prompts/monster-attacks.json]]。人の画像承認はAIの確認と分ける。
