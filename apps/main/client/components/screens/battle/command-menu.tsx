import { Revolver } from "@/client/components/stage/revolver"
import { Word } from "@/client/components/stage/word"
import { UI_LAYER } from "@/client/components/canvas/tokens"
import { skillNote } from "@/client/components/screens/battle/types"
import type { Commands } from "@/client/components/screens/battle/types"

/**
 * 手番の仲間への指示。武器3枠と祝福1枠をリボルバーに並べ、
 * キャラ固有・悪魔スキルは別メニューに置き、「防御」「アイテム」も出す。
 * 使える手が尽きたときだけ「殴る」が出る。悪魔と契約して戦う仲間（R）には「ケイヤク」が出る。
 * プレイヤーが契約した悪魔は、1戦闘に1回だけ「悪魔を呼ぶ」で呼べる（手番を使わない）。
 * ワザは選んでから狙っている敵を押して放つ（選んでいる札をもう一度押しても放つ）。
 * 押したときの中身は持たない。
 */
type Props = {
  commands: Commands
  /** プレイヤーが呼べる悪魔（契約がなければ null）。 */
  demonCall: { demonName: string; skillName: string; usable: boolean } | null
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
  onDemon: () => void
}

export function CommandMenu(props: Props) {
  const { brawl } = props.commands
  const weaponSkills = [
    ...props.commands.weaponSkills,
    ...(props.commands.blessing ? [props.commands.blessing] : []),
  ]
  const left = (portrait: string, desktop: string) =>
    props.wide
      ? { left: "5vw", bottom: desktop }
      : { left: "3vw", bottom: portrait }
  return (
    <div className="ui-layer" style={UI_LAYER}>
      {props.demonCall?.usable ? (
        <Word
          text={`${props.demonCall.demonName}を呼ぶ`}
          size={6}
          big
          tilt={-4}
          rotate={-5}
          from="right"
          delay={260}
          label={`${props.demonCall.demonName}を呼ぶ（1戦闘に1回。敵全員へ「${props.demonCall.skillName}」。手番は使わない）`}
          style={
            props.wide
              ? { right: "5vw", top: "16%" }
              : { right: "3vw", top: "14%" }
          }
          onClick={props.onDemon}
        />
      ) : null}
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
              skill.id === props.commands.blessing?.id
                ? "この探索中だけの祝福"
                : skill.random
                  ? "付け替えできるワザ"
                  : "武器固有のワザ"
            ),
            locked: !skill.usable,
          }))}
          selected={props.selected}
          onSelect={props.onSelect}
          onConfirm={(index) => {
            const skill = weaponSkills[index]
            if (skill) props.onWeaponSkill(skill.id)
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
          onClick={props.onBrawl}
        />
      ) : null}
      {props.commands.pact ? (
        <Word
          text="ケイヤク"
          size={6.5}
          big
          tilt={3}
          rotate={-3}
          from="left"
          delay={120}
          label="ケイヤク（モードを変える。手番を使う）"
          // 選べるモードがなくても開き、各モードの理由（Lv不足・いまのモード）を見せる
          style={left(brawl ? "66%" : "54%", brawl ? "78%" : "64%")}
          onClick={props.onPact}
        />
      ) : null}
      {props.commands.skills.length > 0 ? (
        <Word
          text="スキル"
          size={7}
          big
          tilt={4}
          rotate={4}
          from="left"
          delay={140}
          label="スキル"
          disabled={!props.commands.skills.length}
          style={left("40%", "50%")}
          onClick={props.onSkills}
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
        disabled={!props.commands.items.length}
        style={left("28%", "36%")}
        onClick={props.onItems}
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
        onClick={props.onGuard}
      />
    </div>
  )
}
