import {
  BattleRules,
  Statuses,
  type EffectSpec,
  type Random,
} from "@/lib/wiz/rules"
import type {
  ActionResult,
  ActorRef,
  Battle,
  FoeState,
  GameEvent,
  GameState,
  Gear,
  Member,
  Stack,
  Status,
} from "@/lib/wiz/state"
import type { StatusKind } from "@/lib/wiz/content"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { accept, type Transition } from "@/lib/wiz/application/transition"
import type { Mutable } from "@/lib/wiz/application/mutable"
import type { BattlePhase } from "@/lib/wiz/application/battle/battle-phase"
import { Victory } from "@/lib/wiz/application/battle/victory"
import { defeat } from "@/lib/wiz/application/battle/defeat"

type Unit = {
  ref: ActorRef
  hp: number
  maxHp: number
  status: readonly Status[]
}

export type CombatDependencies = Pick<
  GameDependencies,
  "catalog" | "party" | "battle" | "expedition" | "weapons"
>

/**
 * 一回の行動を計算する作業台。状態の写しを持ち、最後に次の状態を組み立てる。
 * 一つの行動は一つの出来事（acted）と、手番の終わりの出来事（毒・縛り）を返す。
 */
export class Combat {
  members: Mutable<Member>[]
  foes: Mutable<FoeState>[]
  /** 防具の個体の写し（触った分だけ）。防具の耐久（wear）が戦闘中に減る。ほかの装備は元の状態を共有する。 */
  readonly #armor = new Map<string, Mutable<Gear>>()
  guarding: string[]
  provisions: GameState["provisions"]
  bag: Stack[]
  events: GameEvent[] = []

  constructor(
    private readonly deps: CombatDependencies,
    private readonly state: GameState,
    private readonly phase: BattlePhase,
    private readonly random: Random,
    /** 落とした武器の個体の id（DIの id 生成）。 */
    private readonly nextId: () => string
  ) {
    this.members = state.members.map((member) => ({
      ...member,
      status: member.status.map((entry) => ({ ...entry })),
    }))
    this.foes = phase.battle.foes.map((foe) => ({
      ...foe,
      status: foe.status.map((entry) => ({ ...entry })),
    }))
    this.guarding = [...phase.battle.guarding]
    this.provisions = state.provisions
    this.bag = state.bag.map((entry) => ({ ...entry }))
  }

  get next(): GameState {
    return {
      ...this.state,
      members: this.members,
      gear: this.#armor.size
        ? this.state.gear.map((entry) => this.#armor.get(entry.id) ?? entry)
        : this.state.gear,
      bag: this.bag,
      ...(this.provisions ? { provisions: this.provisions } : {}),
    }
  }

  /** その仲間が着けている防具の個体（写し）。 */
  armor(memberId: string) {
    const found = this.state.gear.find((entry) => {
      if (entry.owner !== memberId) return false
      return this.deps.catalog.good(entry.good)?.kind === "armor"
    })
    if (!found) return undefined
    let copy = this.#armor.get(found.id)
    if (!copy) {
      copy = { ...found }
      this.#armor.set(found.id, copy)
    }
    return copy
  }

  member(id: string) {
    return this.members.find((member) => member.id === id)
  }

  foe(id: string) {
    return this.foes.find((foe) => foe.id === id)
  }

  party() {
    return this.state.party.flatMap((id) => {
      const member = this.members.find((entry) => entry.id === id)
      return member ? [member] : []
    })
  }

  unit(ref: ActorRef): Unit | null {
    if (ref.kind === "member") {
      const member = this.member(ref.id)
      if (!member) return null
      const stats = this.deps.party.stats(member, this.state)
      return {
        ref,
        hp: member.hp,
        maxHp: stats.maxHp,
        status: member.status,
      }
    }
    const foe = this.foe(ref.id)
    const def = foe ? this.deps.catalog.foe(foe.foe) : undefined
    if (!foe || !def) return null
    return { ref, hp: foe.hp, maxHp: foe.maxHp, status: foe.status }
  }

  setHp(ref: ActorRef, hp: number) {
    if (ref.kind === "member") this.member(ref.id)!.hp = hp
    else this.foe(ref.id)!.hp = hp
  }

  setStatus(ref: ActorRef, status: Status[]) {
    if (ref.kind === "member") this.member(ref.id)!.status = status
    else this.foe(ref.id)!.status = status
  }

  /** 攻撃力。仲間は武器から、敵は定義の atk。 */
  atk(ref: ActorRef) {
    if (ref.kind === "member")
      return this.deps.party.attack(this.member(ref.id)!, this.state)
    return this.deps.catalog.foe(this.foe(ref.id)!.foe)?.atk ?? 0
  }

  living(side: "member" | "foe"): ActorRef[] {
    return side === "member"
      ? this.party()
          .filter((member) => member.hp > 0)
          .map((member) => ({ kind: "member" as const, id: member.id }))
      : this.foes
          .filter((foe) => foe.hp > 0)
          .map((foe) => ({ kind: "foe" as const, id: foe.id }))
  }

  fallen(side: "member" | "foe"): ActorRef[] {
    if (side === "foe") return []
    return this.party()
      .filter((member) => member.hp <= 0)
      .map((member) => ({ kind: "member" as const, id: member.id }))
  }

  /** 効果の対象を決める。foe/foes は相手側、ally/allies は自分の側。 */
  targets(
    actor: ActorRef,
    spec: EffectSpec,
    chosen: string | undefined,
    only?: readonly string[]
  ): ActorRef[] | null {
    const own = actor.kind
    const other = own === "member" ? "foe" : "member"
    /** only を渡した手（道具）は、効く相手だけを対象にする。 */
    const allowed = (refs: ActorRef[]) =>
      only ? refs.filter((ref) => only.includes(ref.id)) : refs
    if (spec.target === "self") return [actor]
    // 敵の全体攻撃も、近接なら前衛だけに届く
    if (spec.target === "foes" && own === "foe")
      return this.deps.battle
        .reachable(this.party(), spec.reach ?? "melee")
        .map((entry) => ({ kind: "member" as const, id: entry.member.id }))
    if (spec.target === "foes") return this.living(other)
    if (spec.target === "allies")
      return allowed(spec.revive ? this.fallen(own) : this.living(own))
    if (spec.target === "foe") {
      const pool = this.living(other)
      if (!pool.length) return null
      if (own === "member")
        return [pool.find((ref) => ref.id === chosen) ?? pool[0]]
      const target = this.deps.battle.target(
        this.party(),
        this.random,
        spec.reach ?? "melee"
      )
      return target ? [{ kind: "member", id: target.id }] : null
    }
    // ally：味方ひとり。指定がなければ一番弱っている者（蘇生なら倒れている者）
    const pool = allowed(spec.revive ? this.fallen(own) : this.living(own))
    if (!pool.length) return null
    const picked = pool.find((ref) => ref.id === chosen)
    if (picked) return [picked]
    // 防具を直すワザは、耐久が一番減っている者
    if (spec.repair !== undefined) {
      const worn = pool
        .map((ref) => ({ ref, wear: this.armor(ref.id)?.wear ?? 0 }))
        .toSorted((a, b) => b.wear - a.wear)[0]
      return worn.wear > 0 ? [worn.ref] : [pool[0]]
    }
    return [
      pool
        .map((ref) => this.unit(ref)!)
        .toSorted((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0].ref,
    ]
  }

  /**
   * 被害を与える。防御と守りの加護は被害を減らす（割合は balance）。加護は一度で消える。
   * 減らした後の被害は、防具の耐久から先に減り、尽きた分だけHPへ届く。
   */
  damage(ref: ActorRef, amount: number): Mutable<ActionResult> {
    const unit = this.unit(ref)!
    const balance = this.deps.catalog.data.balance
    let blocked = false
    if (
      Statuses.has(unit.status, "protect") ||
      Statuses.has(unit.status, "taunt")
    ) {
      if (Statuses.has(unit.status, "protect"))
        this.setStatus(ref, Statuses.remove(unit.status, ["protect"]))
      blocked = true
      const multiplier = Statuses.has(unit.status, "protect")
        ? balance.protect
        : (balance.taunt ?? 0.75)
      const reduced = Math.floor(amount * multiplier)
      if (reduced <= 0) return { target: ref, damage: 0, blocked: true }
      amount = reduced
    }
    const guarded = ref.kind === "member" && this.guarding.includes(ref.id)
    const dealt = guarded
      ? Math.max(1, Math.ceil(amount * balance.guard))
      : amount
    const armor = ref.kind === "member" ? this.armor(ref.id) : undefined
    const maxDurability = armor
      ? this.deps.party.equipment.maxDurabilityOf(
          this.deps.catalog.good(armor.good) ?? {},
          armor.plus
        )
      : 0
    const split = BattleRules.split(
      dealt,
      Math.max(0, maxDurability - (armor?.wear ?? 0))
    )
    if (armor && split.armor > 0) armor.wear += split.armor
    const hp = Math.max(0, unit.hp - split.hp)
    this.setHp(ref, hp)
    if (hp === 0) this.setStatus(ref, [])
    return {
      target: ref,
      damage: dealt,
      ...(blocked ? { blocked: true } : {}),
      ...(split.armor > 0
        ? {
            armor: split.armor,
            ...(armor && armor.wear >= maxDurability ? { broke: true } : {}),
          }
        : {}),
      guarded,
      down: hp === 0,
    }
  }

  /**
   * 状態異常への耐性（0〜1）。敵は定義の `resist`、仲間は合体の効果（主人公だけ）。
   */
  resistOf(ref: ActorRef, kind: StatusKind) {
    if (ref.kind === "foe") {
      const foe = this.phase.battle.foes.find((entry) => entry.id === ref.id)
      return this.deps.catalog.foe(foe?.foe ?? "")?.resist?.[kind] ?? 0
    }
    const member = this.member(ref.id)
    if (!member) return 0
    return this.deps.party.magic.fusionOf(member, this.state).resist[kind] ?? 0
  }

  /**
   * 自分を削って放つワザの代償。防具を通さずHPから直に減り、HPは1より下がらない。
   * 払った量を返す。
   */
  pay(ref: ActorRef, amount: number) {
    const unit = this.unit(ref)
    if (!unit) return 0
    const paid = Math.min(amount, Math.max(0, unit.hp - 1))
    if (paid > 0) this.setHp(ref, unit.hp - paid)
    return paid
  }

  /** 味方ひとりの防具の耐久を戻す。戻した量を返す。 */
  repair(ref: ActorRef, amount: number) {
    if (ref.kind !== "member") return 0
    const armor = this.armor(ref.id)
    if (!armor) return 0
    const restored = Math.min(armor.wear, amount)
    armor.wear -= restored
    return restored
  }

  /** 効果を一人ずつ当てる。対象がいなければ null。 */
  apply(
    actor: ActorRef,
    spec: EffectSpec,
    chosen: string | undefined,
    only?: readonly string[]
  ): ActionResult[] | null {
    const targets = this.targets(actor, spec, chosen, only)
    if (!targets || !targets.length) return null
    const results: ActionResult[] = []
    let absorbed = 0
    let power = spec.power
    if (spec.kind === "hit" && spec.amount === undefined) {
      const self = this.unit(actor)!
      if (Statuses.has(self.status, "charge")) {
        power *= 2
        this.setStatus(actor, Statuses.remove(self.status, ["charge"]))
      }
    }
    for (const ref of targets) {
      const unit = this.unit(ref)
      if (!unit) continue
      let result: Mutable<ActionResult> = { target: ref }
      // 敵の遠距離の攻撃は、後衛に当たりにくい。外れたら被害も状態も届かない
      if (
        spec.kind === "hit" &&
        actor.kind === "foe" &&
        ref.kind === "member" &&
        !this.deps.battle.hits(
          this.deps.party.rowOf(this.state, ref.id),
          spec.reach ?? "melee",
          this.random
        )
      ) {
        results.push({ target: ref, missed: true })
        continue
      }
      if (spec.kind === "hit")
        result = this.damage(
          ref,
          spec.amount ??
            this.deps.battle.damage(
              this.atk(actor),
              power *
                (spec.bonusAgainst &&
                Statuses.has(unit.status, spec.bonusAgainst.status)
                  ? spec.bonusAgainst.factor
                  : 1),
              this.random
            )
        )
      if (spec.kind === "heal") {
        if (spec.repair !== undefined) {
          result.repaired = this.repair(ref, spec.repair)
        } else if (spec.refill !== undefined && ref.kind === "member") {
          const member = this.member(ref.id)!
          const { used, restored } = this.deps.party.skills.refillUses(
            member,
            spec.refill
          )
          member.used = used
          result.refill = restored
        } else {
          const amount =
            spec.amount ??
            this.deps.battle.heal(this.atk(actor), power, this.random)
          const revived = !!spec.revive && unit.hp <= 0
          if (unit.hp > 0 || revived) {
            const hp = Math.min(unit.maxHp, Math.max(0, unit.hp) + amount)
            this.setHp(ref, hp)
            result.heal = hp - unit.hp
            if (revived) result.revived = true
          }
        }
      }
      if (spec.kind === "hit" && spec.drain)
        absorbed += Math.floor(
          Math.min(
            unit.hp,
            Math.max(0, (result.damage ?? 0) - (result.armor ?? 0))
          ) * spec.drain
        )
      const after = this.unit(ref)!
      if (spec.cure?.length && after.hp > 0) {
        const cured = after.status
          .filter((entry) => spec.cure!.includes(entry.kind))
          .map((entry) => entry.kind)
        if (cured.length) {
          this.setStatus(ref, Statuses.remove(after.status, cured))
          result.cured = cured
        }
      }
      if (spec.status && after.hp > 0) {
        const resist = this.resistOf(ref, spec.status.kind)
        const chance = (spec.status.chance ?? 1) * (1 - resist)
        if (chance >= 1 || this.random() < chance) {
          this.setStatus(
            ref,
            Statuses.add(
              this.unit(ref)!.status,
              spec.status.kind,
              spec.status.turns
            )
          )
          result.status = spec.status.kind
        } else result.resisted = spec.status.kind
      }
      results.push(result)
    }
    if (absorbed > 0) {
      const self = this.unit(actor)!
      const healed = Math.min(absorbed, self.maxHp - self.hp)
      if (self.hp > 0 && healed > 0) {
        this.setHp(actor, self.hp + healed)
        results.push({ target: actor, heal: healed })
      }
    }
    return results
  }

  /** 手番の終わり：毒で削られ、再生で戻り、状態の残りが減る。 */
  endTurn(ref: ActorRef) {
    const unit = this.unit(ref)
    if (!unit || unit.hp <= 0) return
    if (Statuses.has(unit.status, "regen")) {
      const amount = this.deps.battle.regen(unit.maxHp)
      const hp = Math.min(unit.maxHp, unit.hp + amount)
      if (hp !== unit.hp) {
        this.setHp(ref, hp)
        this.events.push({
          type: "ticked",
          target: ref,
          status: "regen",
          heal: hp - unit.hp,
          down: false,
        })
      }
    }
    if (Statuses.has(this.unit(ref)!.status, "poison")) {
      const now = this.unit(ref)!
      const amount = this.deps.battle.poison(now.maxHp)
      const hp = Math.max(0, now.hp - amount)
      this.setHp(ref, hp)
      this.events.push({
        type: "ticked",
        target: ref,
        status: "poison",
        damage: now.hp - hp,
        down: hp === 0,
      })
      if (hp === 0) {
        this.setStatus(ref, [])
        return
      }
    }
    this.setStatus(ref, Statuses.tick(this.unit(ref)!.status))
  }

  alive(ref: ActorRef) {
    return (this.unit(ref)?.hp ?? 0) > 0
  }

  over() {
    return this.living("foe").length === 0 || this.living("member").length === 0
  }

  /** 次に動ける者の番へ。縛られている者は手番を飛ばす。 */
  advance(battle: Battle): number {
    let turn = battle.turn
    for (let guard = 0; guard < battle.order.length * 8; guard++) {
      turn += 1
      const ref = battle.order[turn % battle.order.length]
      if (!this.alive(ref)) continue
      const unit = this.unit(ref)!
      if (Statuses.has(unit.status, "bind")) {
        this.events.push({ type: "skipped", actor: ref, status: "bind" })
        this.endTurn(ref)
        if (this.over()) return turn
        continue
      }
      return turn
    }
    return turn
  }

  /** 行動を終え、勝敗か次の手番を決める。 */
  finish(actor: ActorRef, acted: GameEvent): Transition {
    this.endTurn(actor)
    let battle: Battle = {
      ...this.phase.battle,
      foes: this.foes,
      guarding: this.guarding,
    }
    if (!this.over())
      battle = { ...battle, turn: this.advance(battle), foes: this.foes }
    const events = [acted, ...this.events]
    // 仲間が全員倒れたら、敵を倒し切っていても全滅。
    // 勝利を先に見ると、全員倒れたまま探索が続いて次の戦闘で誰も動けなくなる。
    if (this.living("member").length === 0 && this.phase.townQuest)
      return accept(
        {
          ...this.next,
          members: this.next.members.map((member) =>
            this.state.party.includes(member.id)
              ? { ...member, hp: 1, status: [] }
              : member
          ),
          phase: { type: "town" },
        },
        ...events,
        { type: "defeated" }
      )
    if (this.living("member").length === 0)
      return defeat(this.next, this.phase.expedition, events, {
        goods: [
          this.deps.catalog.data.junk,
          ...(this.deps.catalog.data.rareJunk
            ? [this.deps.catalog.data.rareJunk]
            : []),
        ],
        ratio: this.deps.catalog.data.balance.wipe?.keepJunk ?? 0,
      })
    if (this.living("foe").length === 0)
      return new Victory(this.deps).resolve(
        this.next,
        this.phase,
        battle,
        this.random,
        events,
        this.nextId
      )
    return accept({ ...this.next, phase: { ...this.phase, battle } }, ...events)
  }
}
