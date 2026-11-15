import { useState } from "react"

/** 押している間・マウスを当てている間（CSS の :hover / :active の代わり）。 */
export function usePointerState() {
  const [hover, setHover] = useState(false)
  const [press, setPress] = useState(false)
  return {
    hover,
    press,
    handlers: {
      onPointerEnter: () => setHover(true),
      onPointerLeave: () => {
        setHover(false)
        setPress(false)
      },
      onPointerDown: () => setPress(true),
      onPointerUp: () => setPress(false),
      onPointerCancel: () => setPress(false),
    },
  }
}
