/** 操作を断る理由。画面はこの符号で言葉を決める。 */
export type GameReason =
  | "WRONG_PHASE"
  | "UNKNOWN"
  | "LOCKED"
  | "NOT_NEXT"
  | "AT_END"
  | "PENDING"
  | "NOT_YOUR_TURN"
  | "UNAVAILABLE"
  /** ワザの使用回数が残っていない。 */
  | "NO_USES"
  /** その魔法の流派を使えない。 */
  | "NO_SCHOOL"
  /** 自分を削って放つワザに払えるHPが残っていない。 */
  | "NO_HP"
  | "NO_ITEM"
  | "NO_TARGET"
  /** その相手には効かない道具（回復しきっている・治す状態がないなど）。 */
  | "NO_EFFECT"
  | "NO_GOLD"
  | "NO_JUNK"
  /** 素材が足りない。 */
  | "NO_MATERIALS"
  /** これ以上強化できない。 */
  | "MAX"
  | "NO_STONES"
  | "NOT_OWNED"
  | "ALREADY"
  | "NOT_READY"
  /** 倒れた仲間がいて出撃できない。 */
  | "DOWN"
  /** 疲れ切った仲間がいて出撃できない。 */
  | "TIRED"
  /** 出撃の3人がそろっていない。 */
  | "SHORT"
  /** ギルドで名前を登録する前。 */
  | "UNREGISTERED"
  /** 主人公は外せない。 */
  | "HERO"
  /** ユニークの仲間は装備を変えられない。 */
  | "FIXED_GEAR"
  /** その職業では装備できない。 */
  | "WRONG_JOB"
  /** ユニークの固有の武器ではない。 */
  | "NOT_UNIQUE"
  | "INVALID_ACTION"
  | "INVALID_SAVE"
  | "ENGINE_FAILURE"
  /** 古いフェーズのオブジェクトから操作した（状態がもう先へ進んでいる）。 */
  | "STALE"
