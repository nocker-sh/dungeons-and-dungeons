import { createContext, useContext } from "react"

/** 退場の合図。入れ子にでき、内側の要素は一番近い合図に従う。 */
export const LeavingContext = createContext(false)

export function useLeaving() {
  return useContext(LeavingContext)
}
