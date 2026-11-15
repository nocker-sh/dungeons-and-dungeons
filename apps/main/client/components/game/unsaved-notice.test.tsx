// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vite-plus/test"
import { UnsavedNotice } from "@/client/components/game/unsaved-notice"

afterEach(cleanup)

it("保存しないことを、押せない控えめな表示で知らせる", () => {
  render(<UnsavedNotice />)
  const notice = screen.getByRole("status")
  expect(notice.textContent).toBe("保存していません")
  expect(notice.style.pointerEvents).toBe("none")
  expect(notice.querySelector("button")).toBeNull()
})
