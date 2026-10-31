import { expect, it } from "vite-plus/test"
import { getPreviewRequest } from "@/development/studio/get-preview-request"
import { studioScenes } from "@/development/studio/scenarios"
import { createStudioStart } from "@/development/studio/create-studio-start"

it("フラットなURLから同じ初期状態を再現する", () => {
  const query = new URLSearchParams(
    "scene=battle&seed=77&party=hero,rivet,husky&foes=haribote-adult,hiyokobu&hp=100,25,0&at=2000&guides=1"
  )
  const request = getPreviewRequest(query)
  if (request instanceof Error) throw request
  expect(request).toMatchObject({
    at: 2000,
    guides: true,
    config: { seed: 77, party: ["hero", "rivet", "husky"], hp: [100, 25, 0] },
  })
  expect(createStudioStart(request.config).save).toEqual(
    createStudioStart(request.config).save
  )
})
it.each(studioScenes)("$slugを共通の入口から開ける", (scene) => {
  const query = new URLSearchParams({ scene: scene.slug })
  expect(getPreviewRequest(query)).not.toBeInstanceOf(Error)
})
it.each([
  "scene=missing",
  "seed=1&seed=2",
  "seed=wrong",
  "seed=4294967296",
  "typo=1",
  "hp=100,,100",
  "party=hero,alda,alda",
  "party=hero,missing,mort",
  "foes=missing",
  "at=7000&duration=6000",
  "guides=true",
])("再現できない指定は理由付きで拒否する: %s", (query) => {
  expect(getPreviewRequest(new URLSearchParams(query))).toBeInstanceOf(Error)
})
it("playのパスとsceneが食い違ったら起動しない", () => {
  expect(
    getPreviewRequest(new URLSearchParams("scene=town"), "battle")
  ).toBeInstanceOf(Error)
})
it("台本付きのメニューは操作と停止時刻を引き継ぐ", () => {
  const request = getPreviewRequest(new URLSearchParams("scene=guild-quests"))
  if (request instanceof Error) throw request
  expect(
    request.config.actions.some((action) => action.label === "クエスト")
  ).toBe(true)
  expect(request.at).toBeGreaterThan(request.config.actions[0].at)
})
it("上限の60秒も有効な停止時刻として扱う", () => {
  expect(getPreviewRequest(new URLSearchParams("at=60000"))).toMatchObject({
    at: 60000,
    config: { duration: 60000 },
  })
})
