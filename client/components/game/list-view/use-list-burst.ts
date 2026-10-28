import { COLOR } from "@/client/components/stage/kit"
import { useFx } from "@/client/components/stage/use-fx"
import { type At } from "./types"

/** 一覧の主操作の手応え。 */
export function useListBurst() {
  const fx = useFx()
  return (at: At, text: string, loud = true) => {
    fx.burst(
      at.x,
      at.y - at.h,
      at.h * 1.6,
      text,
      loud
        ? { fill: COLOR.blood, ink: COLOR.paper }
        : { fill: COLOR.paper, ink: COLOR.ink }
    )
    fx.shards(at.x, at.y, {
      n: 14,
      colors: loud
        ? [COLOR.paper, COLOR.blood, COLOR.ink]
        : [COLOR.paper, COLOR.sage],
    })
    fx.shake(0.6)
  }
}
