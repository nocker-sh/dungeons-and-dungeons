import { initialConversations } from "@/client/components/dev/conversations-page"

/** フラグを立てる台本の題。条件のフラグがどこで立つかを示す。 */
export const settersOf = (flag: string) =>
  initialConversations
    .filter(
      (entry) =>
        entry.sets.includes(flag) ||
        entry.choice?.options.some((option) => option.sets.includes(flag))
    )
    .map((entry) => entry.title)
