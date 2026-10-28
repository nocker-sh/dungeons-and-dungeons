import { useMemo } from "react"
import { Table } from "@/client/components/ui/table"
import { TableBody } from "@/client/components/ui/table-body"
import { TableCaption } from "@/client/components/ui/table-caption"
import { TableCell } from "@/client/components/ui/table-cell"
import { TableHead } from "@/client/components/ui/table-head"
import { TableHeader } from "@/client/components/ui/table-header"
import { TableRow } from "@/client/components/ui/table-row"
import { simulateGrowth, statLabels } from "@/development/simulate-growth"
import type { GrowthMember } from "@/development/growth-member-of"
import { formatRange } from "@/client/components/dev/format-range"

export const MAX_LEVEL = 20

export const RUNS = 200

/** 仲間ひとりの成長のシミュレーションと必要経験値。キャラの詳細ページに置く。 */
export type Props = { member: GrowthMember }

export function GrowthSection(props: Props) {
  const rows = useMemo(
    () => simulateGrowth(props.member.id, MAX_LEVEL, RUNS),
    [props.member.id]
  )
  if (!props.member.grows)
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>悪魔の力で戦う</h2>
        <p className="text-sm text-muted-foreground">
          主人公本人の能力は成長しない。契約した悪魔のレベルで合体の効果が変わる。衣装は見た目だけで、防具は装備しない。
        </p>
      </section>
    )
  return (
    <section style={{ marginTop: 32 }}>
      <header style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>成長</h2>
        <p className="text-sm text-muted-foreground">
          {`加入時 Lv${props.member.startLevel} から、今のエンジンの成長規則で Lv${MAX_LEVEL} まで上げた結果。速さは確率で伸びるため${RUNS}回試した平均と幅（最小〜最大）。装備の補正は含まない。`}
          {props.member.sharedGrowth
            ? "個別の伸びがなく、共通の伸びを使う。"
            : "個別の伸びを使う。"}
        </p>
      </header>
      <Table>
        <TableCaption>レベルごとの能力と必要経験値</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Lv</TableHead>
            <TableHead className="text-right">次のLvまで</TableHead>
            <TableHead className="text-right">加入時からの累計</TableHead>
            {statLabels.map((stat) => (
              <TableHead key={stat.key} className="text-right">
                {stat.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.level}>
              <TableCell>{row.level}</TableCell>
              <TableCell className="text-right">{row.expToNext}</TableCell>
              <TableCell className="text-right">{row.totalExp}</TableCell>
              {statLabels.map((stat) => (
                <TableCell key={stat.key} className="text-right">
                  {formatRange(row.stats[stat.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
