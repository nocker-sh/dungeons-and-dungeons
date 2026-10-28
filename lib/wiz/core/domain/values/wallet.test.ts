import { describe, expect, it } from "vite-plus/test"
import { WizWallet, WizWalletOperationError } from "@/lib/wiz/core/domain/values/wallet"

describe("WizWallet", () => {
  it("複数通貨を原子的に増減する", () => {
    const wallet = WizWallet.create({
      gold: 100,
      token: 3,
    })
    const debited = wallet.debit({
      gold: 30,
      token: 1,
    })
    const credited = debited.credit({
      gold: 5,
    })

    expect(wallet.balance("gold")).toBe(100)
    expect(debited.toPlain()).toEqual({
      gold: 70,
      token: 2,
    })
    expect(credited.balance("gold")).toBe(75)
  })

  it("不足と未知通貨を安定したerrorで拒否する", () => {
    const wallet = WizWallet.create({
      rupee: 5,
    })

    expect(() => wallet.debit({ rupee: 6 })).toThrow(
      expect.objectContaining({
        available: 5,
        code: "CURRENCY_INSUFFICIENT",
        currencyId: "rupee",
        required: 6,
      }),
    )
    expect(() => wallet.credit({ missing: 1 } as never)).toThrow(WizWalletOperationError)
  })
})
