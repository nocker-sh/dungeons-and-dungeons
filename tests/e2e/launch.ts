import { chromium } from "playwright"

export async function launch() {
  return chromium.launch()
}
