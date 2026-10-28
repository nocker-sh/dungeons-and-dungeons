import { useState } from "react"
import { Link } from "@void/react"
import { Button } from "@/client/components/ui/button"
import { Card } from "@/client/components/ui/card"
import { Input } from "@/client/components/ui/input"
import { SidebarInset } from "@/client/components/ui/sidebar-inset"
import { StudioNavigation } from "@/client/components/dev/studio-navigation"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { viewportPresets } from "@/development/studio/config"
import { studioScenes } from "@/development/studio/scenarios"
import { layoutTime } from "@/development/studio/layout-time"
import { LayoutFrame } from "@/client/components/dev/layout-frame"

export function LayoutsPage() {
  const [viewport, setViewport] = useState<(typeof viewportPresets)[number]>(
    viewportPresets[0]
  )
  const [filter, setFilter] = useState("")
  const [page, setPage] = useState(0)
  const scenes = studioScenes.filter((scene) =>
    `${scene.title} ${scene.slug}`.includes(filter)
  )
  const pageSize = 6
  const pageCount = Math.max(1, Math.ceil(scenes.length / pageSize))
  const selectedPage = Math.min(page, pageCount - 1)
  const visible = scenes.slice(
    selectedPage * pageSize,
    (selectedPage + 1) * pageSize
  )
  return (
    <>
      <StudioNavigation />
      <SidebarInset
        style={{ height: "100dvh", overflow: "auto", minWidth: 720 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 16,
            flexWrap: "wrap",
          }}
        >
          {viewportPresets.map((preset) => (
            <Button
              key={preset.name}
              variant={viewport.name === preset.name ? "secondary" : "outline"}
              onClick={() => setViewport(preset)}
            >
              {preset.name}
            </Button>
          ))}
          <Input
            aria-label="場面を絞り込む"
            placeholder="場面を絞り込む"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value)
              setPage(0)
            }}
            style={{ width: 220 }}
          />
          <Button
            variant="outline"
            disabled={selectedPage === 0}
            onClick={() => setPage(selectedPage - 1)}
          >
            前へ
          </Button>
          <span>
            {selectedPage + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            disabled={selectedPage + 1 === pageCount}
            onClick={() => setPage(selectedPage + 1)}
          >
            次へ
          </Button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 16,
            padding: 16,
            alignItems: "start",
          }}
        >
          {visible.map((scene) => {
            const config = parseStudioConfig({
              scene: scene.slug,
              width: viewport.width,
              height: viewport.height,
            })
            const at = layoutTime(scene.slug)
            return (
              <Card
                key={`${scene.slug}:${viewport.name}`}
                style={{ padding: 0, gap: 0, overflow: "hidden" }}
              >
                <Link
                  href={`/dev/studio/${scene.slug}`}
                  style={{ display: "block", padding: 12 }}
                >
                  {scene.title}
                </Link>
                <LayoutFrame config={config} at={at} />
              </Card>
            )
          })}
        </div>
      </SidebarInset>
    </>
  )
}

export default LayoutsPage
