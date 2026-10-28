import type { Session } from "@/builder/lib/session"

/** 未合体の場合だけ、既に契約した相棒を選ぶ。 */
export function chooseFirstPartner(session: Session) {
  if (!session.state.contract && session.state.demons[0])
    session.send({ type: "choose-demon", demon: session.state.demons[0].id })
}
