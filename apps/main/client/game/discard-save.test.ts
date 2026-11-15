import { describe, expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { MemoryStorage } from "@/client/game/memory-storage"
import { discardSave } from "@/client/game/discard-save"

describe("discardSave", () => {
  it("書き込みに失敗したら、読めない古い保存を消さずに残す", async () => {
    const game = new GameDefinition(realContent()).create()
    const storage = new MemoryStorage()
    storage.value = "{broken"
    storage.write = () => {
      throw new Error("容量不足")
    }
    const session = await discardSave(game, storage)
    expect(session.status).toBe("unreadable")
    expect(storage.value).toBe("{broken")
  })

  it("成功したら今の状態で上書きする", async () => {
    const game = new GameDefinition(realContent()).create()
    const storage = new MemoryStorage()
    storage.value = "{broken"
    const session = await discardSave(game, storage)
    expect(session.status).toBe("fresh")
    expect(JSON.parse(storage.value ?? "")).toEqual(game.save())
    session.disconnect()
  })
})
