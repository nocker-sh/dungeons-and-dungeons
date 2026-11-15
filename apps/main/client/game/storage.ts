export type SessionStatus = "fresh" | "restored" | "unreadable"

export type Session = {
  status: SessionStatus
  /** 読めなかった理由。 */
  problems: readonly string[]
  disconnect: () => void
  /** 今の状態で再保存する。読めない保存には接続しない。 */
  retrySave?: () => Promise<void>
}

export type SaveReport = (saved: boolean) => void
