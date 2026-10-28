export const pickOne = <T>(list: readonly T[]) =>
  list[Math.floor(Math.random() * list.length)]
