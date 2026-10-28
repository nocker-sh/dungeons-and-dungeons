import { test } from "vite-plus/test"
import assert from "node:assert/strict"
import { artworkOutputPath } from "./artwork-paths.cjs"

test("原画の保存場所と独立した分類・版の公開先を使う", () => {
  assert.equal(
    artworkOutputPath("/tmp/scenes/town.webp"),
    "public/tmp/scenes/town.webp"
  )
  assert.equal(
    artworkOutputPath("/tmp/characters/v1/alda.webp"),
    "public/tmp/characters/v1/alda.webp"
  )
})

test("未指定・旧配置・公開先からの脱出を拒否する", () => {
  for (const image of [
    undefined,
    "/images/alda.webp",
    "/art/scenes/town.webp",
    "/tmp/characters/../../secret.webp",
    "/tmp/characters/..\\secret.webp",
    "/tmp/characters/alda.png",
  ])
    assert.throws(() => artworkOutputPath(image), /import-manifest/)
})
