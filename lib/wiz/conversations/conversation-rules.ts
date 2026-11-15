import { layerClearedFlag } from "@/lib/wiz/rules/layer-cleared-flag"
import { DemonBonds } from "@/lib/wiz/rules/demon-bonds"
import { MemberBonds } from "@/lib/wiz/rules/member-bonds"
import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { HERO_REGISTERED_FLAG } from "@/lib/wiz/content/constants"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type {
  ConversationDefinition,
  ConversationSubject,
  ConversationTrigger,
} from "./schema"

/** 街（と街へ着く前の開幕）で起きる場面。住人も登場でき、仲間は控えでもよい。 */
const townTriggers: readonly ConversationTrigger[] = [
  "inn",
  "talk",
  "visit",
  "opening",
]

/** 本番と制作画面で共有する出現条件。台本に作品固有の ID を注入する。 */
export class ConversationRules {
  constructor(private readonly catalog: GameCatalog) {}

  inspect(
    state: GameState,
    trigger: ConversationTrigger,
    subject: ConversationSubject = {}
  ) {
    return (this.catalog.data.conversations ?? []).map((conversation) => ({
      conversation,
      reasons: [
        ...this.reasons(state, trigger, conversation, subject),
        ...(conversation.retired ? ["廃止した会話"] : []),
      ],
    }))
  }

  reasons(
    state: GameState,
    trigger: ConversationTrigger,
    conversation: ConversationDefinition,
    subject: ConversationSubject = {}
  ) {
    const reasons: string[] = []
    const encounteredDemon = this.catalog.demon(conversation.participants[0])
    const contractEncounter =
      encounteredDemon?.contract?.encounter === conversation.id &&
      !state.demons.some((entry) => entry.id === encounteredDemon.id)
    const called =
      state.conversation?.flags?.includes(
        `demon-called:${encounteredDemon?.id}`
      ) || state.conversation?.seen.includes(conversation.id)
    if (contractEncounter && encounteredDemon?.contract?.paper && !called)
      reasons.push("契約書でまだ呼び出していない")
    const inTown = townTriggers.includes(trigger)
    if (conversation.trigger !== trigger) reasons.push("場面が違う")
    if (
      trigger === "talk" &&
      subject.resident !== undefined &&
      !(conversation.sharedTalk
        ? conversation.participants.includes(subject.resident)
        : conversation.participants[0] === subject.resident)
    )
      reasons.push("話しかけた相手が違う")
    if (
      trigger === "visit" &&
      subject.place !== undefined &&
      conversation.place !== subject.place
    )
      reasons.push("場所が違う")
    if (state.reached < conversation.minimumReached)
      reasons.push("進行度が足りない")
    if (state.nights < conversation.minimumNights)
      reasons.push("夜の数が足りない")
    if (conversation.requiresCleared && !state.cleared) reasons.push("未踏破")
    if (conversation.requiresRegistered && state.hero.registrationPending)
      reasons.push("名前の登録前")
    if (
      conversation.once &&
      state.conversation?.seen.includes(conversation.id) &&
      !contractEncounter
    )
      reasons.push("一度限りの会話を既読")
    const flags = state.conversation?.flags ?? []
    // 層を突破した印は、印を付ける前の版で突破した保存にはない。次の層へ届いていれば突破済みとして扱う
    const clearedLayers = this.catalog.data.layers
      .filter((_layer, index) => index < state.reached)
      .map((layer) => layerClearedFlag(layer.no))
    for (const flag of conversation.requires)
      if (!flags.includes(flag) && !clearedLayers.includes(flag))
        reasons.push(`フラグがない:${flag}`)
    // 登録の印は、印を付ける前の版で登録した保存にはない。登録前だけの場面は、登録済みなら印がなくても流さない
    // （印を必要とする場面は、旧保存で今さら流さないよう、実際の印だけで判定する）。
    const registered = !state.hero.registrationPending
    for (const flag of conversation.excludes)
      if (flags.includes(flag) || (flag === HERO_REGISTERED_FLAG && registered))
        reasons.push(`フラグが立っている:${flag}`)
    // 親しさは0以上なので、下限のない台本では数えない（悪魔の親しさは全台本を走査するので重い）
    const minimumBond = conversation.minimumBond ?? 0
    if (
      minimumBond > 0 &&
      this.bond(state, conversation.participants[0]) < minimumBond
    )
      reasons.push("まだ親しくなっていない")
    for (const person of conversation.participants) {
      if (this.catalog.member(person)) {
        if (!state.members.some((member) => member.id === person))
          reasons.push(`未所持:${person}`)
        else if (!inTown && !state.party.includes(person))
          reasons.push(`同行していない:${person}`)
      } else if (this.catalog.demon(person)) {
        if (
          !state.demons.some((demon) => demon.id === person) &&
          this.catalog.demon(person)?.contract?.encounter !== conversation.id
        )
          reasons.push(`未契約:${person}`)
        else if (!inTown && state.contract !== person)
          reasons.push(`契約中ではない:${person}`)
      } else if (
        !(this.catalog.data.conversationResidents ?? []).includes(person)
      )
        reasons.push(`不明な話者:${person}`)
      else if (!inTown) reasons.push(`住人は探索に同行しない:${person}`)
    }
    return reasons
  }

  /** 最初の話者との親しさ。仲間は一緒に過ごした積み重ね、悪魔は読んだ会話の数。 */
  bond(state: GameState, person: string) {
    return this.catalog.member(person)
      ? new MemberBonds().count(state, person)
      : new DemonBonds(this.catalog).count(state, person)
  }

  available(
    state: GameState,
    trigger: ConversationTrigger,
    subject: ConversationSubject = {}
  ) {
    return this.inspect(state, trigger, subject)
      .filter((entry) => entry.reasons.length === 0)
      .map((entry) => entry.conversation)
  }

  /** 確率なしで必ず流れる、まだ読んでいない場面が残っているか。 */
  awaiting(
    state: GameState,
    trigger: ConversationTrigger,
    subject: ConversationSubject = {}
  ) {
    return this.available(state, trigger, subject).some(
      (entry) =>
        entry.chance === undefined &&
        !state.conversation?.seen.includes(entry.id)
    )
  }

  /**
   * 未読を優先。全て既読なら直前を避け、環境から受け取った乱数で選ぶ。
   * 場所に入ったときの場面は、それぞれの確率に当たったものだけが候補になる。
   */
  select(
    state: GameState,
    trigger: ConversationTrigger,
    random: () => number,
    subject: ConversationSubject = {}
  ) {
    const available = this.available(state, trigger, subject).filter(
      (entry) => entry.chance === undefined || random() < entry.chance
    )
    const unread = available.filter(
      (entry) => !state.conversation?.seen.includes(entry.id)
    )
    const notLast = available.filter(
      (entry) => entry.id !== state.conversation?.last
    )
    const candidates = unread.length
      ? unread
      : notLast.length
        ? notLast
        : available
    if (!candidates.length) return null
    const priority = Math.max(...candidates.map((entry) => entry.priority ?? 0))
    const prioritized = candidates.filter(
      (entry) => (entry.priority ?? 0) === priority
    )
    return (
      prioritized[
        Math.min(
          prioritized.length - 1,
          Math.floor(random() * prioritized.length)
        )
      ] ?? null
    )
  }

  canStart(
    state: GameState,
    trigger: ConversationTrigger,
    subject: ConversationSubject = {}
  ) {
    if (state.conversation?.active) return false
    // 開幕は街へ着く前だけ。見終えた台本しかなければ始めない
    if (trigger === "opening")
      return (
        state.phase.type === "creating" &&
        this.available(state, trigger).length > 0
      )
    if (trigger === "inn")
      return state.phase.type === "town" && state.nights > 0 && !state.wipe
    if (trigger === "talk" || trigger === "visit")
      return (
        state.phase.type === "town" &&
        (trigger === "visit" || !state.hero.registrationPending) &&
        (trigger === "talk"
          ? (this.catalog.data.conversationResidents ?? []).includes(
              subject.resident ?? ""
            ) ||
            state.demons.some((demon) => demon.id === subject.resident) ||
            !!this.catalog.demon(subject.resident ?? "")?.contract
          : (this.catalog.data.conversationPlaces ?? []).includes(
              subject.place ?? ""
            ) &&
            (state.conversation?.visits?.[subject.place ?? ""] !==
              state.nights ||
              this.available(state, "visit", subject).some(
                (entry) =>
                  (entry.priority ?? 0) >= 100 &&
                  !state.conversation?.seen.includes(entry.id)
              )))
      )
    if (state.phase.type !== "expedition") return false
    const expedition = state.phase.expedition
    if (trigger === "chest") return expedition.pending?.kind === "treasure"
    if (trigger === "item")
      return (
        !!expedition.pending &&
        expedition.pending.kind !== "trap" &&
        expedition.pending.kind !== "discovery" &&
        expedition.pending.goods.length > 0
      )
    return (
      !expedition.pending &&
      (this.catalog.station(expedition.layer, expedition.at)?.next.length ??
        0) > 1
    )
  }

  /** 操作可能で、条件を満たす台本がある。確率抽選は開始時に行う。 */
  canOffer(
    state: GameState,
    trigger: ConversationTrigger,
    subject: ConversationSubject = {}
  ) {
    return (
      this.canStart(state, trigger, subject) &&
      this.available(state, trigger, subject).length > 0
    )
  }

  /** 見終えたときに立つフラグ。選んだ答えのフラグも足す。 */
  flagsAfter(
    state: GameState,
    conversation: ConversationDefinition,
    picked: number | undefined
  ) {
    const flags = state.conversation?.flags ?? []
    const raised = [
      ...conversation.sets,
      ...(picked === undefined
        ? []
        : (conversation.choice?.options[picked]?.sets ?? [])),
    ]
    return [...flags, ...raised.filter((flag) => !flags.includes(flag))].filter(
      (flag, index, all) => all.indexOf(flag) === index
    )
  }
}
