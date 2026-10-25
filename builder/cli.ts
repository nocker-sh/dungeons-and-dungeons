/// <reference types="node" />
/** ブラウザなしでゲームを動かす入口。使い方は builder/README.md。 */
import { runCli } from "./cli/main"
export { AI_SAVE } from "./cli/play"

await runCli(process.argv.slice(2))
