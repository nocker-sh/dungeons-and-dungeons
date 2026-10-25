import { useMemo } from "react"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  simulateGrowth,
  statLabels,
  type GrowthMember,
  type StatRange,
} from "@/lib/dev/growth"

const MAX_LEVEL = 20
const RUNS = 200

function formatRange(range: StatRange) {
  const average = Number.isInteger(range.average)
    ? String(range.average)
    : range.average.toFixed(1)
  return range.min === range.max
    ? average
    : `${average}（${range.min}〜${range.max}）`
}

/** 仲間ひとりの成長のシミュレーションと必要経験値。キャラの詳細ページに置く。 */
export function GrowthSection({ member }: { member: GrowthMember }) {
  const rows = useMemo(
    () => simulateGrowth(member.id, MAX_LEVEL, RUNS),
    [member.id]
  )
  if (!member.grows)
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
          {`加入時 Lv${member.startLevel} から、今のエンジンの成長規則で Lv${MAX_LEVEL} まで上げた結果。速さは確率で伸びるため${RUNS}回試した平均と幅（最小〜最大）。装備の補正は含まない。`}
          {member.sharedGrowth
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
