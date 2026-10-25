import type { WizStandardSchemaDefinition } from "@/lib/wiz/core/standard-schema"
import { WizWorldSaveCodec } from "@/lib/wiz/core/save/world-save-codec"
import { stateSchema, type GameState } from "@/lib/wiz/state"
import { stateProblems, StateIntegrityError } from "@/lib/wiz/integrity"
import type { PartyRules, WeaponRules } from "@/lib/wiz/rules"
import { giveSignatureWeapons } from "@/lib/wiz/definition/signature-weapon-migration"
import { releasePactGear } from "@/lib/wiz/definition/pact-gear-migration"
import { fitPartySize } from "@/lib/wiz/definition/party-size-migration"
import { z } from "zod"
import type { GameCatalog } from "@/lib/wiz/content"
import { validateState } from "@/lib/wiz/definition/state-ownership"
type SaveCodec = Pick<WizWorldSaveCodec<GameState>, "encode" | "decodeSnapshot">

/** 保存の入出力。構成 identity が違う保存は読み込まない。 */
export function createSaveCodec(
  identity: string,
  catalog: GameCatalog,
  legacyIdentity: string,
  previousIdentity: string,
  party: PartyRules,
  weapons: WeaponRules
): SaveCodec {
  // 同じ検証器を、読み取り専用のゲーム状態の入出力として型付けする。
  const currentSchema: WizStandardSchemaDefinition<GameState> = stateSchema
  const codec = WizWorldSaveCodec.define({
    contentVersion: identity,
    schema: currentSchema,
  })
  // 直前の保存には登録待ちの項目がない。名前・装備を保ち、登録済みとして読む。
  const previous = WizWorldSaveCodec.define({
    contentVersion: previousIdentity,
    schema: currentSchema,
  })
  const gear = stateSchema.shape.gear.element
  const legacyWeapon = gear.shape.weapon.unwrap().extend({
    skills: z
      .array(z.string().min(1))
      .length(4)
      .refine(
        (skills) =>
          new Set(skills).size === 4 &&
          skills.every((skill) => !!catalog.skill(skill))
      ),
  })
  const legacySchema = stateSchema
    .extend({ gear: z.array(gear.extend({ weapon: legacyWeapon.nullable() })) })
    .transform((state) => ({
      ...state,
      gear: state.gear.map((entry) =>
        entry.weapon
          ? {
              ...entry,
              weapon: {
                ...entry.weapon,
                skills: [
                  catalog.good(entry.good)?.skills?.[0] ??
                    entry.weapon.skills[0],
                  ...entry.weapon.skills.slice(2),
                ],
              },
            }
          : entry
      ),
    }))
  const compatibleSchema: WizStandardSchemaDefinition<GameState> = legacySchema
  const legacy = WizWorldSaveCodec.define({
    contentVersion: legacyIdentity,
    schema: compatibleSchema,
  })
  const compatible = (decoded: GameState): GameState => {
    // 専用の武器を持つことになった R の仲間へ、専用の武器を着ける（今の武器は袋へ）
    // 悪魔と契約して戦う仲間（R）は装備を持たないので、着けていた装備を外す
    // 4人で出撃していた保存は3人へ移す
    const state = fitPartySize(
      releasePactGear(giveSignatureWeapons(decoded, catalog, weapons), catalog),
      catalog
    )
    const oldOutfit = state.gear.find(
      (entry) =>
        entry.owner &&
        catalog.member(entry.owner)?.hero &&
        catalog.good(entry.good)?.kind === "armor"
    )?.good
    const needsClamp = state.members.some(
      (member) =>
        catalog.member(member.id)?.hero &&
        member.hp > party.stats(member, state).maxHp
    )
    if (!oldOutfit && !needsClamp) return state
    // 装備制限の変更前に保存した主人公の防具だけを移行する。壊れた保存は先に拒否する。
    const problems = stateProblems(state, catalog, {
      allowLegacyHeroArmor: true,
    })
    if (problems.length) throw new StateIntegrityError(problems)
    return {
      ...state,
      hero:
        state.hero.outfit === undefined &&
        oldOutfit &&
        catalog.data.hero.outfits?.includes(oldOutfit)
          ? { ...state.hero, outfit: oldOutfit }
          : state.hero,
      members: state.members.map((member) =>
        catalog.member(member.id)?.hero
          ? {
              ...member,
              hp: Math.min(member.hp, party.stats(member, state).maxHp),
            }
          : member
      ),
      gear: state.gear.map((entry) =>
        entry.owner &&
        catalog.member(entry.owner)?.hero &&
        catalog.good(entry.good)?.kind === "armor"
          ? { ...entry, owner: null }
          : entry
      ),
    }
  }
  const decode = (input: unknown) => {
    try {
      return compatible(codec.decodeSnapshot(input))
    } catch (error) {
      try {
        return compatible(previous.decodeSnapshot(input))
      } catch {
        try {
          return compatible(legacy.decodeSnapshot(input))
        } catch {
          throw error
        }
      }
    }
  }
  return {
    encode: <const Snapshot extends GameState>(state: Snapshot) =>
      codec.encode(state),
    // 読み込んだ保存は、今のコンテンツと食い違いがないかを確かめてから渡す（操作ごとには検証しない）
    decodeSnapshot: (input: unknown) => validateState(decode(input), catalog),
  }
}
