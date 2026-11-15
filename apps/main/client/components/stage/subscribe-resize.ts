export function subscribeResize(listener: () => void) {
  addEventListener("resize", listener)
  return () => removeEventListener("resize", listener)
}
