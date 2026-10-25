import type { GameCatalog } from "@/lib/wiz/content"
import { GameDefinition } from "@/lib/wiz/definition"
import { createMember, starterGear } from "@/lib/wiz/members"
import { WeaponRules } from "@/lib/wiz/rules"
import type {
  ActorRef,
  Battle,
  Expedition,
  GameState,
  Gear,
  Member,
  Stack,
} from "@/lib/wiz/state"
import {
  idOfSlug,
  layerBySlug,
  realContent,
} from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"

/** 探索の場面を組み立てるときの指定。省略した分は0層の最初の地点。 */
export type ExpeditionOptions = Partial<Expedition>
/** 戦闘の場面を組み立てるときの指定。 */
export type BattleOptions = Readonly<{
  /** 出てくる敵（slug か id）。HPは定義から引く。 */
  foes?: readonly string[]
  /** 行動順。`foe` で始まるIDは敵、ほかは仲間（slug か id）。省略で渡した敵と出撃の並び。 */
  order?: readonly string[]
  turn?: number
  guarding?: readonly string[]
  boss?: boolean
  expedition?: ExpeditionOptions
}>

function defaultExpedition(): Expedition {
  return {
    layer: layerBySlug("layer0").id,
    at: "s",
    visited: ["s"],
    events: [],
    pending: null,
    loot: { gold: 0, goods: [] },
    cleared: false,
  }
}

/**
 * テストの場面を一行で作る組み立て器。
 * `aState().withGold(100).withMember("alda", { hp: 1 }).inBattle({ foes: ["kamokutsu"] }).build()`
 * のようにつなげる。呼ぶたびに新しい組み立て器を返すので、途中を使い回せる。
 * 仲間・品物・敵・層は人が読める名前（slug）でも id でも指せる。
 */
export class GameStateBuilder {
  constructor(
    private readonly state: GameState,
    readonly catalog: GameCatalog
  ) {}

  /**
   * 遊べる街の状態から始める。
   * 本物の「はじめから」は初期三人・ロクス契約済み・名前を決める場面なので、場面を組み立てる
   * 道具としては3人そろって街にいて悪魔と契約している状態を既定にする（`startedState`）。
   * 作る場面は `inCreation`、悪魔のない状態は `withoutDemon` で作る。
   */
  static of(content: unknown = realContent()): GameStateBuilder {
    const definition = new GameDefinition(content)
    return new GameStateBuilder(startedState(definition), definition.catalog)
  }

  /** 途中の状態から始める。 */
  static from(state: GameState, catalog: GameCatalog): GameStateBuilder {
    return new GameStateBuilder(state, catalog)
  }

  #with(patch: Partial<GameState>): GameStateBuilder {
    return new GameStateBuilder({ ...this.state, ...patch }, this.catalog)
  }

  withGold(gold: number) {
    return this.#with({ gold })
  }

  withStones(stones: number) {
    return this.#with({ stones })
  }

  /** 袋の中身をまるごと置き換える。 */
  withBag(bag: readonly Stack[]) {
    return this.#with({
      bag: bag.map((entry) => ({
        ...entry,
        good: idOfSlug("good", entry.good),
      })),
    })
  }

  /** 袋に品物を足す（同じ品物なら数を置き換える）。 */
  withItem(good: string, count = 1) {
    const id = idOfSlug("good", good)
    const rest = this.state.bag.filter((entry) => entry.good !== id)
    return this.#with({ bag: [...rest, { good: id, count }] })
  }

  /** 雇っている仲間ひとりを書き換える。 */
  withMember(key: string, patch: Partial<Member>) {
    const id = idOfSlug("member", key)
    return this.#with({
      members: this.state.members.map((member) =>
        member.id === id ? { ...member, ...patch } : member
      ),
    })
  }

  /** 雇っている仲間全員を書き換える。 */
  withMembers(patch: Partial<Member> | ((member: Member) => Partial<Member>)) {
    return this.#with({
      members: this.state.members.map((member) => ({
        ...member,
        ...(typeof patch === "function" ? patch(member) : patch),
      })),
    })
  }

  /** 雇っている仲間を足す（控えに入るだけ。出撃は `withParty`）。 */
  withExtraMember(key: string, patch: Partial<Member> = {}) {
    const definition = this.catalog.member(idOfSlug("member", key))
    if (!definition) throw new Error(`作品データに仲間の ${key} がない`)
    return this.#with({
      members: [
        ...this.state.members,
        {
          id: definition.id,
          lv: definition.lv,
          exp: 0,
          hp: definition.stats.maxHp,
          stats: { ...definition.stats },
          used: [],
          status: [],
          fatigue: 0,
          dirt: 0,
          like: 0,
          ...patch,
        },
      ],
    })
  }

  /**
   * 募集の仲間を雇ったときと同じ形（初期装備つき・満タンのHP）で加え、
   * `replacing` を指せば出撃の並びでその仲間と同じ位置に入れる（外れた仲間は控えに残る）。
   * 最初の仲間にいない仲間のワザで規則を確かめるときに使う。
   */
  withJoined(key: string, options: { replacing?: string } = {}) {
    const definition = this.catalog.member(idOfSlug("member", key))
    if (!definition) throw new Error(`作品データに仲間の ${key} がない`)
    if (this.state.members.some((member) => member.id === definition.id))
      throw new Error(`${key} はもう雇っている`)
    const replaced =
      options.replacing === undefined
        ? undefined
        : idOfSlug("member", options.replacing)
    if (replaced !== undefined && !this.state.party.includes(replaced))
      throw new Error(`${options.replacing} は出撃していない`)
    const rules = new GameDefinition(this.catalog).rules
    let serial = 0
    const gear = starterGear(
      definition,
      () => `joined-${definition.id}-${++serial}`,
      rules.weapons
    )
    const joined: GameState = {
      ...this.state,
      members: [...this.state.members, createMember(definition)],
      gear: [...this.state.gear, ...gear],
      party:
        replaced === undefined
          ? this.state.party
          : this.state.party.map((id) =>
              id === replaced ? definition.id : id
            ),
    }
    return this.#with({
      members: joined.members.map((member) =>
        member.id === definition.id
          ? { ...member, hp: rules.party.stats(member, joined).maxHp }
          : member
      ),
      gear: joined.gear,
      party: joined.party,
    })
  }

  /** ワザの使った回数を決める。 */
  withUses(key: string, used: readonly { skill: string; count: number }[]) {
    return this.withMember(key, {
      used: used.map((entry) => ({
        ...entry,
        skill: idOfSlug("skill", entry.skill),
      })),
    })
  }

  /** 出撃する仲間の並びを決める（1〜3人）。 */
  withParty(party: readonly string[]) {
    return this.#with({ party: party.map((key) => idOfSlug("member", key)) })
  }

  /** 装備の個体をまるごと置き換える。 */
  withGear(gear: readonly Gear[]) {
    return this.#with({
      gear: gear.map((entry) => ({
        ...entry,
        good: idOfSlug("good", entry.good),
        owner: entry.owner === null ? null : idOfSlug("member", entry.owner),
      })),
    })
  }

  /**
   * 仲間に装備の個体を持たせる（武器は N・上振れなし・武器のワザそのまま）。
   * 本物の「はじめから」は主人公も仲間も武器を持たないので、武器を要るテストはこれで持たせる。
   */
  withEquipped(memberKey: string, goodKey: string, patch: Partial<Gear> = {}) {
    const owner = idOfSlug("member", memberKey)
    const good = idOfSlug("good", goodKey)
    const weapons = new WeaponRules(this.catalog)
    return this.#with({
      gear: [
        ...this.state.gear,
        {
          id: `gear-${this.state.gear.length + 1}`,
          good,
          owner,
          plus: 0,
          progress: 0,
          wear: 0,
          weapon: weapons.forGoodId(good),
          ...patch,
        },
      ],
    })
  }

  /** 効果検証用に、固有枠を保った武器の3枠へワザを設定する。 */
  withWeaponSkills(memberKey: string, skillKeys: readonly string[]) {
    const owner = idOfSlug("member", memberKey)
    const definition = this.catalog.member(owner)!
    const equipped = this.state.gear.find(
      (entry) => entry.owner === owner && entry.weapon
    )
    const good = this.catalog.good(equipped?.good ?? definition.defaultWeapon)!
    const individual =
      equipped?.weapon ?? new WeaponRules(this.catalog).base(good)
    const requested = [
      ...new Set([
        good.skills![0],
        ...skillKeys.map((key) => idOfSlug("skill", key)),
      ]),
    ]
    if (requested.length > 3) throw new Error("武器のワザは3枠まで")
    const skills = [...new Set([...requested, ...individual.skills])].slice(
      0,
      3
    )
    const weapon = { ...individual, skills }
    return equipped
      ? this.patchGear(equipped.id, { weapon })
      : this.withEquipped(owner, good.id, { weapon })
  }

  patchGear(id: string, patch: Partial<Gear>) {
    return this.#with({
      gear: this.state.gear.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry
      ),
    })
  }

  withDemons(
    demons: readonly { id: string; lv: number; exp: number }[],
    contract?: string | null
  ) {
    const entries = demons.map((entry) => ({
      ...entry,
      id: idOfSlug("demon", entry.id),
    }))
    return this.#with({
      demons: entries,
      contract:
        contract === undefined
          ? (entries[0]?.id ?? this.state.contract)
          : contract === null
            ? null
            : idOfSlug("demon", contract),
    })
  }

  withContract(contract: string | null) {
    return this.#with({
      contract: contract === null ? null : idOfSlug("demon", contract),
    })
  }

  /** 悪魔と契約していない状態（主人公は合体せずに戦う）。 */
  withoutDemon() {
    return this.#with({ demons: [], contract: null })
  }

  /** 主人公の名前と外見。 */
  withHero(name: string, look = this.state.hero.look) {
    return this.#with({ hero: { name, look } })
  }

  /** 主人公の外見と名前を決める場面にする。 */
  inCreation() {
    return this.#with({ phase: { type: "creating" } })
  }

  withReached(reached: number) {
    return this.#with({ reached })
  }

  withBoard(board: readonly string[]) {
    return this.#with({ board: board.map((key) => idOfSlug("recruit", key)) })
  }

  /** 雇った募集の一覧を決める（同じ募集を二度雇えないことの確認に使う）。 */
  withRecruited(recruited: readonly string[]) {
    return this.#with({
      recruited: recruited.map((key) => idOfSlug("recruit", key)),
    })
  }

  withQuest(key: string, progress = 0, claimed = false) {
    const id = idOfSlug("quest", key)
    const rest = this.state.quests.filter((entry) => entry.id !== id)
    return this.#with({ quests: [...rest, { id, progress, claimed }] })
  }

  withNights(nights: number, chatted: readonly string[] = this.state.chatted) {
    return this.#with({
      nights,
      chatted: chatted.map((key) => idOfSlug("member", key)),
    })
  }

  withWipe(wipe: GameState["wipe"]) {
    return this.#with({ wipe })
  }

  withCleared(cleared: boolean, endingSeen = this.state.endingSeen) {
    return this.#with({ cleared, endingSeen })
  }

  /** 街にいる状態にする。 */
  inTown() {
    return this.#with({ phase: { type: "town" } })
  }

  /** 探索中（板が出ていない）にする。 */
  inExpedition(options: ExpeditionOptions = {}) {
    return this.#with({
      phase: {
        type: "expedition",
        expedition: {
          ...defaultExpedition(),
          ...options,
          ...(options.layer ? { layer: idOfSlug("layer", options.layer) } : {}),
        },
      },
    })
  }

  /** 戦闘中にする。敵のHPはコンテンツの定義から引く。 */
  inBattle(options: BattleOptions = {}) {
    const foeIds = (options.foes ?? ["kamokutsu"]).map((key) =>
      idOfSlug("foe", key)
    )
    const foes: Battle["foes"] = foeIds.map((foe, index) => {
      const hp = this.catalog.foe(foe)?.hp ?? 1
      return { id: `foe-${index + 1}`, foe, hp, maxHp: hp, status: [] }
    })
    const order: ActorRef[] = (
      options.order ?? [...foes.map((foe) => foe.id), ...this.state.party]
    ).map((id) =>
      id.startsWith("foe")
        ? { kind: "foe" as const, id }
        : { kind: "member" as const, id: idOfSlug("member", id) }
    )
    const expedition = options.expedition ?? {}
    return this.#with({
      phase: {
        type: "battle",
        expedition: {
          ...defaultExpedition(),
          at: "n1",
          visited: ["s", "n1"],
          ...expedition,
          ...(expedition.layer
            ? { layer: idOfSlug("layer", expedition.layer) }
            : {}),
        },
        battle: {
          foes,
          order,
          turn: options.turn ?? 0,
          guarding: (options.guarding ?? []).map((key) =>
            idOfSlug("member", key)
          ),
          boss: options.boss ?? false,
        },
      },
    })
  }

  build(): GameState {
    return this.state
  }
}

/** `GameStateBuilder.of` の近道。 */
export function aState(content: unknown = realContent()) {
  return GameStateBuilder.of(content)
}
