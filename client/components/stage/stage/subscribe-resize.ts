/**
 * 画面は常に映画の一場面。奥行きのある層・操作・エフェクト・黒帯・粒子を重ね、下端に隊列（Formation）を置く。
 */
export function subscribeResize(listener: () => void) {
  addEventListener("resize", listener)
  return () => removeEventListener("resize", listener)
}
