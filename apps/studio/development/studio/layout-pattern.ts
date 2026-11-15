import { contentSource } from "@/content/game-content"
import { placeSlug } from "@/content/looks/place-slug"
import { shopLook } from "@/content/looks/shop-look"
import { street } from "@/content/looks/street"
import type { LayoutPattern } from "@/development/studio/patterns"
import { pattern } from "@/development/studio/pattern"

export const layoutPatterns: LayoutPattern[] = [
  pattern("guild-quests", "ギルド：クエスト", "reception", ["クエスト"]),
  pattern("guild-recruits", "ギルド：募集", "reception", ["募集"]),
  pattern("guild-talk", "ギルド：会話", "reception", ["会話"]),
  pattern("secret", "秘密の部屋：悪魔との契約", "guild", ["秘密の部屋"]),
  // 契約した悪魔の一覧は、部屋に入ると最初に出る
  pattern("secret-demons", "秘密の部屋：契約した悪魔", "guild", ["秘密の部屋"]),
  pattern("secret-result", "秘密の部屋：出会い", "guild", [
    "秘密の部屋",
    "新しい出会い",
    "赤糸の悪魔ヌイ",
    "話を聞く",
  ]),
  pattern("bag-detail", "バッグ：道具の詳細", "bag", ["回復薬"]),
  // 夜への切り替えと、成長した能力値の数え上げまで見届ける。
  pattern("room-levelup", "宿：レベルアップ", "room-growth", ["泊まる"], 6000),
  pattern("room-night-talk", "宿：夜の会話", "room-normal", [
    "泊まる",
    "雑談する",
  ]),
  pattern("room-night-choice", "宿：会話の選択肢", "room-normal", [
    "泊まる",
    "雑談する",
    "会話を進める",
    "会話を進める",
    "会話を進める",
    "会話を進める",
  ]),
  // 満タンの仲間は選べないので、2人目が傷ついた場面で開く
  pattern("bag-target", "バッグ：使う相手", "bag-hurt", ["回復薬", "使う"]),
  pattern("stand-equipment", "仲間：装備", "stand", ["装備"]),
  // 最初の手番は2人目（主人公でない）なので「スキル」
  pattern("battle-skills", "戦闘：スキル選択", "battle", ["スキル"]),
  pattern("battle-items", "戦闘：アイテム選択", "battle", ["アイテム"]),
  pattern("battle-target", "戦闘：使う相手", "battle", ["アイテム", "使う"]),
  {
    ...pattern("battle-four", "戦闘：敵4体", "battle", []),
    foes: ["kamokutsu", "hiyokobu", "kamokutsu", "hiyokobu"],
  },
  {
    ...pattern("battle-low-hp", "戦闘：瀕死・倒れた仲間", "battle", []),
    hp: [100, 25, 0],
  },
  ...street().flatMap((id) => {
    const shop = shopLook(id)
    const scene = placeSlug(shop.place).replace(/^place-/, "shop-")
    const shopContent = contentSource.shops.find((entry) => entry.id === id)
    const menus =
      shop.kind === "smithy"
        ? ["強化", "生産", "修理", "会話"]
        : [
            "購入",
            "売却",
            "会話",
            ...(shopContent?.appraise?.length ? ["鑑定"] : []),
          ]
    return menus.map((menu) =>
      pattern(
        `${scene}-${({ 購入: "buy", 売却: "sell", 会話: "talk", 鑑定: "appraise", 強化: "upgrade", 生産: "craft", 修理: "repair" } as Record<string, string>)[menu]}`,
        `${shop.name}：${menu}`,
        menu === "修理" ? "smithy-repair" : scene,
        [menu]
      )
    )
  }),
  ...contentSource.rooms.map((room) =>
    pattern(
      `room-${room.slug}-rest`,
      `宿：${room.name}で休む`,
      `room-${room.slug}`,
      ["泊まる"],
      6500
    )
  ),
]

export function layoutPattern(slug: string) {
  return layoutPatterns.find((entry) => entry.slug === slug)
}
