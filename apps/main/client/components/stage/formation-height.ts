/** 隊列は一列。横長の画面のときは低く、縦長のときは札を縦長にするので高く。 */
export function formationHeight(wide: boolean) {
  return wide ? "13vh" : "24vh"
}
