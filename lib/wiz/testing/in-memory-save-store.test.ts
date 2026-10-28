import { describe, expect, it } from "vite-plus/test"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { InMemorySaveStore } from "@/lib/wiz/testing/in-memory-save-store"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"

describe("覚えているだけの保存先（InMemorySaveStore）", () => {
  it("書いた物をそのまま読み、clear で空になる", () => {
    const store = new InMemorySaveStore()
    expect(store.read()).toBeNull()
    store.write("hello")
    expect(store.read()).toBe("hello")
    expect(store.writes).toBe(1)
    store.clear()
    expect(store.read()).toBeNull()
  })

  it("プレイの保存を入れて別のプレイへ復元できる", () => {
    const store = new InMemorySaveStore()
    const first = createTestGame()
    const dagger = goodBySlug("dagger")
    expect(
      first.send({
        type: "buy",
        shop: contentId("armory"),
        good: dagger.id,
      })
    ).toEqual([{ type: "bought", good: dagger.id, price: dagger.price }])
    store.write(JSON.stringify(first.save()))
    const second = createTestGame()
    expect(second.restore(store.parsed())).toBeUndefined()
    expect(second.state).toEqual(first.state)
  })

  it("最初から中身を持たせられる", () => {
    const store = new InMemorySaveStore(JSON.stringify({ gold: 1 }))
    expect(store.parsed()).toEqual({ gold: 1 })
  })
})
