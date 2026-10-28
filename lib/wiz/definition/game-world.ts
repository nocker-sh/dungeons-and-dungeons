import { ContractDemon } from "@/lib/wiz/application/town/contract-demon"
import { InvokeDemon } from "@/lib/wiz/application/town/invoke-demon"
import { MoveWorld } from "@/lib/wiz/application/town/move-world"
import { TravelWorld } from "@/lib/wiz/application/town/travel-world"
import { VisitWorld } from "@/lib/wiz/application/town/visit-world"
import { Discover } from "@/lib/wiz/application/expedition/discover"
import { Survey } from "@/lib/wiz/application/expedition/survey"
import { Inscribe } from "@/lib/wiz/application/town/inscribe"
import { Pack } from "@/lib/wiz/application/town/pack"
import { StartConversation } from "@/lib/wiz/application/conversation/start-conversation"
import { FinishConversation } from "@/lib/wiz/application/conversation/finish-conversation"
import {
  WizWorld,
  type WizWorldEnvironment,
  type WizWorldStateOwnership,
} from "@/lib/wiz/core/world/world"
import { commands } from "@/lib/wiz/commands"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { Acknowledge } from "@/lib/wiz/application/expedition/acknowledge"
import { Advance } from "@/lib/wiz/application/expedition/advance"
import { Depart } from "@/lib/wiz/application/expedition/depart"
import { Retreat } from "@/lib/wiz/application/expedition/retreat"
import { Act } from "@/lib/wiz/application/battle/act"
import { CreateHero } from "@/lib/wiz/application/hero/create-hero"
import { RenameHero } from "@/lib/wiz/application/hero/rename-hero"
import { ChooseHeroLook } from "@/lib/wiz/application/hero/choose-hero-look"
import { RegisterHero } from "@/lib/wiz/application/hero/register-hero"
import { LeaveCamp } from "@/lib/wiz/application/hero/leave-camp"
import { FoeTurn } from "@/lib/wiz/application/battle/foe-turn"
import { Equip } from "@/lib/wiz/application/party/equip"
import { Swap } from "@/lib/wiz/application/party/swap"
import { SwapRows } from "@/lib/wiz/application/party/swap-rows"
import { Unequip } from "@/lib/wiz/application/party/unequip"
import { Use } from "@/lib/wiz/application/field/use"
import { FightQuest } from "@/lib/wiz/application/town/fight-quest"
import { AcceptQuest } from "@/lib/wiz/application/town/accept-quest"
import { Appraise } from "@/lib/wiz/application/town/appraise"
import { Buy } from "@/lib/wiz/application/town/buy"
import { Chat } from "@/lib/wiz/application/town/chat"
import { ChooseDemon } from "@/lib/wiz/application/town/choose-demon"
import { ClaimQuest } from "@/lib/wiz/application/town/claim-quest"
import { Craft } from "@/lib/wiz/application/town/craft"
import { DismissWipe } from "@/lib/wiz/application/town/dismiss-wipe"
import { Recruit } from "@/lib/wiz/application/town/recruit"
import { Reforge } from "@/lib/wiz/application/town/reforge"
import { Repair } from "@/lib/wiz/application/town/repair"
import { Reroll } from "@/lib/wiz/application/town/reroll"
import { Rest } from "@/lib/wiz/application/town/rest"
import { SeeEnding } from "@/lib/wiz/application/town/see-ending"
import { Sell } from "@/lib/wiz/application/town/sell"
import { Summon } from "@/lib/wiz/application/town/summon"
import { Upgrade } from "@/lib/wiz/application/town/upgrade"
import { moduleFor } from "@/lib/wiz/definition/world-module"
import type { GameState } from "@/lib/wiz/state/state-schema"

/**
 * 画面から送れる操作と、それを行うユースケースの対応。
 * 一つの操作に一つのクラス。ここだけを見れば操作の一覧が分かる。
 */
export function createGameWorld(
  deps: GameDependencies,
  initialState: GameState,
  environment: WizWorldEnvironment,
  ownership: WizWorldStateOwnership<GameState>
) {
  return WizWorld.create<GameState>(initialState, environment, ownership)
    .with(
      moduleFor(
        "start-conversation",
        commands.startConversation,
        new StartConversation(deps)
      )
    )
    .with(
      moduleFor(
        "finish-conversation",
        commands.finishConversation,
        new FinishConversation(deps)
      )
    )
    .with(moduleFor("create-hero", commands.createHero, new CreateHero(deps)))
    .with(moduleFor("rename-hero", commands.renameHero, new RenameHero()))
    .with(
      moduleFor(
        "choose-hero-look",
        commands.chooseHeroLook,
        new ChooseHeroLook(deps)
      )
    )
    .with(
      moduleFor("register-hero", commands.registerHero, new RegisterHero(deps))
    )
    .with(moduleFor("leave-camp", commands.leaveCamp, new LeaveCamp()))
    .with(moduleFor("pack", commands.pack, new Pack(deps)))
    .with(moduleFor("depart", commands.depart, new Depart(deps)))
    .with(moduleFor("advance", commands.advance, new Advance(deps)))
    .with(moduleFor("survey", commands.survey, new Survey(deps)))
    .with(moduleFor("discover", commands.discover, new Discover(deps)))
    .with(moduleFor("acknowledge", commands.acknowledge, new Acknowledge()))
    .with(moduleFor("retreat", commands.retreat, new Retreat(deps)))
    .with(moduleFor("act", commands.act, new Act(deps)))
    .with(moduleFor("foe-turn", commands.foeTurn, new FoeTurn(deps)))
    .with(moduleFor("rest", commands.rest, new Rest(deps)))
    .with(moduleFor("buy", commands.buy, new Buy(deps)))
    .with(moduleFor("sell", commands.sell, new Sell(deps)))
    .with(moduleFor("appraise", commands.appraise, new Appraise(deps)))
    .with(moduleFor("equip", commands.equip, new Equip(deps)))
    .with(moduleFor("unequip", commands.unequip, new Unequip(deps)))
    .with(moduleFor("swap", commands.swap, new Swap(deps)))
    .with(moduleFor("swap-rows", commands.swapRows, new SwapRows(deps)))
    .with(moduleFor("use", commands.use, new Use(deps)))
    .with(moduleFor("recruit", commands.recruit, new Recruit(deps)))
    .with(moduleFor("summon", commands.summon, new Summon()))
    .with(
      moduleFor("invoke-demon", commands.invokeDemon, new InvokeDemon(deps))
    )
    .with(moduleFor("move-world", commands.moveWorld, new MoveWorld(deps)))
    .with(
      moduleFor("travel-world", commands.travelWorld, new TravelWorld(deps))
    )
    .with(moduleFor("visit-world", commands.visitWorld, new VisitWorld(deps)))
    .with(
      moduleFor(
        "contract-demon",
        commands.contractDemon,
        new ContractDemon(deps)
      )
    )
    .with(
      moduleFor("choose-demon", commands.chooseDemon, new ChooseDemon(deps))
    )
    .with(moduleFor("reroll", commands.reroll, new Reroll(deps)))
    .with(moduleFor("upgrade", commands.upgrade, new Upgrade(deps)))
    .with(moduleFor("reforge", commands.reforge, new Reforge(deps)))
    .with(moduleFor("dismiss-wipe", commands.dismissWipe, new DismissWipe()))
    .with(moduleFor("see-ending", commands.seeEnding, new SeeEnding()))
    .with(moduleFor("repair", commands.repair, new Repair(deps)))
    .with(moduleFor("craft", commands.craft, new Craft(deps)))
    .with(moduleFor("inscribe", commands.inscribe, new Inscribe(deps)))
    .with(
      moduleFor("accept-quest", commands.acceptQuest, new AcceptQuest(deps))
    )
    .with(moduleFor("fight-quest", commands.fightQuest, new FightQuest(deps)))
    .with(moduleFor("claim-quest", commands.claimQuest, new ClaimQuest(deps)))
    .with(moduleFor("chat", commands.chat, new Chat()))
}
