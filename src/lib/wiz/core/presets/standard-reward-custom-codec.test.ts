import { describe, expect, it } from "vite-plus/test"
import { z } from "zod"
import {
  WizStandardRewardCustomCodec,
  WizStandardSessionCodec,
} from "@/lib/wiz/core/presets/standard-session"

describe("WizStandardRewardCustomCodec authenticity", () => {
  it("defineで生成したcodecだけをsession codecへ登録できる", () => {
    const rewardCustom = WizStandardRewardCustomCodec.define({
      schema: z.strictObject({
        rank: z.string(),
      }),
      capture: (custom) => custom,
    })

    expect(
      WizStandardSessionCodec.create({
        contentVersion: "reward-codec-test",
        rewardCustom,
      }),
    ).toBeInstanceOf(WizStandardSessionCodec)
  })

  it("prototypeを偽装したcodecをcreate境界で拒否する", () => {
    const forged = Object.freeze(Object.create(WizStandardRewardCustomCodec.prototype))
    const createSessionCodec = Reflect.get(WizStandardSessionCodec, "create")

    expect(() =>
      Reflect.apply(createSessionCodec, WizStandardSessionCodec, [
        {
          contentVersion: "reward-codec-test",
          rewardCustom: forged,
        },
      ]),
    ).toThrow(
      "Standard session reward custom codecs must be created by WizStandardRewardCustomCodec.define()",
    )
  })

  it("classとprototypeを固定する", () => {
    expect(Object.isFrozen(WizStandardRewardCustomCodec)).toBe(true)
    expect(Object.isFrozen(WizStandardRewardCustomCodec.prototype)).toBe(true)
  })
})
