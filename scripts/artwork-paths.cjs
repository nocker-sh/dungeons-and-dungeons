const path = require("node:path")

/** 公開先は原画の名前から推測せず、取り込み表の image に明記する。 */
function artworkOutputPath(image) {
  if (
    typeof image !== "string" ||
    !/^\/tmp\/[a-z][a-z-]*\/(?:v\d+\/)?[^/\\]+\.webp$/.test(image)
  )
    throw new Error(
      "import-manifest の image に /tmp/<分類>/[v1/]<名前>.webp を指定してください"
    )
  return path.join("public", image)
}

module.exports = { artworkOutputPath }
