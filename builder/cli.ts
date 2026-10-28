/// <reference types="node" />
/** ブラウザなしでゲームを動かす入口。使い方は builder/README.md。 */
import { runCli } from "@/builder/cli/main"

await runCli(process.argv.slice(2))
