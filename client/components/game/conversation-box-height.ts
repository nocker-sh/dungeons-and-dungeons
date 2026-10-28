/** セリフ枠と立ち絵が共有する、画面全体を基準にした境界。 */
export function conversationBoxHeight(wideFormation: boolean) {
  // 2行のセリフが入る高さ。高すぎると文の上下が空く
  return wideFormation ? "16vh" : "16vh"
}
