import { describe, expect, it } from "vite-plus/test"
import { parseOptions } from "@/builder/cli/options"

describe("戦闘方針の指定", () => {
  it.each(["attak", "SMART", "", " ", "--json"])(
    "不正な方針 %j を既定の方針として扱わない",
    (style) => {
      expect(() => parseOptions(["battle", "--style", style])).toThrow(
        "--style"
      )
    }
  )

  it.each(["smart", "attack", "random"])("%s をそのまま渡す", (style) => {
    expect(parseOptions(["battle", "--style", style]).style).toBe(style)
  })

  it("指定しないときはsmartを使い、値の欠落は拒否する", () => {
    expect(parseOptions(["battle"]).style).toBe("smart")
    expect(() => parseOptions(["battle", "--style"])).toThrow(
      "--style の値がない"
    )
  })
})

describe("数値オプション", () => {
  it.each([
    "--runs",
    "--seed",
    "--budget",
    "--level",
    "--retreat",
    "--boss-ready",
    "--expeditions",
    "--layers",
    "--potions",
    "--reached",
    "--seeds",
    "--depths",
  ])("%s の文字列・無限大・空欄を拒否する", (option) => {
    for (const value of ["banana", "NaN", "Infinity", "-Infinity", "", " "])
      expect(() => parseOptions(["battle", option, value])).toThrow(option)
  })

  it.each(["--runs", "--budget", "--level", "--expeditions", "--layers"])(
    "%s は正の整数を要求する",
    (option) => {
      for (const value of ["0", "-1", "1.5", "9007199254740992"])
        expect(() => parseOptions(["battle", option, value])).toThrow(option)
      expect(() => parseOptions(["battle", option, "1"])).not.toThrow()
    }
  )

  it.each(["--potions", "--reached"])(
    "%s は0を許可し、負数と小数を拒否する",
    (option) => {
      for (const value of ["-1", "0.5"])
        expect(() => parseOptions(["battle", option, value])).toThrow(option)
      expect(() => parseOptions(["battle", option, "0"])).not.toThrow()
    }
  )

  it.each(["--retreat", "--boss-ready"])(
    "%s は0から1までの割合を受ける",
    (option) => {
      for (const value of ["-0.1", "1.1"])
        expect(() => parseOptions(["dungeon", option, value])).toThrow(option)
      for (const value of ["0", "0.35", "1"])
        expect(() => parseOptions(["dungeon", option, value])).not.toThrow()
    }
  )

  it.each(["--seeds", "--depths"])(
    "%s は不正な要素を黙って捨てない",
    (option) => {
      for (const value of ["1,wrong,7", "1,,7", "1,", ",1", "1,Infinity"])
        expect(() => parseOptions(["tune", option, value])).toThrow(option)
    }
  )

  it("整数の種と小数の深さを、指定した順序のまま保持する", () => {
    const options = parseOptions([
      "depth",
      "layer0",
      "--seed",
      "-7",
      "--seeds",
      "0,-7,23",
      "--depths",
      "0,2.5,16",
      "--potions",
      "0",
      "--reached",
      "0",
    ])
    expect(options.seed).toBe(-7)
    expect(options.seeds).toEqual([0, -7, 23])
    expect(options.depths).toEqual([0, 2.5, 16])
    expect(options.potions).toBe(0)
    expect(options.reached).toBe(0)
    expect(options.positional).toEqual(["depth", "layer0"])
    expect(() => parseOptions(["battle", "--seed", "0.5"])).toThrow("--seed")
    expect(() => parseOptions(["tune", "--seeds", "1,0.5"])).toThrow("--seeds")
    expect(() => parseOptions(["depth", "--depths", "1,-2"])).toThrow(
      "--depths"
    )
  })
})
