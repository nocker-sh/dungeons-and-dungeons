import { describe, expect, it } from "vite-plus/test"
import { heroName, katakanaOf } from "./hero-name"

describe("主人公の名前", () => {
  it("入力欄にはカタカナだけを残す", () => {
    expect(katakanaOf("のあ")).toBe("ノア")
    expect(katakanaOf("ﾉｱ")).toBe("ノア")
    expect(katakanaOf("ノア 1a!漢")).toBe("ノア")
    expect(katakanaOf("ルーカ")).toBe("ルーカ")
    expect(katakanaOf("")).toBe("")
  })

  it("整えた名前はそのまま受け付けられる", () => {
    expect(heroName(katakanaOf("のあ"))).toBe("ノア")
    expect(heroName(katakanaOf("abc"))).toBeNull()
  })
})
