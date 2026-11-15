// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"
import { playback } from "@/client/components/canvas/playback"
import { useFormation } from "@/client/components/game/formation/context"
import { Shell } from "@/client/components/game/shell"
import { ResultPanel } from "@/client/components/screens/result-panel"
import { FxStore } from "@/client/components/stage/fx/store"
import { GameProvider } from "@/client/contexts/game-provider"
import { useGameState } from "@/client/contexts/use-game-state"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { catalogOf } from "@/lib/wiz/testing/catalog-of"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import type { Game } from "@/lib/wiz/game/game"
import type { PreviewStart } from "@/client/game/preview-start"

let fx: { mock: { calls: unknown[] } }
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  // 演出の出力先だけを差し替える。オーバーレイの状態機械と結果の板は本物。
  fx = vi
    .spyOn(FxStore.prototype, "add")
    .mockImplementation(() => playback(Promise.resolve(), () => {}))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const definition = new GameDefinition(catalogOf(realContent()))

function mount(game: Game, preview: PreviewStart) {
  render(
    <GameProvider game={game}>
      <Shell
        game={game}
        unreadable={null}
        onDiscard={async () => {}}
        saveFailed={false}
        preview={preview}
      />
    </GameProvider>
  )
}

test("進む途中にバッグを開いたまま戦闘へ入っても、札と画面を操作できる", () => {
  const seen: { phase: string; bag: boolean; hidden: boolean }[] = []
  function Probe() {
    const formation = useFormation()
    seen.push({
      phase: useGameState().phase.type,
      bag: formation.bagOpen,
      hidden: formation.cardsHidden,
    })
    return null
  }
  // 0層の入口から、最初の戦闘の地点へ進む直前。
  const game = definition.create(
    testEnvironment(),
    aState(definition.catalog).inExpedition().build()
  )
  mount(game, {
    screen: { name: "expedition" },
    overlay: { kind: "bag" },
    render: <Probe />,
  })
  expect(seen.at(-1)).toMatchObject({ bag: true, hidden: true })
  act(() => {
    inPhase(game, "expedition")!.advance("n1")
  })
  expect(game.state.phase.type).toBe("battle")
  expect(seen.at(-1)).toEqual({ phase: "battle", bag: false, hidden: false })
})

test("一度閉じた結果の板は、次の全滅でも閉じるボタンを出す", async () => {
  const wipe = {
    layer: contentId("layer0"),
    gold: 30,
    goods: [{ good: contentId("junk"), count: 1 }],
  }
  const state = aState(definition.catalog).withWipe(wipe).build()
  const game = definition.create(testEnvironment(), state)
  const again = definition.create(testEnvironment(), state).save()
  mount(game, {
    screen: { name: "town", intro: false },
    render: <ResultPanel />,
  })
  const shaken = fx.mock.calls.length
  await act(async () =>
    fireEvent.click(await screen.findByRole("button", { name: "街へ" }))
  )
  expect(game.state.wipe).toBeNull()
  expect(screen.queryByRole("dialog", { name: "全滅の結果" })).toBeNull()
  // 閉じる操作で揺れと光を出し直さない。
  expect(fx.mock.calls.length).toBe(shaken)
  act(() => {
    expect(game.restore(again)).toBeUndefined()
  })
  expect(screen.getByRole("dialog", { name: "全滅の結果" })).toBeDefined()
  expect(await screen.findByRole("button", { name: "街へ" })).toBeDefined()
})
