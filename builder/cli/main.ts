import { parseOptions, type CliOptions } from "./options"
import { commandInspect } from "./inspect"
import { commandPlay, commandAi } from "./play"
import { commandBattle, commandCurve } from "./battle"
import { commandDungeon, commandDepth, commandCampaign } from "./expedition"
import { commandFun, commandPlaylog } from "./fun"
import { commandReport, commandSweep } from "./report"
import { commandTune } from "./tune"
import { commandApply } from "./apply"

const HELP = `bun builder/cli.ts <command> [options]
  inspect                          データの数値を一覧
  ai [操作...]                     AIが遊ぶ入口。保存は /tmp/dnd/save.json（DND_SAVE で変更・ブラウザの ?save=tmp と共有）
                                   --new で最初から、--scene <場面slug> で途中の場面から、--script file で台本、--json で構造化
                                   look shops|shop <店>|recruits|quests|rooms|smithy|gear|member <仲間>|skill <ワザ>|foe <敵>
  play [操作...]                   一歩ずつ遊ぶ（--save file で続きを残す、--new で最初から）
  battle <foe,foe> [--boss]        戦闘の勝率と中身（誰が削ったか・使った手。--level N で育てた状態）
  curve <foe,foe> [--boss]         レベルごとの勝率（勝率50%に届くレベル）
  dungeon <layer>                  層を一回潜る率（--push で撤退なし）
  depth <layer>                    深さごとの稼ぎと危なさ（--depths 2,4,8,16）
  campaign                         街と探索をくり返す一周（--expeditions N --layers N）
  fun                              面白さの数字（テンポ・当たり・成長・緊張・判断）を目安と並べる（--runs N）
  playlog                          一周を自動で遊び、出撃ごとの出来事を読める形で出す（--seed N）
  report                           バランス目標を測る
  check                            report と同じ。外れがあれば終了コード1
  apply --set ... | --sets file     上書きを src/lib/content/data の JSON へ書き戻す
  sweep --param <path> --values a,b [--metric report|battle:<foes>|curve:<foes>|dungeon:<layer>|campaign]
  tune <spec>                      目標から外れた数値を自動で範囲へ入れる（例: builder/tunings/layer0.ts）
options: --runs N --seed N --set <path=value> --sets <file> --json --style smart|attack|random --no-cache
         --level N --weapons --reached N --depths 2,4,8,16 --retreat 0.35 --boss-ready 0.7 --push --no-heal --potions N --no-shop
tune の options: --seeds 1,7,23 --budget N --targets id,id --out <file> --apply`

type CliCommand = {
  run: (options: CliOptions) => void | Promise<void>
  consumeName?: boolean
}
const commands = new Map<string, CliCommand>([
  ["inspect", { run: commandInspect }],
  ["play", { run: commandPlay }],
  ["ai", { run: commandAi }],
  ["battle", { run: commandBattle, consumeName: true }],
  ["curve", { run: commandCurve, consumeName: true }],
  ["dungeon", { run: commandDungeon, consumeName: true }],
  ["depth", { run: commandDepth, consumeName: true }],
  ["campaign", { run: commandCampaign }],
  ["fun", { run: commandFun }],
  ["playlog", { run: commandPlaylog }],
  ["report", { run: (options) => commandReport(options, false) }],
  ["check", { run: (options) => commandReport(options, true) }],
  ["sweep", { run: commandSweep }],
  ["tune", { run: commandTune, consumeName: true }],
  ["apply", { run: commandApply }],
])

/** 引数の解釈とコマンドの実行。処理の実体は各モジュールへ置く。 */
export async function runCli(argv: string[]) {
  try {
    const options = parseOptions(argv)
    const command = commands.get(options.positional[0])
    if (!command) {
      console.log(HELP)
      return
    }
    if (command.consumeName) options.positional.shift()
    await command.run(options)
  } catch (error) {
    console.error(
      `エラー: ${error instanceof Error ? error.message : String(error)}`
    )
    process.exitCode = 1
  }
}
