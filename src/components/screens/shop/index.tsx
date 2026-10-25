import { useEffect, useRef, useState } from "react"
import { StageChrome } from "@/components/stage/chrome"
import { Inscription } from "@/components/game/inscription"
import { CanvasButton } from "@/components/canvas/primitives"
import {
  keeperOf,
  placeIdOf,
  portraitOf,
  shopLook,
  standOf,
} from "@/lib/content/looks"
import { ListView, useListBurst } from "@/components/game/list-view"
import { armorComparisonText, gearDesc } from "@/components/game/gear-text"
import { useArrival, useNav, type ShopId } from "@/components/game/nav"
import {
  playEventConversation,
  useVisitScene,
} from "@/components/game/event-conversation"
import { pickOne } from "@/components/stage/kit"
import { Guide, type GuideHandle } from "@/components/stage/guide"
import {
  LeavingContext,
  useLeaving,
  useStage,
} from "@/components/stage/stage-context"
import { useFx } from "@/components/stage/use-fx"
import { Word, useWide } from "@/components/stage/word"
import { useGame, useGameState } from "@/contexts/game"
import { eventsOf, inPhase } from "@/lib/wiz"
import { UI_LAYER } from "@/components/canvas/tokens"
import { SmithyMenus } from "./smithy-menus"
import { Appraisal } from "./appraisal"

/** 店：店主の立ち絵と「購入」「売却」「会話」、鑑定できる店は「鑑定」。 */
export function Shop({ shop }: { shop: ShopId }) {
  const game = useGame()
  const state = useGameState()
  const nav = useNav()
  const fx = useFx()
  const wide = useWide()
  const leaving = useLeaving()
  const burst = useListBurst()
  const stage = useStage()
  const def = shopLook(shop, wide)
  const [keeperId, partnerId] = def.keepers
  const keeper = keeperOf(keeperId ?? shop)
  const mate = partnerId ? keeperOf(partnerId) : null
  const ready = useArrival(def.scene, "dolly")
  // 画面の幅が変わって絵が替わったときも、読み込んでから差し替える
  useEffect(() => void stage.art(def.scene), [stage, def.scene])
  useVisitScene(placeIdOf(def.place), ready)
  const front = useRef<GuideHandle>(null)
  const back = useRef<GuideHandle>(null)
  const [say, setSay] = useState<{ text: string; who: number }>({
    text: keeper.lines[0],
    who: 0,
  })
  const [overlay, setOverlay] = useState<
    | "buy"
    | "sell"
    | "appraise"
    | "upgrade"
    | "craft"
    | "repair"
    | "reforge"
    | "inscribe"
    | "talk"
    | null
  >(null)
  const [menuKey, setMenuKey] = useState(0)
  const [smithyNotice, setSmithyNotice] = useState("")
  const info = game.queries.shop(state, shop)
  const smithy = def.kind === "smithy" ? game.queries.smithy(state) : null
  if (!ready || (!info && !smithy)) return null
  const close = () => {
    setSmithyNotice("")
    setOverlay(null)
    setMenuKey((key) => key + 1)
    const who = mate && Math.random() < 0.5 ? 1 : 0
    setSay({ text: pickOne((who ? mate! : keeper).lines), who })
  }
  /** 話しかける。台本の選択・既読・フラグは Game が持つ。 */
  const talk = () => {
    setOverlay("talk")
    void playEventConversation(game, "talk", undefined, {
      resident: keeperId ?? shop,
    }).then(close)
  }
  // ユニークの仲間の固有の武器（あれば「鍛え直し」を出す）
  const reforges = def.kind === "smithy" ? game.queries.reforges(state) : []
  const dim =
    "brightness(.72) drop-shadow(calc(var(--u) * 1.2) calc(var(--u) * 1.2) 0 #0b0c12)"
  return (
    <div className="ui-layer" style={UI_LAYER}>
      {smithy && !overlay ? (
        <CanvasButton
          data-inscription-trigger
          onClick={() => setOverlay("inscribe")}
          style={{
            position: "absolute",
            // 縦長では店主のセリフと重ならないよう、空いている左下へ
            ...(wide
              ? { top: "12%", right: "4%" }
              : { left: "4%", bottom: "22%" }),
            zIndex: 20,
            padding: "12px 18px",
            background: "#efe7d4",
            color: "#181818",
            border: "3px solid",
            fontWeight: 900,
            pointerEvents: "auto",
          }}
        >
          ワザの付け替え（書 {smithy.books}冊）
        </CanvasButton>
      ) : null}
      {overlay === "inscribe" ? <Inscription onClose={close} /> : null}
      {mate ? (
        <Guide
          ref={back}
          img={portraitOf(partnerId!, overlay === "talk" ? "talk" : "normal")}
          say={say.who === 1 ? say.text : null}
          className="keeper mate"
          delay={220}
          rotate={3}
          style={{
            ...standOf(def.place, wide, 1),
            zIndex: say.who === 1 ? 2 : 1,
          }}
          imgStyle={{ filter: say.who === 1 ? undefined : dim }}
          sayStyle={wide ? undefined : { left: "-4%", top: "-22%" }}
        />
      ) : null}
      <Guide
        ref={front}
        img={portraitOf(
          keeperId ?? shop,
          overlay === "talk" ? "talk" : "normal"
        )}
        say={say.who === 0 ? say.text : null}
        className="keeper"
        style={{
          ...standOf(def.place, wide),
          zIndex: say.who === 0 ? 2 : 1,
        }}
        imgStyle={{ filter: say.who === 0 || !mate ? undefined : dim }}
      />
      <LeavingContext.Provider value={leaving || !!overlay}>
        <div key={menuKey} style={{ display: "contents" }}>
          {info ? (
            <>
              <Word
                text="購入"
                size={wide ? 15 : 13}
                paper
                big
                tilt={-3}
                rotate={-6}
                delay={300}
                style={
                  wide
                    ? { right: "4vw", bottom: "10%" }
                    : { right: "2vw", bottom: "8%" }
                }
                onClick={() => setOverlay("buy")}
              />
              <Word
                text="売却"
                size={9}
                big
                tilt={2}
                rotate={4}
                delay={390}
                style={
                  wide
                    ? { right: "33vw", bottom: "12%" }
                    : { right: "6vw", bottom: "30%" }
                }
                onClick={() => setOverlay("sell")}
              />
            </>
          ) : (
            <>
              <Word
                text="強化"
                size={wide ? 15 : 13}
                paper
                big
                tilt={-3}
                rotate={-6}
                delay={300}
                style={
                  wide
                    ? { right: "4vw", bottom: "10%" }
                    : { right: "2vw", bottom: "8%" }
                }
                onClick={() => setOverlay("upgrade")}
              />
              <Word
                text="生産"
                size={9}
                big
                tilt={2}
                rotate={4}
                delay={390}
                style={
                  wide
                    ? { right: "33vw", bottom: "12%" }
                    : { right: "6vw", bottom: "30%" }
                }
                onClick={() => setOverlay("craft")}
              />
              <Word
                text="修理"
                size={9}
                big
                tilt={2.5}
                rotate={5}
                delay={570}
                style={
                  wide
                    ? { right: "30vw", bottom: "36%" }
                    : { right: "4vw", bottom: "50%" }
                }
                onClick={() => setOverlay("repair")}
              />
              {reforges.length ? (
                <Word
                  text="鍛え直し"
                  size={7}
                  big
                  tilt={-2}
                  rotate={-4}
                  delay={660}
                  style={
                    wide
                      ? { right: "52vw", bottom: "22%" }
                      : { right: "6vw", bottom: "64%" }
                  }
                  onClick={() => setOverlay("reforge")}
                />
              ) : null}
            </>
          )}
          <Word
            text="会話"
            size={9}
            big
            tilt={-1.5}
            rotate={-3}
            delay={480}
            style={
              wide
                ? { right: "8vw", bottom: "52%" }
                : { right: "34vw", bottom: "44%" }
            }
            onClick={talk}
          />
          {info?.appraise ? (
            <Word
              text="鑑定"
              size={9}
              big
              tilt={2.5}
              rotate={5}
              delay={570}
              style={
                wide
                  ? { right: "30vw", bottom: "36%" }
                  : { right: "36vw", bottom: "26%" }
              }
              onClick={() => setOverlay("appraise")}
            />
          ) : null}
          <StageChrome>
            <Word
              text="‹ 戻る"
              size={wide ? 4.4 : 4.8}
              tilt={-4}
              rotate={3}
              delay={450}
              style={{ right: "4%", top: wide ? "8%" : "6%" }}
              onClick={() =>
                void nav.go(
                  { name: "place", place: "shop" },
                  { exit: { z: 1.8, blur: 12, ms: 360 } }
                )
              }
            />
          </StageChrome>
        </div>
      </LeavingContext.Provider>
      <SmithyMenus
        menu={overlay}
        notice={smithyNotice}
        onNotice={setSmithyNotice}
        onClose={close}
      />
      {overlay === "buy" && info ? (
        <ListView
          title="購入"
          gold={state.gold}
          tabs={[
            {
              name: "品物",
              rows: info.goods.map((good) => {
                // 武器は、買って持つと一番強くなる仲間を添える
                const best = good.weapon
                  ? game.queries.upgradesForGood(state, good.id)[0]
                  : undefined
                return {
                  key: good.id,
                  icon: good.id,
                  name: good.name,
                  stat: good.stat,
                  desc: [
                    best
                      ? `${best.name}が持つと 攻撃力 ${best.before} → ${best.after}`
                      : "",
                    good.kind === "armor" && good.appraisalAvailable
                      ? "通常のガラクタの鑑定でも入手できます。"
                      : "",
                    gearDesc(good),
                    ...(good.kind === "armor" && good.equipMembers?.length
                      ? [
                          "未強化・消耗なしで着替えた比較：",
                          ...good.equipMembers.map((member) =>
                            armorComparisonText(
                              game.queries.armorGoalComparison(
                                state,
                                member.id,
                                good.id
                              ),
                              `${member.name}（現在：${game.queries.member(state, member.id)?.armor?.name ?? "防具なし"}）`
                            )
                          ),
                        ]
                      : []),
                    good.equipMembers
                      ? good.equipMembers.length
                        ? `装備できる仲間：${good.equipMembers.map((member) => member.name).join("・")}`
                        : "今の編成に、この品を装備できる仲間はいません。"
                      : "",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                  badge: `${good.price}G`,
                  sub: best ? `${best.name} ↑` : `所持 ${good.own}`,
                  rarity: good.weapon?.rarity ?? null,
                }
              }),
            },
          ]}
          action={(row) => {
            const good = info.goods.find((entry) => entry.id === row.key)
            return good
              ? good.affordable
                ? `${good.price}G で買う`
                : "お金が足りない"
              : null
          }}
          onAction={(row, at) => {
            if (
              Array.isArray(eventsOf(inPhase(game, "town")?.buy(shop, row.key)))
            )
              burst(at, "")
            else fx.shake(0.6)
          }}
          onClose={close}
        />
      ) : null}
      {overlay === "sell" && info ? (
        <ListView
          title="売却"
          gold={state.gold}
          tabs={[
            {
              name: "持ち物",
              rows: game.queries.sellables(state).map((good) => ({
                key: good.key,
                icon: good.id,
                name: good.name,
                stat: good.stat,
                desc: gearDesc(good),
                badge: `${good.price}G`,
                sub:
                  good.count > 1
                    ? `所持 ${good.count}`
                    : good.kind === "weapon" || good.kind === "armor"
                      ? "装備"
                      : "",
                rarity: good.weapon?.rarity ?? null,
              })),
            },
          ]}
          action={(row) => {
            const good = game.queries
              .sellables(state)
              .find((entry) => entry.key === row.key)
            return good ? `${good.price}G で売る` : null
          }}
          onAction={(row, at) => {
            const good = game.queries
              .sellables(state)
              .find((entry) => entry.key === row.key)
            const sent = good?.sell.gear
              ? eventsOf(inPhase(game, "town")?.sellGear(good.sell.gear))
              : good?.sell.good
                ? eventsOf(inPhase(game, "town")?.sellGood(good.sell.good))
                : null
            if (Array.isArray(sent)) burst(at, "", false)
            else fx.shake(0.6)
          }}
          onClose={close}
        />
      ) : null}
      {overlay === "appraise" && info ? (
        <Appraisal shop={shop} onClose={close} />
      ) : null}
    </div>
  )
}
