import ts from "typescript"
import { expect, it } from "vite-plus/test"
import { exportedFunctionNames } from "@/scripts/exported-function-names"

it.each([
  [
    "const factory = () => () => true; export const first = factory(); export const second = factory()",
    ["first", "second"],
  ],
  [
    "export function parse(value: string): string; export function parse(value: number): string; export function parse(value: string | number) { return String(value) }",
    ["parse"],
  ],
])("ファクトリとoverloadを実際の関数の型で数える: %s", (text, names) => {
  const host = ts.createCompilerHost({ noLib: true })
  host.getSourceFile = (file) =>
    file === "/sample.ts"
      ? ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
      : undefined
  const program = ts.createProgram(["/sample.ts"], { noLib: true }, host)
  const source = program.getSourceFile("/sample.ts")
  if (!source) throw new Error("検査用ソースがない")
  expect(exportedFunctionNames(program.getTypeChecker(), source)).toEqual(names)
})
