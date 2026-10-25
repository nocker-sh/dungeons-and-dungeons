// Run with Node and sharp available (NODE_PATH may point to an existing installation).
const sharp = require("sharp")
const fs = require("node:fs/promises")
const path = require("node:path")
const { removeWhiteBackground } = require("./artwork-background.cjs")

async function main() {
  const concurrency = Number(process.env.ARTWORK_CONCURRENCY ?? 1)
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
    throw Error("ARTWORK_CONCURRENCY must be an integer from 1 to 4")
  const rows = JSON.parse(
    await fs.readFile("private/art/import-manifest.json", "utf8")
  )
  await fs.mkdir("public/images", { recursive: true })
  const filters = process.argv.slice(2)
  const report = filters.length
    ? JSON.parse(
        await fs.readFile("private/art/output-manifest.json", "utf8")
      ).filter(
        (entry) =>
          !filters.some((filter) =>
            entry.image.endsWith(filter.replace(/\.png$/, ".webp"))
          )
      )
    : []
  const selectedRows = rows.filter(
    (row) => !row.retired && (!filters.length || filters.includes(row.name))
  )
  const results = Array.from({ length: selectedRows.length })
  let nextIndex = 0
  let failure
  const workers = Array.from(
    { length: Math.min(concurrency, selectedRows.length) },
    async () => {
      while (!failure && nextIndex < selectedRows.length) {
        const index = nextIndex++
        try {
          results[index] = await prepareRow(selectedRows[index])
        } catch (error) {
          failure = error
        }
      }
    }
  )
  await Promise.all(workers)
  if (failure) throw failure
  report.push(...results)
  await fs.writeFile(
    "private/art/output-manifest.json",
    JSON.stringify(report, null, 2) + "\n"
  )
}

async function prepareRow(row) {
  const scene = row.name.startsWith("scenes/")
  const original = path.join("private/art/originals", row.name)
  const cutout = path.join("private/art/cutouts", row.name)
  const hasCutout = await fs.access(cutout).then(
    () => true,
    () => false
  )
  const { data, info } = await sharp(hasCutout ? cutout : original)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  if (!scene && (!hasCutout || row.backgroundSeeds?.length)) {
    const result = removeWhiteBackground(data, width, height, {
      ...row.backgroundRemoval,
      backgroundSeeds: row.backgroundSeeds,
      preserveBottomWhite: row.preserveBottomWhite,
      // Existing cutouts already contain the approved exterior alpha.
      backgroundSeedsOnly: hasCutout || row.backgroundSeedsOnly,
    })
    if (result.adjustedSeeds.length)
      console.log(
        `${row.name}: adjusted background seeds ${JSON.stringify(result.adjustedSeeds)}`
      )
    if (result.unmatchedSeeds.length)
      console.warn(
        `${row.name}: background seeds found no white region ${JSON.stringify(result.unmatchedSeeds)}`
      )
  }

  if (row.removeWhiteFringe) {
    // Unmix the white matte only beside transparency and a dark ink outline.
    // Read from a snapshot so the correction cannot creep into the artwork.
    const source = Buffer.from(data)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 4
        if (!source[p + 3]) continue
        const light = Math.max(source[p], source[p + 1], source[p + 2])
        if (light < 65) continue
        let outside = false
        let ink = -1
        let nearest = Infinity
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const nx = x + dx,
              ny = y + dy
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
            const q = (ny * width + nx) * 4
            const distance = dx * dx + dy * dy
            if (distance <= 4 && source[q + 3] === 0) outside = true
            if (
              source[q + 3] === 255 &&
              Math.max(source[q], source[q + 1], source[q + 2]) < 65 &&
              distance < nearest
            ) {
              nearest = distance
              ink = q
            }
          }
        }
        if (!outside || ink < 0) continue
        const alpha = Math.max(
          0,
          Math.min(
            1,
            (255 - light) /
              (255 - Math.max(source[ink], source[ink + 1], source[ink + 2]))
          )
        )
        for (let c = 0; c < 3; c++) data[p + c] = source[ink + c]
        data[p + 3] = Math.round(source[p + 3] * alpha)
      }
    }
  }
  // Pad to exact 3:4 without resampling or cropping any source pixel.
  const aspectWidth =
    row.aspect === "square" ? 1 : row.aspect === "landscape" ? 4 : 3
  const aspectHeight =
    row.aspect === "square" ? 1 : row.aspect === "landscape" ? 3 : 4
  const unit = Math.ceil(Math.max(width / aspectWidth, height / aspectHeight))
  const targetWidth = scene ? width : unit * aspectWidth,
    targetHeight = scene ? height : unit * aspectHeight
  const left = Math.floor((targetWidth - width) / 2)
  const top =
    row.verticalAlign === "bottom"
      ? targetHeight - height
      : Math.floor((targetHeight - height) / 2)
  const padded = await sharp(data, { raw: { width, height, channels: 4 } })
    .extend({
      left,
      right: targetWidth - width - left,
      top,
      bottom: targetHeight - height - top,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .raw()
    .toBuffer()
  const filename = row.name.replace(/\.png$/, ".webp")
  const output = path.join(scene ? "public/art" : "public/images", filename)
  await fs.mkdir(path.dirname(output), { recursive: true })
  const originalSize = (await fs.stat(output).catch(() => null))?.size
  let psnr = 0
  let quality = 82
  let lossless = false
  let encoded
  for (const setting of [82, 86, 90, 95, 100, "lossless"]) {
    lossless = setting === "lossless"
    quality = lossless ? 100 : setting
    encoded = await sharp(padded, {
      raw: { width: targetWidth, height: targetHeight, channels: 4 },
    })
      .webp({ quality, lossless, alphaQuality: 100, effort: 6 })
      .toBuffer()
    const decoded = await sharp(encoded).ensureAlpha().raw().toBuffer()
    let squaredError = 0
    let colorSamples = 0
    for (let i = 0; i < padded.length; i += 4) {
      if (decoded[i + 3] !== padded[i + 3])
        throw Error(`Alpha mismatch: ${filename}`)
      if (!padded[i + 3]) continue
      for (let channel = 0; channel < 3; channel++) {
        const difference = decoded[i + channel] - padded[i + channel]
        squaredError += difference * difference
        colorSamples++
      }
    }
    psnr = 10 * Math.log10((255 * 255) / (squaredError / colorSamples))
    if (psnr >= 36) break
  }
  if (psnr < 36)
    throw Error(
      `Visual quality below target: ${filename} (${psnr.toFixed(1)} dB)`
    )
  await fs.writeFile(output, encoded)
  const outputSize = (await fs.stat(output)).size
  const result = {
    old: row.old,
    image: scene ? `/art/${filename}` : `/images/${filename}`,
    width,
    height,
    targetWidth,
    targetHeight,
    left,
    top,
  }
  console.log(
    `${filename}: ${targetWidth}x${targetHeight}, ${lossless ? "lossless" : `Q${quality}`}, ${psnr.toFixed(1)} dB, ${originalSize ?? "new"} -> ${outputSize} bytes`
  )
  return result
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
