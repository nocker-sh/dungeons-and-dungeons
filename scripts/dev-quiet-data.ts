/// <reference types="node" />
/**
 * 開発サーバーだけ：作品データの JSON（`concept/data`・`content/data`）が書き換わっても、
 * 開いているゲームを再読み込みしない。画像や台本を別の作業で足すたびに、遊んでいる途中の画面が戻されるため。
 * 古い中身は Vite が先に捨てるので、自分で再読み込みすれば新しいデータで始まる。
 */
import type { Plugin } from "vite"

const DATA_JSON = /[\\/](concept|content)[\\/]data[\\/][^\\/]+\.json$/

export function devQuietData(): Plugin {
  return {
    name: "dnd-dev-quiet-data",
    apply: "serve",
    enforce: "pre",
    hotUpdate({ file }) {
      if (DATA_JSON.test(file)) return []
    },
  }
}
