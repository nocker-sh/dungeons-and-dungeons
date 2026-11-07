export function dataDirectory(): URL {
  return new URL("./data/", import.meta.url)
}
