import type { Takeover } from "@/client/components/stage/director"
import { useTakeover } from "@/client/components/stage/use-takeover"

/** useTakeover を、フックを呼べない場所（Stage を描く側）から使うための部品。 */
export type Props = {
  takeover: Takeover
  active: boolean
}

export function TakeoverWhile(props: Props) {
  useTakeover(props.takeover, props.active)
  return null
}
