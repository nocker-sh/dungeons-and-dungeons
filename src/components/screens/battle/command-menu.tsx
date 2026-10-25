import { Revolver } from "@/components/stage/revolver"
import { Word } from "@/components/stage/word"
import { UI_LAYER } from "@/components/canvas/tokens"
import { skillNote, type Commands } from "@/components/screens/battle/types"

/**
 * 手番の仲間への指示。武器3枠と祝福1枠をリボルバーに並べ、
 * キャラ固有・悪魔スキルは別メニューに置き、「防御」「アイテム」も出す。
 * 使える手が尽きたときだけ「殴る」が出る。悪魔と契約して戦う仲間（R）には「ケイヤク」が出る。
 * ワザは選んでから狙っている敵を押して放つ（選んでいる札をもう一度押しても放つ）。
 * 押したときの中身は持たない。
 */
export function CommandMenu({
  commands,
  hero,
  wide,
  selected,
  onSelect,
  onWeaponSkill,
  onSkills,
  onGuard,
  onItems,
  onBrawl,
  onPact,
}: {
  commands: Commands
  /** 主人公は悪魔と合体してスキルを使う。 */
  hero: boolean | undefined
  wide: boolean
  /** リボルバーで選んでいる武器のワザ。 */
  selected: number
  onSelect: (index: number) => void
  onWeaponSkill: (id: string) => void
  onSkills: () => void
  onGuard: () => void
  onItems: () => void
  onBrawl: () => void
  onPact: () => void
}) {
  const { brawl } = commands
  const weaponSkills = [
    ...commands.weaponSkills,
    ...(commands.blessing ? [commands.blessing] : []),
  ]
  const left = (portrait: string, desktop: string) =>
    wide ? { left: "5vw", bottom: desktop } : { left: "3vw", bottom: portrait }
  return (
    <div className="ui-layer" style={UI_LAYER}>
      {weaponSkills.length ? (
        <Revolver
          label="武器のワザと祝福"
          items={weaponSkills.map((skill) => ({
            key: skill.id,
            no: skill.left ?? 0,
            unit: `/${skill.uses ?? 0}`,
            name: skill.name,
            note: skillNote(
              skill,
              skill.id === commands.blessing?.id
                ? "この探索中だけの祝福"
                : skill.random
                  ? "付け替えできるワザ"
                  : "武器固有のワザ"
            ),
            locked: !skill.usable,
          }))}
          selected={selected}
          onSelect={onSelect}
          onConfirm={(index) => {
            const skill = weaponSkills[index]
            if (skill) onWeaponSkill(skill.id)
          }}
          // 敵を押して放つので、札のない所は下の敵へ通す（札は押せて、回せる）
          style={{ pointerEvents: "none" }}
        />
      ) : null}
      {brawl ? (
        <Word
          text={brawl.name}
          size={7}
          big
          tilt={4}
          rotate={5}
          from="left"
          delay={100}
          label={
            brawl.weak ? `${brawl.name}（後衛から近接：威力半分）` : brawl.name
          }
          style={left("54%", "64%")}
          onClick={onBrawl}
        />
      ) : null}
      {commands.pact ? (
        <Word
          text="ケイヤク"
          size={6.5}
          big
          tilt={3}
          rotate={-3}
          from="left"
          delay={120}
          label="ケイヤク（モードを変える。手番を使う）"
          disabled={!commands.pact.some((mode) => mode.usable)}
          style={left(brawl ? "66%" : "54%", brawl ? "78%" : "64%")}
          onClick={onPact}
        />
      ) : null}
      {commands.skills.length > 0 ? (
        <Word
          text="スキル"
          size={7}
          big
          tilt={4}
          rotate={4}
          from="left"
          delay={140}
          label={hero ? "スキル（悪魔と合体）" : "スキル"}
          disabled={!commands.skills.length}
          style={left("40%", "50%")}
          onClick={onSkills}
        />
      ) : null}
      <Word
        text="アイテム"
        size={6.5}
        big
        tilt={-3}
        rotate={-4}
        from="left"
        delay={190}
        disabled={!commands.items.length}
        style={left("28%", "36%")}
        onClick={onItems}
      />
      <Word
        text="防御"
        size={7}
        big
        tilt={-3}
        rotate={3}
        from="left"
        delay={240}
        style={left("16%", "22%")}
        onClick={onGuard}
      />
    </div>
  )
}
