import { chromium } from "playwright"

export async function launch() {
  return chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL,
    args: process.env.PLAYWRIGHT_SOFTWARE === "1" ? ["--disable-gpu"] : [],
  })
}
