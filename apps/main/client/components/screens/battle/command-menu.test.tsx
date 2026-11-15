// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import type { Props as WordProps } from "@/client/components/stage/word"
import { CommandMenu } from "@/client/components/screens/battle/command-menu"
import type { Commands } from "@/client/components/screens/battle/types"

vi.mock("@/client/components/stage/word", () => ({
  Word: ({ text, disabled, onClick }: WordProps) => (
    <button
      disabled={disabled}
      onClick={(event) => onClick?.(event.currentTarget)}
    >
      {text}
    </button>
  ),
}))
vi.mock("@/client/components/stage/revolver", () => ({ Revolver: () => null }))

afterEach(cleanup)

describe("CommandMenu", () => {
  it("選べるモードがなくてもケイヤクを開ける（理由は一覧で見せる）", () => {
    const onPact = vi.fn()
    const commands = {
      weaponSkills: [],
      blessing: null,
      brawl: null,
      skills: [],
      items: [],
      pact: [{ usable: false }],
    } as unknown as Commands
    render(
      <CommandMenu
        commands={commands}
        demonCall={null}
        wide={false}
        selected={0}
        onSelect={() => {}}
        onWeaponSkill={() => {}}
        onSkills={() => {}}
        onGuard={() => {}}
        onItems={() => {}}
        onBrawl={() => {}}
        onPact={onPact}
        onDemon={() => {}}
      />
    )
    const button = screen.getByText("ケイヤク")
    expect((button as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(button)
    expect(onPact).toHaveBeenCalledOnce()
  })
})
