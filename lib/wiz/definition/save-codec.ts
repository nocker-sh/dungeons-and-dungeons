import { resumeMigratedBattle } from "@/lib/wiz/definition/resume-migrated-battle"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { WizStandardSchemaDefinition } from "@/lib/wiz/core/standard-schema"
import { WizWorldSaveCodec } from "@/lib/wiz/core/save/world-save-codec"
import { stateSchema } from "@/lib/wiz/state/state-schema"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { stateProblems } from "@/lib/wiz/integrity/state-problems"
import { StateIntegrityError } from "@/lib/wiz/integrity/state-integrity-error"
import { giveSignatureWeapons } from "@/lib/wiz/definition/signature-weapon-migration"
import { releasePactGear } from "@/lib/wiz/definition/pact-gear-migration"
import { fitPartySize } from "@/lib/wiz/definition/party-size-migration"
import { retireHeroFromParty } from "@/lib/wiz/definition/hero-retirement-migration"
import { z } from "zod"
import { validateState } from "@/lib/wiz/definition/validate-state"
type SaveCodec = Pick<WizWorldSaveCodec<GameState>, "encode" | "decodeSnapshot">

type Props = Readonly<{
  identity: string
  legacyIdentity: string
  previousIdentity: string
  dependencies: GameDependencies
  environment: WizWorldEnvironment
}>

/** 保存の入出力。構成 identity が違う保存は読み込まない。 */
export function createSaveCodec(props: Props): SaveCodec {
  const catalog = props.dependencies.catalog
  const party = props.dependencies.party
  const weapons = props.dependencies.weapons
  // 同じ検証器を、読み取り専用のゲーム状態の入出力として型付けする。
  const currentSchema: WizStandardSchemaDefinition<GameState> = stateSchema
  const codec = WizWorldSaveCodec.define({
    contentVersion: props.identity,
    schema: currentSchema,
  })
  // 直前の保存には登録待ちの項目がない。名前・装備を保ち、登録済みとして読む。
  const previous = WizWorldSaveCodec.define({
    contentVersion: props.previousIdentity,
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
    contentVersion: props.legacyIdentity,
    schema: compatibleSchema,
  })
  const compatible = (decoded: GameState): GameState => {
    // 移行で外す・消すデータも先に検証する。旧仕様として認める差だけを許す。
    const problems = stateProblems(decoded, catalog, {
      allowLegacyHeroArmor: true,
      allowLegacyPartySize: true,
      allowLegacyPactGear: true,
      allowLegacyHeroMember: true,
    })
    if (problems.length) throw new StateIntegrityError(problems)
    // 専用の武器を持つことになった R の仲間へ、専用の武器を着ける（今の武器は袋へ）
    // 悪魔と契約して戦う仲間（R）は装備を持たないので、着けていた装備を外す
    // プレイヤーが戦っていた保存は、プレイヤーを隊列から外して初期の仲間を迎える
    // 4人で出撃していた保存は3人へ移す
    const state = fitPartySize(
      retireHeroFromParty({
        state: releasePactGear(
          giveSignatureWeapons(decoded, catalog, weapons),
          catalog,
          party
        ),
        catalog,
        weapons,
        nextId: props.environment.nextId,
        random: props.environment.random,
      })
    )
    // プレイヤーが持っていた装備は、外すときに持ち主のない品へ戻している
    return state
  }
  // 保存が名乗る版の読み方を先に試し、読めなければその版の誤りを伝える。
  // 旧版の保存が壊れているのに「以前の版の保存です」と誤って案内しない。
  const decode = (input: unknown) => {
    const version =
      typeof input === "object" && input !== null && "contentVersion" in input
        ? input.contentVersion
        : undefined
    const order =
      version === props.previousIdentity
        ? [previous, codec, legacy]
        : version === props.legacyIdentity
          ? [legacy, codec, previous]
          : [codec, previous, legacy]
    let first: unknown
    for (const decoder of order) {
      try {
        return decoder.decodeSnapshot(input)
      } catch (error) {
        if (first === undefined) first = error
      }
    }
    throw first
  }
  return {
    encode: <const Snapshot extends GameState>(state: Snapshot) =>
      codec.encode(state),
    // 読み込んだ保存は、今のコンテンツと食い違いがないかを確かめてから渡す（操作ごとには検証しない）
    decodeSnapshot: (input: unknown) => {
      const previous = decode(input)
      const state = compatible(previous)
      return validateState(
        resumeMigratedBattle({
          previous,
          state,
          dependencies: props.dependencies,
          environment: props.environment,
        }),
        catalog
      )
    },
  }
}
