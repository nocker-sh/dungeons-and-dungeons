/** 手元のSVGを入れ物いっぱいに広げる（style の無い <svg> にだけ付ける）。 */
export function fill(html: string) {
  return html.replace(
    /^<svg(?![^>]*\sstyle=)/,
    '<svg style="display:block;width:100%;height:100%"'
  )
}
