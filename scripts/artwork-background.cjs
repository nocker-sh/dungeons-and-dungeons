// Quantize only the selection mask. Never quantize the illustration's RGB values.
function removeWhiteBackground(data, width, height, options = {}) {
  const minimum = options.minimum ?? 240
  const borderMinimum = options.borderMinimum ?? 240
  const maximumChroma = options.maximumChroma ?? 24
  const seedSearchRadius = options.seedSearchRadius ?? 8
  if (
    !Number.isInteger(borderMinimum) ||
    borderMinimum < minimum ||
    borderMinimum > 255 ||
    !Number.isInteger(minimum) ||
    minimum < 0 ||
    minimum > 255 ||
    !Number.isInteger(maximumChroma) ||
    maximumChroma < 0 ||
    maximumChroma > 255 ||
    !Number.isInteger(seedSearchRadius) ||
    seedSearchRadius < 0 ||
    seedSearchRadius > 32
  )
    throw new Error("Invalid white-background selection settings")

  const selection = new Uint8Array(width * height)
  for (let index = 0; index < selection.length; index++) {
    const offset = index * 4
    const darkest = Math.min(data[offset], data[offset + 1], data[offset + 2])
    const lightest = Math.max(data[offset], data[offset + 1], data[offset + 2])
    selection[index] =
      darkest >= minimum && lightest - darkest <= maximumChroma ? 1 : 0
  }
  const queue = new Int32Array(selection.length)
  let head = 0
  let tail = 0
  let removedPixels = 0
  let activeMinimum = borderMinimum
  const visit = (index) => {
    if (selection[index] !== 1) return
    const offset = index * 4
    if (
      Math.min(data[offset], data[offset + 1], data[offset + 2]) < activeMinimum
    )
      return
    selection[index] = 2
    queue[tail++] = index
    if (data[index * 4 + 3]) removedPixels++
    data[index * 4 + 3] = 0
  }
  const drain = () => {
    while (head < tail) {
      const index = queue[head++]
      const x = index % width
      const y = Math.floor(index / width)
      if (x) visit(index - 1)
      if (x + 1 < width) visit(index + 1)
      if (y) visit(index - width)
      if (y + 1 < height) visit(index + width)
    }
  }
  if (!options.backgroundSeedsOnly) {
    for (let x = 0; x < width; x++) {
      visit(x)
      if (!options.preserveBottomWhite) visit((height - 1) * width + x)
    }
    for (let y = 0; y < height; y++) {
      visit(y * width)
      visit(y * width + width - 1)
    }
  }
  // Keep the exterior conservative: gray gaps in ink must not expose white fabric.
  drain()
  activeMinimum = minimum
  const adjustedSeeds = []
  const unmatchedSeeds = []
  for (const seed of options.backgroundSeeds ?? []) {
    const [x, y] = seed
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      x >= width ||
      y < 0 ||
      y >= height
    ) {
      unmatchedSeeds.push(seed)
      continue
    }
    let nearest = -1
    let nearestDistance = Infinity
    for (let dy = -seedSearchRadius; dy <= seedSearchRadius; dy++) {
      for (let dx = -seedSearchRadius; dx <= seedSearchRadius; dx++) {
        const nextX = x + dx
        const nextY = y + dy
        const distance = dx * dx + dy * dy
        if (
          distance > seedSearchRadius * seedSearchRadius ||
          distance >= nearestDistance ||
          nextX < 0 ||
          nextX >= width ||
          nextY < 0 ||
          nextY >= height
        )
          continue
        const index = nextY * width + nextX
        if (!selection[index]) continue
        nearest = index
        nearestDistance = distance
      }
    }
    if (nearest < 0) unmatchedSeeds.push(seed)
    else {
      if (nearestDistance)
        adjustedSeeds.push({
          from: seed,
          to: [nearest % width, Math.floor(nearest / width)],
        })
      visit(nearest)
    }
  }
  drain()
  return { removedPixels, adjustedSeeds, unmatchedSeeds }
}

module.exports = { removeWhiteBackground }
