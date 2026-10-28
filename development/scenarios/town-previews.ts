import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import type { PreviewStart } from "@/client/dev/preview-start"
import { seededEnvironment } from "@/development/seeded-environment"
import type { Preview } from "@/development/scenarios/types"
import type { PreviewContext } from "@/development/scenarios/context"
import type { createEquipmentScenarios } from "@/development/scenarios/equipment"
export function townPreviews(
  context: PreviewContext,
  equipment: Pick<
    ReturnType<typeof createEquipmentScenarios>,
    "rareWeapons" | "outfitStand"
  >
): Preview[] {
  const { content, seedOffset, play, prepared, town, party, remember } = context
  const { rareWeapons, outfitStand } = equipment

  return [
    {
      slug: "create",
      title: "開幕：夜の森の焚き火",
      start: (): PreviewStart => {
        // 本物の「はじめから」（街へ着く前の開幕）。作る前なので play() は使わない
        const environment = seededEnvironment(1 + seedOffset)
        const game = new GameDefinition(content).create(environment)
        return {
          content,
          environment,
          save: game.save(),
          initialState: game.state,
          screen: { name: "create" },
        }
      },
    },
    {
      slug: "registration",
      title: "ギルドの受付：登録用紙",
      start: (): PreviewStart => {
        // 開幕を終えて街へ着いた直後（名前と写真の登録待ち）
        const environment = seededEnvironment(1 + seedOffset)
        const game = new GameDefinition(content).create(environment)
        remember(game, environment)
        inPhase(game, "creating")?.leaveCamp()
        return prepared(game, { name: "place", place: "reception" })
      },
    },
    { slug: "town", title: "街", start: town },
    {
      slug: "quick-quests",
      title: "ギルド：街・農場のクエスト",
      start: () => ({
        ...town(),
        screen: { name: "quests" },
      }),
    },
    {
      slug: "town-scenes",
      title: "街（場所に入ったときの場面あり）",
      start: () => ({ ...town(), visitScenes: true }),
    },
    {
      slug: "town-opening",
      title: "街：起動時",
      start: () => prepared(play(1), { name: "town", intro: true }),
    },
    {
      slug: "room-growth",
      title: "宿：成長前",
      start: () => {
        const game = play(1)
        const growing = game.queries
          .party(game.state)
          .find((member) => !member.hero)
        if (!growing) throw new Error("成長を確認できる仲間がいません")
        const saved = game.save()
        const failed = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            members: saved.snapshot.members.map((member) =>
              member.id === growing.id
                ? { ...member, exp: growing.next }
                : member
            ),
          },
        })
        if (failed) throw failed
        const room = content.rooms.find((entry) => entry.levelUp)!
        return prepared(game, { name: "room", room: room.id })
      },
    },
    {
      slug: "bag",
      title: "街＋バッグ",
      start: () => ({ ...town(), overlay: { kind: "bag" } }),
    },
    {
      slug: "bag-hurt",
      title: "街＋バッグ（傷ついた仲間）",
      start: () => {
        // 回復の対象選び用。2人目だけHPが減っている（満タンの仲間は選べない）
        const game = play(1)
        const saved = game.save()
        const hurt = saved.snapshot.party[1]
        const failed = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            members: saved.snapshot.members.map((member) =>
              member.id === hurt
                ? { ...member, hp: Math.ceil(member.hp / 2) }
                : member
            ),
          },
        })
        if (failed) throw failed
        return prepared(game, { name: "town" }, { kind: "bag" })
      },
    },
    {
      slug: "bag-rare",
      title: "街＋バッグ（掘り出し物の武器）",
      start: () => ({
        ...prepared(rareWeapons(), { name: "town" }, { kind: "bag", tab: 1 }),
      }),
    },
    {
      slug: "stand",
      title: "街＋立ち絵",
      start: () => ({
        ...town(),
        overlay: { kind: "stand", member: party()[0] },
      }),
    },
    {
      slug: "guild",
      title: "冒険者ギルド",
      start: () => prepared(play(1), { name: "place", place: "guild" }),
    },
    {
      slug: "reception",
      title: "冒険者ギルド＋受付",
      start: () => prepared(play(1), { name: "place", place: "reception" }),
    },
    {
      slug: "inn",
      title: "冒険者ギルド＋宿",
      start: () => prepared(play(1), { name: "place", place: "inn" }),
    },
    {
      slug: "street",
      title: "商店街",
      start: () => prepared(play(1), { name: "place", place: "shop" }),
    },
    ...[0, 1, 2].map((tab) => ({
      slug: `bag-tab-${tab}`,
      title: `バッグ：${["アイテム", "装備", "素材"][tab]}`,
      start: () => prepared(play(1), { name: "town" }, { kind: "bag", tab }),
    })),
    ...play(1).state.party.map((id, index) => ({
      slug: `stand-${index}`,
      title: `仲間：隊列${index + 1}`,
      start: () =>
        prepared(play(1), { name: "town" }, { kind: "stand", member: id }),
    })),
    {
      slug: "stand-outfits",
      title: "装備による着替え",
      start: outfitStand,
    },
  ]
}
