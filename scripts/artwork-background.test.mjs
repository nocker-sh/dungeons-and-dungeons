import { test } from "vite-plus/test"
import assert from "node:assert/strict"
import { removeWhiteBackground } from "./artwork-background.cjs"

function fixture() {
  const width = 9
  const height = 9
  const data = Buffer.alloc(width * height * 4, 255)
  const paint = (x, y, color) => data.set(color, (y * width + x) * 4)
  const alpha = (x, y) => data[(y * width + x) * 4 + 3]
  // A black contour encloses white fabric. Exterior white is background.
  for (let y = 2; y <= 6; y++)
    for (let x = 2; x <= 6; x++)
      if (x === 2 || x === 6 || y === 2 || y === 6)
        paint(x, y, [10, 10, 10, 255])
  return { data, width, height, paint, alpha }
}

test("white clothing and original RGB survive the exterior mask", () => {
  const f = fixture()
  const before = Buffer.from(f.data)
  removeWhiteBackground(f.data, f.width, f.height)
  assert.equal(f.alpha(0, 0), 0)
  assert.equal(f.alpha(4, 4), 255)
  assert.equal(f.alpha(2, 4), 255)
  for (let index = 0; index < f.data.length; index += 4)
    assert.deepEqual(
      f.data.subarray(index, index + 3),
      before.subarray(index, index + 3)
    )
})

test("neutral off-white backdrop is selectable without removing pale colored artwork", () => {
  const f = fixture()
  f.paint(0, 1, [233, 234, 235, 255])
  f.paint(0, 2, [255, 236, 206, 255])
  removeWhiteBackground(f.data, f.width, f.height, {
    minimum: 232,
    borderMinimum: 232,
    maximumChroma: 16,
  })
  assert.equal(f.alpha(0, 1), 0)
  assert.equal(f.alpha(0, 2), 255)
  assert.equal(f.alpha(4, 4), 255)
})

test("a seed on the ink boundary snaps into a reviewed enclosed background hole", () => {
  const f = fixture()
  f.paint(1, 4, [10, 10, 10, 255])
  const result = removeWhiteBackground(f.data, f.width, f.height, {
    backgroundSeedsOnly: true,
    backgroundSeeds: [[2, 4]],
    seedSearchRadius: 1,
  })
  assert.equal(result.adjustedSeeds.length, 1)
  assert.equal(f.alpha(4, 4), 0)
  assert.equal(f.alpha(0, 0), 255)
  assert.equal(f.alpha(2, 4), 255)
  assert.equal(result.unmatchedSeeds.length, 0)
})

test("explicit interior seeds remove only their region, not another white region", () => {
  const f = fixture()
  removeWhiteBackground(f.data, f.width, f.height, {
    backgroundSeedsOnly: true,
    backgroundSeeds: [[4, 4]],
  })
  assert.equal(f.alpha(4, 4), 0)
  assert.equal(f.alpha(0, 0), 255)
  assert.equal(f.alpha(2, 4), 255)
})

test("missing and out-of-range seeds are reported without changing pixels", () => {
  const f = fixture()
  const before = Buffer.from(f.data)
  const result = removeWhiteBackground(f.data, f.width, f.height, {
    backgroundSeedsOnly: true,
    backgroundSeeds: [
      [2, 4],
      [-1, 4],
    ],
    seedSearchRadius: 0,
  })
  assert.deepEqual(result.unmatchedSeeds, [
    [2, 4],
    [-1, 4],
  ])
  assert.deepEqual(f.data, before)
})

test("white fabric at the lower cut is kept when the bottom border is protected", () => {
  const f = fixture()
  f.paint(4, 6, [255, 255, 255, 255])
  for (let y = 6; y < 9; y++) {
    f.paint(3, y, [10, 10, 10, 255])
    f.paint(5, y, [10, 10, 10, 255])
  }
  removeWhiteBackground(f.data, f.width, f.height, {
    preserveBottomWhite: true,
  })
  assert.equal(f.alpha(4, 8), 255)
  assert.equal(f.alpha(4, 4), 255)
  assert.equal(f.alpha(0, 0), 0)
})

test("stronger interior tolerance does not leak through gray gaps at the exterior", () => {
  const f = fixture()
  f.paint(2, 4, [234, 234, 234, 255])
  removeWhiteBackground(f.data, f.width, f.height, { minimum: 232 })
  assert.equal(f.alpha(0, 0), 0)
  assert.equal(f.alpha(2, 4), 255)
  assert.equal(f.alpha(4, 4), 255)
})
