import { expect, it } from "vite-plus/test"
import { sourceProblems } from "@/scripts/source-problems"

it.each([
  'export { Item } from "./item"',
  'export type { Item } from "./item"',
  'export * from "./item"',
  'import { Item } from "./item"; export { Item }',
  'import Item from "./item"; export default Item',
])("転送用のexportを拒否する: %s", (source) => {
  expect(sourceProblems("sample.ts", source)).not.toEqual([])
})

it("そのファイルで定義した値と型はexportできる", () => {
  expect(
    sourceProblems(
      "item.ts",
      "export type Item = { id: string }; export const value = 1"
    )
  ).toEqual([])
})

it.each([
  [
    "index.tsx",
    "type Props = {}; export function ListView(props: Props) { return null }",
  ],
  [
    "list.tsx",
    "type Props = {}; export function ListView(props: Props) { return null }",
  ],
  [
    "list-view.tsx",
    "type Props = { name: string }; export function ListView({name}: Props) { return name }",
  ],
  [
    "list-view.tsx",
    "type Props = { name: string }; export function ListView(props: Props) { const {name} = props; return name }",
  ],
  [
    "list-view.tsx",
    "export function ListView(props: { name: string }) { return props.name }",
  ],
])("名前とpropsの規約違反を拒否する: %s", (file, source) => {
  expect(sourceProblems(file, source)).not.toEqual([])
})

it("名前とPropsが一致した部品を許可する", () => {
  expect(
    sourceProblems(
      "list-view.tsx",
      "type Props = { name: string }; export function ListView(props: Props) { return props.name }"
    )
  ).toEqual([])
})

it.each([
  "type ScrollInput = { grid: unknown }; export function useListScroll({ grid }: ScrollInput) { return grid }",
  "type Props = { grid: unknown }; export function useListScroll(input: Props) { return input.grid }",
  "type Props = { grid: unknown }; export function useListScroll(props: Props) { const { grid } = props; return grid }",
])(
  "tsのフックでも入力の分割代入とProps以外の受け取りを拒否する: %s",
  (source) => {
    expect(sourceProblems("use-list-scroll.ts", source)).not.toEqual([])
  }
)

it("tsのフックでprops: Propsを許可する", () => {
  expect(
    sourceProblems(
      "use-list-scroll.ts",
      "type Props = { grid: unknown }; export function useListScroll(props: Props) { return props.grid }"
    )
  ).toEqual([])
})

it.each([
  "export function openingCast() {} export function castLines() {}",
  "export const openingCast = () => []; export const castLines = () => []",
  "export function openingCast() {} export const castLines = function () {}",
])("複数の関数のexportを拒否する: %s", (source) => {
  expect(sourceProblems("conversation-cast.ts", source)).not.toEqual([])
})

it("同じ関数のoverloadは1つと数える", () => {
  expect(
    sourceProblems(
      "format.ts",
      "export function format(value: string): string; export function format(value: number): string; export function format(value: string | number) { return String(value) }"
    )
  ).toEqual([])
})

it.each([
  'import data from "./data.json"; export const players = data',
  'import * as Library from "library"; export const Widget = Library.Widget',
])("importした値を別名のconstで再公開しない: %s", (source) => {
  expect(sourceProblems("forward.ts", source)).not.toEqual([])
})
