import type { CliOptions } from "@/builder/cli/options"

export function printResult(
  options: CliOptions,
  data: unknown,
  text: () => string
) {
  console.log(options.json ? JSON.stringify(data, null, 2) : text())
}
