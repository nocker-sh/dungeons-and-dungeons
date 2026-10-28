/** 戦闘の中身の集計（誰がどれだけ削り、何を使ったか）。 */
export type Tally = {
  damage: Map<string, number>
  healing: Map<string, number>
  taken: Map<string, number>
  uses: Map<string, number>
}
