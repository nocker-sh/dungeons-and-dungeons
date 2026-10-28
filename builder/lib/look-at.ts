/** 最初にまとめて回す回数と、途中で決めるか確かめる間隔。 */
export const FIRST_LOOK = 20

export const LOOK_EVERY = 10

/** run 回目（0始まり）を終えたところで、決まったかを確かめる番か。 */
export function lookAt(run: number) {
  const done = run + 1
  return done >= FIRST_LOOK && (done - FIRST_LOOK) % LOOK_EVERY === 0
}
