import { slotOf } from "@/lib/wiz/content/slot-of"
import type { ContentVerification } from "@/lib/wiz/content/content-verification/context"

export function verifyMembers({ catalog, need }: ContentVerification) {
  const data = catalog.data

  const members = [...data.party, ...data.recruits.map((entry) => entry.member)]
  need(
    data.party.filter((entry) => entry.hero).length === 1,
    "最初からいる仲間には主人公がちょうど一人必要"
  )
  need(
    new Set(data.hero.looks).size === data.hero.looks.length,
    "主人公の外見の候補が重複している"
  )
  need(
    !data.recruits.some((entry) => entry.member.hero),
    "募集に主人公は入れられない"
  )
  // R の仲間は悪魔と契約して戦う（武器も防具も持たず、ケイヤクでモードを変える）
  for (const entry of data.recruits)
    if (entry.rank === "R" && !entry.retired)
      need(
        entry.member.pact,
        `R の仲間 ${entry.member.id} に契約（pact）がない`
      )
  for (const entry of members) {
    if (entry.pact) {
      const modes = entry.pact.modes
      need(
        modes[0]?.level === 1,
        `${entry.id} の最初のモードはレベル1から選べるようにする`
      )
      need(
        modes.every(
          (mode, index) => index === 0 || mode.level > modes[index - 1].level
        ),
        `${entry.id} のモードはレベルの低い順に並べる`
      )
      for (const mode of modes) {
        const good = catalog.good(mode.weapon)
        need(
          good?.kind === "weapon" && good.skills?.length === 3,
          `${entry.id} のモード ${mode.weapon} は3つのワザを持つ武器の品物にする`
        )
      }
      need(
        new Set(modes.map((mode) => mode.weapon)).size === modes.length,
        `${entry.id} のモードが重複している`
      )
      need(
        !entry.unique &&
          !entry.weapon &&
          !entry.fixedArmor &&
          !entry.gear?.length,
        `${entry.id} は契約の仲間なので、武器・防具・ユニークを持たせない`
      )
    }
    const schools = new Set(entry.schools ?? [])
    need(
      schools.size === (entry.schools?.length ?? 0),
      `${entry.id} の流派が重複している`
    )
    // 主人公の流派は合体している悪魔で決まるので、データの流派とは照らさない
    need(
      !entry.hero || !entry.schools,
      "主人公の流派は悪魔で決まるので schools は書かない"
    )
    // 流派の合わない固有スキルは、戦闘で選べない印を付けるだけにする（拒否はしない）。
    // どの流派を使えるかは主人公では悪魔で変わるので、データの段階では決まらない。
    for (const skill of entry.skills) {
      need(catalog.skill(skill), `${entry.id} のスキル ${skill} がない`)
      need(
        catalog.skill(skill)?.uses,
        `${entry.id} のスキル ${skill} に使用回数（uses）がない`
      )
    }
    need(
      catalog.good(entry.defaultWeapon)?.kind === "weapon",
      `${entry.id} の素の武器 ${entry.defaultWeapon} がない`
    )
    if (entry.unique)
      need(
        catalog.good(entry.weapon ?? "")?.kind === "weapon",
        `ユニークの仲間 ${entry.id} に固有の武器（weapon）がない`
      )
    need(
      !entry.fixedArmor || entry.unique,
      `${entry.id} の fixedArmor は unique の仲間にだけ付ける`
    )
    if (entry.weapon)
      need(
        catalog.good(entry.weapon)?.kind === "weapon",
        `${entry.id} の武器 ${entry.weapon} がない`
      )
    for (const gear of entry.gear ?? []) {
      const good = catalog.good(gear)
      need(
        good && (good.kind === "weapon" || good.kind === "armor"),
        `${entry.id} の装備 ${gear} がない`
      )
      if (good && !entry.unique)
        need(
          catalog.canEquip(entry.id, good.id),
          `${entry.id} の初期装備 ${gear} は職業が合わない`
        )
    }
    // 最初から着けている装備は部位ごとに一つ（そうでないと初期状態が作れない）
    const slots = new Set<string>()
    for (const gear of [
      ...(entry.weapon ? [entry.weapon] : []),
      ...(entry.gear ?? []),
    ]) {
      const good = catalog.good(gear)
      if (!good) continue
      const slot = slotOf(good)
      need(
        !slots.has(slot),
        `${entry.id} の最初の装備が同じ部位（${slot}）で重なっている`
      )
      slots.add(slot)
    }
  }
}
