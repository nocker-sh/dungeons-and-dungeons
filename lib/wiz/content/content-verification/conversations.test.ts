import { expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"

it("本番台本の要求と除外に同じフラグを置いたら起動時に拒否する", () => {
  const content = realContent()
  const definition = new GameDefinition(content)
  const target = definition.catalog.data.conversations!.find(
    (entry) => entry.excludes.length > 0
  )!
  const flag = target.excludes[0]
  const changed = {
    ...content,
    conversations: content.conversations!.map((entry) =>
      entry.id === target.id
        ? { ...entry, requires: [...(entry.requires ?? []), flag] }
        : entry
    ),
  }
  expect(() => new GameDefinition(changed)).toThrow(
    `会話 ${target.id} のフラグ ${flag} は要求と除外を同時に指定できない`
  )
  expect(() => new GameDefinition(content)).not.toThrow()
})
