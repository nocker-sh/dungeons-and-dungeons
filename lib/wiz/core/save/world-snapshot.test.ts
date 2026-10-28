import { describe, expect, it } from "vite-plus/test"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WorldSnapshot, zWorldSnapshotData } from "@/lib/wiz/core/save/world-snapshot"

const createValidSnapshotData = () => WorldSnapshot.fromVault(MOCK_VAULT).clonePlain()

describe("WorldSnapshot schema", () => {
  it("TypeScript private constructorのruntime迂回を拒否する", () => {
    expect(() => Reflect.construct(WorldSnapshot, [createValidSnapshotData()])).toThrow(TypeError)
  })

  it("typed createとunknown parseの入口を分離する", () => {
    const unknownInput: unknown = createValidSnapshotData()
    const verifyTypedCreate = () => {
      // @ts-expect-error typed createは不完全なsnapshotを受け付けない
      WorldSnapshot.create({ nope: true })
      // @ts-expect-error unknown入力はfromUnknownを使う
      WorldSnapshot.create(unknownInput)
    }

    void verifyTypedCreate
    expect(WorldSnapshot.fromUnknown(unknownInput)).toBeInstanceOf(WorldSnapshot)
  })

  it("unknown境界はprototype偽装を拒否し、plain DTOを所有する", () => {
    const valid = createValidSnapshotData()
    const mutablePlayer = { ...valid.player }
    const mutableSnapshot = { ...valid, player: mutablePlayer }
    const forgedSnapshot = Object.create(WorldSnapshot.prototype)
    Object.defineProperty(forgedSnapshot, "properties", {
      configurable: true,
      enumerable: false,
      value: mutableSnapshot,
      writable: true,
    })

    expect(() => WorldSnapshot.fromUnknown(forgedSnapshot)).toThrow(
      "WorldSnapshot instance failed runtime authenticity validation",
    )

    const canonicalSnapshot = WorldSnapshot.fromUnknown(mutableSnapshot)
    mutablePlayer.gold += 1

    expect(canonicalSnapshot.player.gold).toBe(valid.player.gold)
    expect(Object.isFrozen(canonicalSnapshot.toPlain())).toBe(true)
    expect(WorldSnapshot.fromUnknown(canonicalSnapshot)).toBe(canonicalSnapshot)
  })

  it("classとprototypeを凍結してauthentic snapshotのmethod差し替えを拒否する", () => {
    const snapshot = WorldSnapshot.fromVault(MOCK_VAULT)

    expect(Object.isFrozen(WorldSnapshot)).toBe(true)
    expect(Object.isFrozen(WorldSnapshot.prototype)).toBe(true)
    expect(Object.isFrozen(Object.getPrototypeOf(snapshot))).toBe(true)
    expect(Reflect.set(WorldSnapshot.prototype, "toPlain", () => ({ forged: true }))).toBe(false)
    expect(snapshot.toPlain()).toEqual(createValidSnapshotData())
  })

  it.each(["", "   ", " member "])(
    "空またはtrimされていないparty member IDを拒否する: %j",
    (id) => {
      const valid = createValidSnapshotData()
      const result = zWorldSnapshotData.safeParse({
        ...valid,
        partyMembers: [{ ...valid.partyMembers[0], id }],
      })

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["partyMembers", 0, "id"],
        }),
      )
    },
  )

  it("HP/MP/AP と max の root 相関を path 付きで集約する", () => {
    const valid = createValidSnapshotData()
    const result = zWorldSnapshotData.safeParse({
      ...valid,
      player: {
        ...valid.player,
        hp: valid.player.maxHp + 1,
        mp: (valid.player.maxMp ?? 0) + 1,
        ap: valid.player.maxAp + 1,
      },
      partyMembers: valid.partyMembers.map((member, index) =>
        index === 0
          ? {
              ...member,
              hp: member.maxHp + 1,
              mp: member.maxMp + 1,
            }
          : member,
      ),
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining([
        "player.hp",
        "player.mp",
        "player.ap",
        "partyMembers.0.hp",
        "partyMembers.0.mp",
      ]),
    )
    expect(result.error.issues.every((issue) => issue.message.includes("must"))).toBe(true)
  })

  it("非負 inventory/progress を schema 境界で拒否する", () => {
    const valid = createValidSnapshotData()
    const result = zWorldSnapshotData.safeParse({
      ...valid,
      inventory: {
        ...valid.inventory,
        entries: [
          {
            entryId: "herb-stack",
            contentType: "item",
            contentId: "herb",
            quantity: -1,
          },
        ],
        capacity: -1,
      },
      areas: [{ ...valid.areas[0], progress: -1 }],
      quests: [{ ...valid.quests[0], progress: -1 }],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining([
        "inventory.entries.0.quantity",
        "inventory.capacity",
        "areas.0.progress",
        "quests.0.progress",
      ]),
    )
  })

  it("quantity 0のinventory slotを拒否する", () => {
    const valid = createValidSnapshotData()

    expect(
      zWorldSnapshotData.safeParse({
        ...valid,
        inventory: {
          ...valid.inventory,
          entries: [
            {
              entryId: "herb-stack",
              contentType: "item",
              contentId: "herb",
              quantity: 0,
            },
          ],
        },
      }).success,
    ).toBe(false)
  })

  it("affinityの尺度を0..100へ固定しない", () => {
    const valid = createValidSnapshotData()
    const snapshot = WorldSnapshot.create({
      ...valid,
      npcs: [{ ...valid.npcs[0], affinity: -25 }],
    })

    expect(snapshot.npcs[0]?.affinity).toBe(-25)
  })

  it("inventory slot 上限と装備所有を root で検証する", () => {
    const valid = createValidSnapshotData()
    const result = zWorldSnapshotData.safeParse({
      ...valid,
      inventory: {
        capacity: 0,
        entries: [
          {
            entryId: "herb-stack",
            contentType: "item",
            contentId: "herb",
            quantity: 1,
          },
        ],
      },
      equipment: {
        mainHand: "unowned-sword-entry",
        body: "unowned-armor-entry",
      },
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["inventory", "entries"],
          message: expect.stringContaining("inventory.capacity"),
        }),
        expect.objectContaining({
          path: ["equipment", "mainHand"],
          message: expect.stringContaining("unowned inventory entry"),
        }),
        expect.objectContaining({
          path: ["equipment", "body"],
          message: expect.stringContaining("unowned inventory entry"),
        }),
      ]),
    )
  })

  it("所有中の装備と正常な相関は immutable snapshot にできる", () => {
    const valid = createValidSnapshotData()
    const snapshot = WorldSnapshot.create({
      ...valid,
      inventory: {
        capacity: 2,
        entries: [
          {
            entryId: "owned-sword-entry",
            contentType: "weapon",
            contentId: "owned_sword",
            quantity: 1,
          },
          {
            entryId: "owned-armor-entry",
            contentType: "armor",
            contentId: "owned_armor",
            quantity: 1,
          },
        ],
      },
      equipment: {
        mainHand: "owned-sword-entry",
        body: "owned-armor-entry",
      },
    })

    expect(snapshot.equipment.mainHand).toBe("owned-sword-entry")
    expect(Object.isFrozen(snapshot.toPlain())).toBe(true)
  })

  it("canonical DTO型はliteral値だけを保持し、入力classのprototype methodを公開しない", () => {
    const valid = createValidSnapshotData()
    const playerPrototype = {} as { describe: () => string }
    Object.defineProperty(playerPrototype, "describe", {
      value: () => "prototype method",
    })
    const player = Object.assign(
      Object.create(playerPrototype) as typeof valid.player & typeof playerPrototype,
      valid.player,
    )
    const snapshot = WorldSnapshot.create({
      ...valid,
      player,
      areas: [{ ...valid.areas[0], id: "literal-area" as const }],
      inventory: {
        ...valid.inventory,
        entries: [
          {
            entryId: "literal-entry" as const,
            contentType: "item",
            contentId: "literal-item" as const,
            quantity: 1,
          },
        ],
      },
    })
    const areaId: "literal-area" = snapshot.areas[0].id
    const itemId: "literal-item" = snapshot.inventory.entries[0].contentId
    const verifyCanonicalPlayer = () => {
      // @ts-expect-error strict schema後のplayerはprototype methodを保持しない。
      snapshot.player.describe()
    }
    void areaId
    void itemId
    void verifyCanonicalPlayer

    expect(Object.getPrototypeOf(snapshot.player)).toBe(Object.prototype)
    expect("describe" in snapshot.player).toBe(false)
  })

  it("party member の duplicate actor ID と予約済み player ID を path 付きで集約する", () => {
    const valid = createValidSnapshotData()
    const first = valid.partyMembers[0]
    const second = valid.partyMembers[1]
    const result = zWorldSnapshotData.safeParse({
      ...valid,
      partyMembers: [
        { ...first, id: "player" },
        { ...second, id: "duplicate" },
        { ...first, id: "duplicate" },
      ],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["partyMembers", 0, "id"],
          message: expect.stringContaining("reserved for the canonical player actor"),
        }),
        expect.objectContaining({
          path: ["partyMembers", 2, "id"],
          message: expect.stringContaining("partyMembers[1].id"),
        }),
      ]),
    )
  })

  it("player mp/maxMp の片側だけがある snapshot と不正なvaultを拒否する", () => {
    const valid = createValidSnapshotData()
    const { maxMp: _maxMp, ...playerWithoutMaxMp } = valid.player

    expect(() =>
      WorldSnapshot.create({
        ...valid,
        player: playerWithoutMaxMp,
      }),
    ).toThrow()
    expect(() =>
      WorldSnapshot.fromVault({
        ...MOCK_VAULT.toPlain(),
        equipment: {
          mainHand: "unowned-sword-entry",
        },
      }),
    ).toThrow()
  })

  it("定義外のlog keyを拒否する", () => {
    const snapshot = WorldSnapshot.fromVault(MOCK_VAULT)

    expect(() =>
      WorldSnapshot.fromUnknown({
        ...snapshot.toPlain(),
        log: [{ key: "RENDERED_TEXT", text: "rendered text" }],
      }),
    ).toThrow()
  })
})
