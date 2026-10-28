import { Session } from "@/builder/lib/session"

export const attackOf = (session: Session) =>
  session.state.party.reduce((sum, id) => {
    const member = session.state.members.find((entry) => entry.id === id)
    return (
      sum +
      (member
        ? (session.queries.weapon(session.state, member)?.attack ?? 0)
        : 0)
    )
  }, 0)
