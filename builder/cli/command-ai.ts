import type { CliOptions } from "@/builder/cli/options"
import { commandPlay } from "@/builder/cli/command-play"

/** 一歩ずつ遊ぶ。--save のファイルに続きを残す。 */
/** AI が遊ぶときの保存先。ブラウザ（開発サーバーで ?save=tmp）と同じファイルを使う。 */
export const AI_SAVE = process.env.DND_SAVE ?? "/tmp/dnd/save.json"

/** AI が遊ぶ入口。保存は既定で AI_SAVE（ブラウザと共有できる）。 */
export function commandAi(options: CliOptions) {
  commandPlay({ ...options, save: options.save ?? AI_SAVE })
}
