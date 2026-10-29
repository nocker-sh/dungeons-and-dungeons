import { expect, it } from "vite-plus/test"
import { conceptDocumentPath } from "@/scripts/concept-check/concept-document-path"

it("別カテゴリの資料をWikiリンクで一意に参照する", () => {
  expect(
    conceptDocumentPath(
      "/project/.docs/concept",
      "characters/alma.md",
      "[[concept/rooms/guild-deluxe-front|客室]]"
    )
  ).toBe("/project/.docs/concept/rooms/guild-deluxe-front.md")
})

it("同じ名前でも別カテゴリの対象を取り違えない", () => {
  const root = "/project/.docs/concept"
  expect(
    conceptDocumentPath(root, "people/a.md", "[[concept/rooms/a]]")
  ).not.toBe(conceptDocumentPath(root, "people/a.md", "[[concept/sites/a]]"))
})

it("既存の旧形式の資料も検査できる", () => {
  expect(
    conceptDocumentPath(
      "/project/.docs/concept",
      "people/a.md",
      "../rooms/a.md"
    )
  ).toBe("/project/.docs/concept/rooms/a.md")
})
