import {
  freezeWorldContentDiagnostic,
  WORLD_CONTENT_KINDS,
  type WorldContentDiagnostic,
  type WorldContentIdKind,
  type WorldContentKind,
  type WorldContentLocalIdKind,
} from "@/lib/wiz/core/content/diagnostic"
import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"

type IdentifiedEntry = {
  readonly id: string
  readonly path: string
}

type WorldContentReference = {
  readonly kind: WorldContentKind
  readonly id: string
  readonly path: string
  readonly referenceId: string
  readonly expectedKind: WorldContentKind
}

type LocalIdGroup = {
  readonly kind: "npc" | "shop_dialogue"
  readonly idKind: WorldContentLocalIdKind
  readonly entries: readonly IdentifiedEntry[]
}

type CycleReference = {
  readonly id: string
  readonly path: string
  readonly referenceId: string
}

type WorldNpcDialogue = WorldContentArrays["npcs"][number]["dialogues"][number]
type FullWorldNpcDialogue = Extract<
  WorldNpcDialogue,
  {
    readonly lines: readonly {
      readonly speaker: string
      readonly text: string
    }[]
  }
>

const isFullDialogue = (dialogue: WorldNpcDialogue): dialogue is FullWorldNpcDialogue =>
  dialogue.lines.some((line) => typeof line !== "string") ||
  "options" in dialogue ||
  "triggers" in dialogue ||
  "requirements" in dialogue

const contentIdIssueReason = (
  id: string,
): "empty_or_whitespace" | "surrounding_whitespace" | undefined => {
  if (id.trim().length === 0) return "empty_or_whitespace"
  if (id !== id.trim()) return "surrounding_whitespace"
  return undefined
}

const isValidContentId = (id: string): boolean => contentIdIssueReason(id) === undefined

const isDefined = <TValue>(value: TValue | undefined): value is TValue => value !== undefined

const entriesForKind = (
  content: WorldContentArrays,
  kind: WorldContentKind,
): readonly IdentifiedEntry[] => {
  switch (kind) {
    case "item":
      return content.items.map((entry, index) => ({
        id: entry.id,
        path: `items[${index}].id`,
      }))
    case "weapon":
      return content.weapons.map((entry, index) => ({
        id: entry.id,
        path: `weapons[${index}].id`,
      }))
    case "armor":
      return content.armors.map((entry, index) => ({
        id: entry.id,
        path: `armors[${index}].id`,
      }))
    case "recipe":
      return content.recipes.map((entry, index) => ({
        id: entry.id,
        path: `recipes[${index}].id`,
      }))
    case "monster":
      return content.monsters.map((entry, index) => ({
        id: entry.id,
        path: `monsters[${index}].id`,
      }))
    case "event":
      return content.events.map((entry, index) => ({
        id: entry.id,
        path: `events[${index}].id`,
      }))
    case "area":
      return content.areas.map((entry, index) => ({
        id: entry.id,
        path: `areas[${index}].id`,
      }))
    case "npc":
      return content.npcs.map((entry, index) => ({
        id: entry.id,
        path: `npcs[${index}].id`,
      }))
    case "quest":
      return content.quests.map((entry, index) => ({
        id: entry.id,
        path: `quests[${index}].id`,
      }))
    case "facility":
      return content.facilities.map((entry, index) => ({
        id: entry.facilityId,
        path: `facilities[${index}].facilityId`,
      }))
    case "ability":
      return content.abilities.map((entry, index) => ({
        id: entry.id,
        path: `abilities[${index}].id`,
      }))
    case "shop_dialogue":
      return content.shopDialogues.map((entry, index) => ({
        id: entry.shopId,
        path: `shopDialogues[${index}].shopId`,
      }))
    case "ability_entry":
      return content.abilityTable.map((entry, index) => ({
        id: entry.abilityId,
        path: `abilityTable[${index}].abilityId`,
      }))
    case "inn_plan":
      return content.innPlans.map((entry, index) => ({
        id: entry.id,
        path: `innPlans[${index}].id`,
      }))
  }
}

const duplicateDiagnostics = (
  entries: readonly IdentifiedEntry[],
  kind: WorldContentKind,
  idKind?: WorldContentLocalIdKind,
): readonly WorldContentDiagnostic[] => {
  const firstPaths = new Map<string, string>()
  return entries.flatMap((entry) => {
    const firstPath = firstPaths.get(entry.id)
    if (firstPath === undefined) {
      firstPaths.set(entry.id, entry.path)
      return []
    }

    const displayKind = idKind ?? kind
    return [
      {
        code: "duplicate_id" as const,
        kind,
        ...(idKind ? { idKind } : {}),
        id: entry.id,
        path: entry.path,
        firstPath,
        message: `Duplicate ${displayKind} id "${entry.id}" at ${entry.path}; first declared at ${firstPath}`,
      },
    ]
  })
}

const duplicateDiagnosticsForKind = (
  content: WorldContentArrays,
  kind: WorldContentKind,
): readonly WorldContentDiagnostic[] => duplicateDiagnostics(entriesForKind(content, kind), kind)

const localIdGroups = (content: WorldContentArrays): readonly LocalIdGroup[] => [
  ...content.npcs.flatMap((npc, npcIndex) => [
    {
      kind: "npc" as const,
      idKind: "npc_dialogue" as const,
      entries: npc.dialogues.map((dialogue, dialogueIndex) => ({
        id: dialogue.id,
        path: `npcs[${npcIndex}].dialogues[${dialogueIndex}].id`,
      })),
    },
    ...npc.dialogues.flatMap((dialogue, dialogueIndex) =>
      isFullDialogue(dialogue)
        ? [
            {
              kind: "npc" as const,
              idKind: "npc_dialogue_option" as const,
              entries: (dialogue.options ?? []).map((option, optionIndex) => ({
                id: option.id,
                path: `npcs[${npcIndex}].dialogues[${dialogueIndex}].options[${optionIndex}].id`,
              })),
            },
          ]
        : [],
    ),
  ]),
  ...content.shopDialogues.map((dialogue, dialogueIndex) => ({
    kind: "shop_dialogue" as const,
    idKind: "shop_topic" as const,
    entries: dialogue.topics.map((topic, topicIndex) => ({
      id: topic.id,
      path: `shopDialogues[${dialogueIndex}].topics[${topicIndex}].id`,
    })),
  })),
]

const shopProductGroups = (content: WorldContentArrays): readonly LocalIdGroup[] =>
  content.shopDialogues.flatMap((dialogue, dialogueIndex) => [
    {
      kind: "shop_dialogue" as const,
      idKind: "shop_product" as const,
      entries: dialogue.products.itemIds.map((itemId, itemIndex) => ({
        id: itemId,
        path: `shopDialogues[${dialogueIndex}].products.itemIds[${itemIndex}]`,
      })),
    },
    {
      kind: "shop_dialogue" as const,
      idKind: "shop_product" as const,
      entries: dialogue.products.weaponIds.map((weaponId, weaponIndex) => ({
        id: weaponId,
        path: `shopDialogues[${dialogueIndex}].products.weaponIds[${weaponIndex}]`,
      })),
    },
    {
      kind: "shop_dialogue" as const,
      idKind: "shop_product" as const,
      entries: dialogue.products.armorIds.map((armorId, armorIndex) => ({
        id: armorId,
        path: `shopDialogues[${dialogueIndex}].products.armorIds[${armorIndex}]`,
      })),
    },
  ])

const invalidIdDiagnostics = (
  entries: readonly IdentifiedEntry[],
  kind: WorldContentKind,
  idKind: WorldContentIdKind,
): readonly WorldContentDiagnostic[] =>
  entries.flatMap((entry) => {
    const reason = contentIdIssueReason(entry.id)
    if (reason === undefined) return []
    return [
      {
        code: "invalid_id" as const,
        kind,
        idKind,
        id: entry.id,
        path: entry.path,
        reason,
        message:
          reason === "empty_or_whitespace"
            ? `Invalid ${idKind} id at ${entry.path}: IDs must contain a non-whitespace character`
            : `Invalid ${idKind} id at ${entry.path}: IDs must not contain surrounding whitespace`,
      },
    ]
  })

const itemReferences = (content: WorldContentArrays): readonly WorldContentReference[] => [
  ...content.monsters.flatMap((monster, monsterIndex) =>
    monster.drops.map((drop, dropIndex) => ({
      kind: "monster" as const,
      id: monster.id,
      path: `monsters[${monsterIndex}].drops[${dropIndex}].itemId`,
      referenceId: drop.itemId,
      expectedKind: "item" as const,
    })),
  ),
  ...content.events.flatMap((event, eventIndex) =>
    event.choices.flatMap((choice, choiceIndex) =>
      (choice.successReward?.items ?? []).map((item, itemIndex) => ({
        kind: "event" as const,
        id: event.id,
        path: `events[${eventIndex}].choices[${choiceIndex}].successReward.items[${itemIndex}].itemId`,
        referenceId: item.itemId,
        expectedKind: "item" as const,
      })),
    ),
  ),
  ...content.areas.flatMap((area, areaIndex) =>
    area.availableGathering.map((itemId, itemIndex) => ({
      kind: "area" as const,
      id: area.id,
      path: `areas[${areaIndex}].availableGathering[${itemIndex}]`,
      referenceId: itemId,
      expectedKind: "item" as const,
    })),
  ),
  ...content.npcs.flatMap((npc, npcIndex) => [
    ...npc.likes.map((itemId, itemIndex) => ({
      kind: "npc" as const,
      id: npc.id,
      path: `npcs[${npcIndex}].likes[${itemIndex}]`,
      referenceId: itemId,
      expectedKind: "item" as const,
    })),
    ...npc.dislikes.map((itemId, itemIndex) => ({
      kind: "npc" as const,
      id: npc.id,
      path: `npcs[${npcIndex}].dislikes[${itemIndex}]`,
      referenceId: itemId,
      expectedKind: "item" as const,
    })),
  ]),
  ...content.quests.flatMap((quest, questIndex) =>
    quest.objective.type === "gather" || quest.objective.type === "deliver"
      ? [
          {
            kind: "quest" as const,
            id: quest.id,
            path: `quests[${questIndex}].objective.itemId`,
            referenceId: quest.objective.itemId,
            expectedKind: "item" as const,
          },
        ]
      : [],
  ),
]

const recipeMaterialReferences = (content: WorldContentArrays): readonly WorldContentReference[] =>
  content.recipes.flatMap((recipe, recipeIndex) =>
    recipe.materials.map((material, materialIndex) => {
      if ("weaponId" in material) {
        return {
          kind: "recipe",
          id: recipe.id,
          path: `recipes[${recipeIndex}].materials[${materialIndex}].weaponId`,
          referenceId: material.weaponId,
          expectedKind: "weapon",
        }
      }
      if ("armorId" in material) {
        return {
          kind: "recipe",
          id: recipe.id,
          path: `recipes[${recipeIndex}].materials[${materialIndex}].armorId`,
          referenceId: material.armorId,
          expectedKind: "armor",
        }
      }
      return {
        kind: "recipe",
        id: recipe.id,
        path: `recipes[${recipeIndex}].materials[${materialIndex}].itemId`,
        referenceId: material.itemId,
        expectedKind: "item",
      }
    }),
  )

const questRewardReferences = (content: WorldContentArrays): readonly WorldContentReference[] =>
  content.quests.flatMap((quest, questIndex) =>
    (quest.reward.items ?? []).map((reward, rewardIndex) => {
      if (reward.type === "weapon") {
        return {
          kind: "quest",
          id: quest.id,
          path: `quests[${questIndex}].reward.items[${rewardIndex}].weaponId`,
          referenceId: reward.weaponId,
          expectedKind: "weapon",
        }
      }
      if (reward.type === "armor") {
        return {
          kind: "quest",
          id: quest.id,
          path: `quests[${questIndex}].reward.items[${rewardIndex}].armorId`,
          referenceId: reward.armorId,
          expectedKind: "armor",
        }
      }
      return {
        kind: "quest",
        id: quest.id,
        path: `quests[${questIndex}].reward.items[${rewardIndex}].itemId`,
        referenceId: reward.itemId,
        expectedKind: "item",
      }
    }),
  )

const recipeResultReferences = (content: WorldContentArrays): readonly WorldContentReference[] =>
  content.recipes.map((recipe, recipeIndex) => {
    if (recipe.result.type === "item") {
      return {
        kind: "recipe",
        id: recipe.id,
        path: `recipes[${recipeIndex}].result.itemId`,
        referenceId: recipe.result.itemId,
        expectedKind: "item",
      }
    }
    if (recipe.result.type === "weapon") {
      return {
        kind: "recipe",
        id: recipe.id,
        path: `recipes[${recipeIndex}].result.weaponId`,
        referenceId: recipe.result.weaponId,
        expectedKind: "weapon",
      }
    }
    return {
      kind: "recipe",
      id: recipe.id,
      path: `recipes[${recipeIndex}].result.armorId`,
      referenceId: recipe.result.armorId,
      expectedKind: "armor",
    }
  })

const areaReferences = (content: WorldContentArrays): readonly WorldContentReference[] =>
  content.areas.flatMap((area, areaIndex) => [
    ...area.monsterIds.map((monsterId, monsterIndex) => ({
      kind: "area" as const,
      id: area.id,
      path: `areas[${areaIndex}].monsterIds[${monsterIndex}]`,
      referenceId: monsterId,
      expectedKind: "monster" as const,
    })),
    ...area.eventIds.map((eventId, eventIndex) => ({
      kind: "area" as const,
      id: area.id,
      path: `areas[${areaIndex}].eventIds[${eventIndex}]`,
      referenceId: eventId,
      expectedKind: "event" as const,
    })),
    ...(area.unlockCondition
      ? [
          {
            kind: "area" as const,
            id: area.id,
            path: `areas[${areaIndex}].unlockCondition.areaId`,
            referenceId: area.unlockCondition.areaId,
            expectedKind: "area" as const,
          },
        ]
      : []),
  ])

const npcAndQuestReferences = (content: WorldContentArrays): readonly WorldContentReference[] =>
  content.quests.flatMap((quest, questIndex) => [
    {
      kind: "quest" as const,
      id: quest.id,
      path: `quests[${questIndex}].giverNpcId`,
      referenceId: quest.giverNpcId,
      expectedKind: "npc" as const,
    },
    ...(quest.objective.type === "defeat"
      ? [
          {
            kind: "quest" as const,
            id: quest.id,
            path: `quests[${questIndex}].objective.monsterId`,
            referenceId: quest.objective.monsterId,
            expectedKind: "monster" as const,
          },
        ]
      : []),
    ...(quest.objective.type === "explore"
      ? [
          {
            kind: "quest" as const,
            id: quest.id,
            path: `quests[${questIndex}].objective.areaId`,
            referenceId: quest.objective.areaId,
            expectedKind: "area" as const,
          },
        ]
      : []),
    ...(quest.objective.type === "deliver"
      ? [
          {
            kind: "quest" as const,
            id: quest.id,
            path: `quests[${questIndex}].objective.npcId`,
            referenceId: quest.objective.npcId,
            expectedKind: "npc" as const,
          },
        ]
      : []),
    ...(isDefined(quest.nextQuestId)
      ? [
          {
            kind: "quest" as const,
            id: quest.id,
            path: `quests[${questIndex}].nextQuestId`,
            referenceId: quest.nextQuestId,
            expectedKind: "quest" as const,
          },
        ]
      : []),
  ])

const npcDialogueWorldReferences = (
  content: WorldContentArrays,
): readonly WorldContentReference[] =>
  content.npcs.flatMap((npc, npcIndex) =>
    npc.dialogues.flatMap((dialogue, dialogueIndex) => {
      const dialoguePath = `npcs[${npcIndex}].dialogues[${dialogueIndex}]`
      if (!isFullDialogue(dialogue)) {
        return isDefined(dialogue.afterQuest)
          ? [
              {
                kind: "npc" as const,
                id: npc.id,
                path: `${dialoguePath}.afterQuest`,
                referenceId: dialogue.afterQuest,
                expectedKind: "quest" as const,
              },
            ]
          : []
      }

      const afterQuest = dialogue.triggers?.afterQuest

      return [
        ...(isDefined(afterQuest)
          ? [
              {
                kind: "npc" as const,
                id: npc.id,
                path: `${dialoguePath}.triggers.afterQuest`,
                referenceId: afterQuest,
                expectedKind: "quest" as const,
              },
            ]
          : []),
        ...(dialogue.requirements?.requiredItems ?? []).map((item, itemIndex) => ({
          kind: "npc" as const,
          id: npc.id,
          path: `${dialoguePath}.requirements.requiredItems[${itemIndex}].itemId`,
          referenceId: item.itemId,
          expectedKind: "item" as const,
        })),
        ...(dialogue.options ?? []).flatMap((option, optionIndex) => {
          const optionPath = `${dialoguePath}.options[${optionIndex}]`
          const effects = option.effects
          const startQuest = effects?.startQuest
          const completeQuest = effects?.completeQuest

          return [
            ...(option.requirements?.requiredItems ?? []).map((item, itemIndex) => ({
              kind: "npc" as const,
              id: npc.id,
              path: `${optionPath}.requirements.requiredItems[${itemIndex}].itemId`,
              referenceId: item.itemId,
              expectedKind: "item" as const,
            })),
            ...(effects?.giveItems ?? []).map((item, itemIndex) => ({
              kind: "npc" as const,
              id: npc.id,
              path: `${optionPath}.effects.giveItems[${itemIndex}].itemId`,
              referenceId: item.itemId,
              expectedKind: "item" as const,
            })),
            ...(effects?.takeItems ?? []).map((item, itemIndex) => ({
              kind: "npc" as const,
              id: npc.id,
              path: `${optionPath}.effects.takeItems[${itemIndex}].itemId`,
              referenceId: item.itemId,
              expectedKind: "item" as const,
            })),
            ...(isDefined(startQuest)
              ? [
                  {
                    kind: "npc" as const,
                    id: npc.id,
                    path: `${optionPath}.effects.startQuest`,
                    referenceId: startQuest,
                    expectedKind: "quest" as const,
                  },
                ]
              : []),
            ...(isDefined(completeQuest)
              ? [
                  {
                    kind: "npc" as const,
                    id: npc.id,
                    path: `${optionPath}.effects.completeQuest`,
                    referenceId: completeQuest,
                    expectedKind: "quest" as const,
                  },
                ]
              : []),
          ]
        }),
      ]
    }),
  )

const npcDialogueLocalReferenceDiagnostics = (
  content: WorldContentArrays,
): readonly WorldContentDiagnostic[] =>
  content.npcs.flatMap((npc, npcIndex) => {
    const dialogueIds = new Set(npc.dialogues.map((dialogue) => dialogue.id))
    return npc.dialogues.flatMap((dialogue, dialogueIndex) => {
      if (!isFullDialogue(dialogue)) {
        return []
      }

      return (dialogue.options ?? []).flatMap((option, optionIndex) => {
        const optionPath = `npcs[${npcIndex}].dialogues[${dialogueIndex}].options[${optionIndex}]`
        const unlockDialogue = option.effects?.unlockDialogue
        const references = [
          ...(isDefined(option.responseDialogueId)
            ? [
                {
                  path: `${optionPath}.responseDialogueId`,
                  referenceId: option.responseDialogueId,
                },
              ]
            : []),
          ...(isDefined(unlockDialogue)
            ? [
                {
                  path: `${optionPath}.effects.unlockDialogue`,
                  referenceId: unlockDialogue,
                },
              ]
            : []),
        ]

        return references.flatMap((reference): readonly WorldContentDiagnostic[] => {
          const reason = contentIdIssueReason(reference.referenceId)
          if (reason !== undefined) {
            return [
              {
                code: "invalid_reference_id" as const,
                kind: "npc" as const,
                id: npc.id,
                path: reference.path,
                referenceId: reference.referenceId,
                expectedKind: "npc_dialogue" as const,
                actualKinds: [] as const,
                reason,
                message:
                  reason === "empty_or_whitespace"
                    ? `Invalid npc_dialogue reference at ${reference.path}: IDs must contain a non-whitespace character`
                    : `Invalid npc_dialogue reference at ${reference.path}: IDs must not contain surrounding whitespace`,
              },
            ]
          }

          return dialogueIds.has(reference.referenceId)
            ? []
            : [
                {
                  code: "missing_reference" as const,
                  kind: "npc" as const,
                  id: npc.id,
                  path: reference.path,
                  referenceId: reference.referenceId,
                  expectedKind: "npc_dialogue" as const,
                  actualKinds: [] as const,
                  message: `Missing npc_dialogue "${reference.referenceId}" referenced by ${reference.path}`,
                },
              ]
        })
      })
    })
  })

const facilityReferences = (content: WorldContentArrays): readonly WorldContentReference[] => [
  ...content.recipes.flatMap((recipe, recipeIndex) =>
    isDefined(recipe.requiresFacility)
      ? [
          {
            kind: "recipe" as const,
            id: recipe.id,
            path: `recipes[${recipeIndex}].requiresFacility`,
            referenceId: recipe.requiresFacility,
            expectedKind: "facility" as const,
          },
        ]
      : [],
  ),
  ...content.facilities.map((facility, facilityIndex) =>
    facility.type === "area_progress"
      ? {
          kind: "facility" as const,
          id: facility.facilityId,
          path: `facilities[${facilityIndex}].areaId`,
          referenceId: facility.areaId,
          expectedKind: "area" as const,
        }
      : {
          kind: "facility" as const,
          id: facility.facilityId,
          path: `facilities[${facilityIndex}].questId`,
          referenceId: facility.questId,
          expectedKind: "quest" as const,
        },
  ),
]

const shopProductReferences = (content: WorldContentArrays): readonly WorldContentReference[] =>
  content.shopDialogues.flatMap((dialogue, dialogueIndex) => [
    ...dialogue.products.itemIds.map((itemId, itemIndex) => ({
      kind: "shop_dialogue" as const,
      id: dialogue.shopId,
      path: `shopDialogues[${dialogueIndex}].products.itemIds[${itemIndex}]`,
      referenceId: itemId,
      expectedKind: "item" as const,
    })),
    ...dialogue.products.weaponIds.map((weaponId, weaponIndex) => ({
      kind: "shop_dialogue" as const,
      id: dialogue.shopId,
      path: `shopDialogues[${dialogueIndex}].products.weaponIds[${weaponIndex}]`,
      referenceId: weaponId,
      expectedKind: "weapon" as const,
    })),
    ...dialogue.products.armorIds.map((armorId, armorIndex) => ({
      kind: "shop_dialogue" as const,
      id: dialogue.shopId,
      path: `shopDialogues[${dialogueIndex}].products.armorIds[${armorIndex}]`,
      referenceId: armorId,
      expectedKind: "armor" as const,
    })),
  ])

const auxiliaryReferences = (content: WorldContentArrays): readonly WorldContentReference[] => [
  ...content.shopDialogues.flatMap((dialogue, dialogueIndex) =>
    dialogue.topics.flatMap((topic, topicIndex) => {
      const hasItem = topic.condition?.hasItem
      return isDefined(hasItem)
        ? [
            {
              kind: "shop_dialogue" as const,
              id: dialogue.shopId,
              path: `shopDialogues[${dialogueIndex}].topics[${topicIndex}].condition.hasItem`,
              referenceId: hasItem,
              expectedKind: "item" as const,
            },
          ]
        : []
    }),
  ),
  ...content.abilityTable.map((entry, entryIndex) => ({
    kind: "ability_entry" as const,
    id: entry.abilityId,
    path: `abilityTable[${entryIndex}].abilityId`,
    referenceId: entry.abilityId,
    expectedKind: "ability" as const,
  })),
]

const cycleReferences = (
  content: WorldContentArrays,
  kind: "area" | "quest",
): readonly CycleReference[] => {
  if (kind === "area") {
    return content.areas.flatMap((area, areaIndex) =>
      area.unlockCondition
        ? [
            {
              id: area.id,
              path: `areas[${areaIndex}].unlockCondition.areaId`,
              referenceId: area.unlockCondition.areaId,
            },
          ]
        : [],
    )
  }

  return content.quests.flatMap((quest, questIndex) =>
    isDefined(quest.nextQuestId)
      ? [
          {
            id: quest.id,
            path: `quests[${questIndex}].nextQuestId`,
            referenceId: quest.nextQuestId,
          },
        ]
      : [],
  )
}

/**
 * 現在の area / quest graph は各 node の outgoing edge が最大1本なので、
 * 各 walk 内の訪問位置から strongly connected component を特定できる。
 * 再帰を使わず、大量の content でも call stack に依存しない。
 */
const cyclicReferenceDiagnostics = (
  content: WorldContentArrays,
  kind: "area" | "quest",
): readonly WorldContentDiagnostic[] => {
  const declarationCounts = entriesForKind(content, kind).reduce(
    (counts, entry) => counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1),
    new Map<string, number>(),
  )
  const isUniqueDeclaration = (id: string): boolean =>
    isValidContentId(id) && declarationCounts.get(id) === 1
  const referencesBySource = new Map(
    cycleReferences(content, kind)
      .filter(
        (reference) =>
          isUniqueDeclaration(reference.id) && isUniqueDeclaration(reference.referenceId),
      )
      .map((reference) => [reference.id, reference] as const),
  )

  const visited = new Set<string>()
  const diagnosedPaths = new Set<string>()
  const diagnostics: WorldContentDiagnostic[] = []

  const reportCycle = (cycleIds: readonly string[]) => {
    cycleIds.forEach((sourceId, sourceIndex) => {
      const reference = referencesBySource.get(sourceId)
      if (!reference || diagnosedPaths.has(reference.path)) return

      const rotatedCycle = [
        ...cycleIds.slice(sourceIndex),
        ...cycleIds.slice(0, sourceIndex),
        sourceId,
      ]
      diagnosedPaths.add(reference.path)
      diagnostics.push({
        code: "cyclic_reference",
        kind,
        id: sourceId,
        path: reference.path,
        referenceId: reference.referenceId,
        expectedKind: kind,
        cycle: rotatedCycle,
        message: `Cyclic ${kind} reference ${rotatedCycle.join(" -> ")} at ${reference.path}`,
      })
    })
  }

  for (const startId of referencesBySource.keys()) {
    if (visited.has(startId)) continue

    const walk: string[] = []
    const positions = new Map<string, number>()
    let currentId: string | undefined = startId
    while (currentId !== undefined && !visited.has(currentId)) {
      const cycleStart = positions.get(currentId)
      if (cycleStart !== undefined) {
        reportCycle(walk.slice(cycleStart))
        break
      }

      positions.set(currentId, walk.length)
      walk.push(currentId)
      currentId = referencesBySource.get(currentId)?.referenceId
    }
    walk.forEach((id) => visited.add(id))
  }

  return diagnostics
}

const allReferences = (content: WorldContentArrays): readonly WorldContentReference[] => [
  ...itemReferences(content),
  ...recipeMaterialReferences(content),
  ...questRewardReferences(content),
  ...recipeResultReferences(content),
  ...areaReferences(content),
  ...npcAndQuestReferences(content),
  ...npcDialogueWorldReferences(content),
  ...facilityReferences(content),
  ...shopProductReferences(content),
  ...auxiliaryReferences(content),
]

const diagnoseReference = (
  content: WorldContentArrays,
  reference: WorldContentReference,
): readonly WorldContentDiagnostic[] => {
  const reason = contentIdIssueReason(reference.referenceId)
  if (reason !== undefined) {
    return [
      {
        code: "invalid_reference_id",
        kind: reference.kind,
        id: reference.id,
        path: reference.path,
        referenceId: reference.referenceId,
        expectedKind: reference.expectedKind,
        actualKinds: [],
        reason,
        message:
          reason === "empty_or_whitespace"
            ? `Invalid ${reference.expectedKind} reference at ${reference.path}: IDs must contain a non-whitespace character`
            : `Invalid ${reference.expectedKind} reference at ${reference.path}: IDs must not contain surrounding whitespace`,
      },
    ]
  }

  const expectedEntries = entriesForKind(content, reference.expectedKind)
  if (expectedEntries.some((entry) => entry.id === reference.referenceId)) {
    return []
  }

  const actualKinds = WORLD_CONTENT_KINDS.filter(
    (kind) =>
      kind !== "ability_entry" &&
      entriesForKind(content, kind).some((entry) => entry.id === reference.referenceId),
  )

  if (actualKinds.length === 0) {
    return [
      {
        code: "missing_reference",
        kind: reference.kind,
        id: reference.id,
        path: reference.path,
        referenceId: reference.referenceId,
        expectedKind: reference.expectedKind,
        actualKinds: [],
        message: `Missing ${reference.expectedKind} "${reference.referenceId}" referenced by ${reference.path}`,
      },
    ]
  }

  return [
    {
      code: "wrong_reference_kind",
      kind: reference.kind,
      id: reference.id,
      path: reference.path,
      referenceId: reference.referenceId,
      expectedKind: reference.expectedKind,
      actualKinds,
      message: `Expected ${reference.expectedKind} "${reference.referenceId}" at ${
        reference.path
      }, but found ${actualKinds.join(", ")}`,
    },
  ]
}

/**
 * 入力を変更せず、全 rule を最後まで評価して診断を集約する。
 */
export const diagnoseWorldContent = (
  content: WorldContentArrays,
): readonly WorldContentDiagnostic[] => {
  const groups = localIdGroups(content)
  const productGroups = shopProductGroups(content)
  return Object.freeze(
    [
      ...WORLD_CONTENT_KINDS.flatMap((kind) =>
        invalidIdDiagnostics(entriesForKind(content, kind), kind, kind),
      ),
      ...groups.flatMap((group) => invalidIdDiagnostics(group.entries, group.kind, group.idKind)),
      ...WORLD_CONTENT_KINDS.flatMap((kind) => duplicateDiagnosticsForKind(content, kind)),
      ...groups.flatMap((group) => duplicateDiagnostics(group.entries, group.kind, group.idKind)),
      ...productGroups.flatMap((group) =>
        duplicateDiagnostics(group.entries, group.kind, group.idKind),
      ),
      ...allReferences(content).flatMap((reference) => diagnoseReference(content, reference)),
      ...npcDialogueLocalReferenceDiagnostics(content),
      ...cyclicReferenceDiagnostics(content, "area"),
      ...cyclicReferenceDiagnostics(content, "quest"),
    ].map(freezeWorldContentDiagnostic),
  )
}
