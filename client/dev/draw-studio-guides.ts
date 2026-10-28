import type { StudioInspection } from "@/client/dev/studio-types"

export function drawStudioGuides(
  enabled: boolean,
  elements: () => StudioInspection["elements"]
) {
  for (const element of document.querySelectorAll<HTMLElement>(
    "[data-studio-guide]"
  ))
    element.remove()
  if (!enabled) return
  const overlay = document.createElement("div")
  overlay.dataset.studioGuide = "true"
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99999",
    pointerEvents: "none",
  })
  for (const entry of elements()) {
    const box = document.createElement("div")
    Object.assign(box.style, {
      position: "absolute",
      left: `${entry.x}px`,
      top: `${entry.y}px`,
      width: `${entry.width}px`,
      height: `${entry.height}px`,
      border: `1px solid ${entry.outside ? "#ff6467" : "#00d5be"}`,
      boxSizing: "border-box",
      font: "10px monospace",
      color: "#00d5be",
    })
    box.textContent = entry.label
    overlay.append(box)
  }
  document.body.append(overlay)
}
