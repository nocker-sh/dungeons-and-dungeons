import type { Stack } from "@/lib/wiz/state/state-schema"

/** 袋の中身を足し引きする。数が0になった品物は取り除く。 */
export class Bag {
  static add(bag: readonly Stack[], goods: readonly Stack[]): Stack[] {
    const next = bag.map((entry) => ({ ...entry }))
    for (const entry of goods) {
      const found = next.find((stack) => stack.good === entry.good)
      if (found) found.count += entry.count
      else next.push({ good: entry.good, count: entry.count })
    }
    return next
  }

  static remove(
    bag: readonly Stack[],
    good: string,
    count = 1
  ): Stack[] | null {
    if (Bag.count(bag, good) < count) return null
    // 同じ品物が複数の束に分かれていても（読み込んだ保存など）合わせて取り出す
    let rest = count
    return bag
      .map((entry) => {
        if (entry.good !== good || rest <= 0) return { ...entry }
        const taken = Math.min(entry.count, rest)
        rest -= taken
        return { ...entry, count: entry.count - taken }
      })
      .filter((entry) => entry.count > 0)
  }

  static count(bag: readonly Stack[], good: string) {
    return bag.reduce(
      (sum, entry) => (entry.good === good ? sum + entry.count : sum),
      0
    )
  }

  /** 素材をまとめて払う。一つでも足りなければ null。 */
  static pay(bag: readonly Stack[], goods: readonly Stack[]): Stack[] | null {
    let next: Stack[] | null = bag.map((entry) => ({ ...entry }))
    for (const entry of goods) {
      next = next && Bag.remove(next, entry.good, entry.count)
      if (!next) return null
    }
    return next
  }
}
