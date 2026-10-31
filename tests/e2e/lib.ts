export const BASE_URL = (
  process.env.E2E_BASE_URL ?? "https://dungeon.localhost"
).replace(/\/$/, "")

/** スマホ（縦長）とPC（横長）。 */
export const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
] as const
