import { Button } from "@/client/components/ui/button"
import { Input } from "@/client/components/ui/input"
import { Slider } from "@/client/components/ui/slider"
import type { StudioInspection } from "@/client/dev/studio-types"
import type { StudioConfig } from "@/development/studio/config"

export const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
} as const

/** 再生位置と操作・演出のトラックを表示する。時計の移動は再生hookへ委ねる。 */
type Props = {
  duration: number
  actions: StudioConfig["actions"]
  time: number
  playing: boolean
  inspection: StudioInspection | null
  onPlayingChange: (playing: boolean) => void
  onSeek: (time: number) => Promise<void>
}

export function StudioTimeline(props: Props) {
  const trackGroups = new Map<string, StudioInspection["animations"]>()
  for (const track of props.inspection?.animations ?? []) {
    const key = `${track.label} · ${track.properties.join(", ")}`
    trackGroups.set(key, [...(trackGroups.get(key) ?? []), track])
  }
  return (
    <>
      <div style={rowStyle}>
        <Button
          size="sm"
          title="Space"
          onClick={() => props.onPlayingChange(!props.playing)}
          disabled={!props.inspection}
        >
          {props.playing ? "停止" : "再生"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          title="←（Shiftで1秒）"
          disabled={!props.inspection}
          onClick={() => {
            props.onPlayingChange(false)
            void props.onSeek(Math.max(0, props.time - 1000 / 60))
          }}
        >
          −1コマ
        </Button>
        <Button
          variant="outline"
          size="sm"
          title="→（Shiftで1秒）"
          disabled={!props.inspection}
          onClick={() => {
            props.onPlayingChange(false)
            void props.onSeek(Math.min(props.duration, props.time + 1000 / 60))
          }}
        >
          ＋1コマ
        </Button>
        <Input
          aria-label="時刻（ms）"
          type="number"
          min={0}
          max={props.duration}
          value={Math.round(props.time)}
          style={{ width: 110 }}
          onChange={(event) => {
            props.onPlayingChange(false)
            void props.onSeek(
              Math.min(props.duration, Math.max(0, Number(event.target.value)))
            )
          }}
        />
        <span style={{ fontSize: 12 }}>ms / {props.duration}</span>
      </div>
      <Slider
        aria-label="タイムライン"
        min={0}
        max={props.duration}
        step={10}
        value={[Math.round(props.time)]}
        onValueChange={(value) => {
          props.onPlayingChange(false)
          void props.onSeek(Array.isArray(value) ? value[0] : value)
        }}
      />
      <div
        aria-label="アニメーショントラック"
        style={{
          maxHeight: 140,
          overflowY: "auto",
          border: "1px solid var(--border)",
          borderRadius: 4,
        }}
      >
        {[...trackGroups].map(([label, tracks]) => (
          <div
            key={label}
            style={{
              display: "grid",
              gridTemplateColumns: "120px minmax(0,1fr)",
              height: 20,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              title={label}
              style={{
                fontSize: 10,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                padding: "2px 4px",
              }}
            >
              {label}
            </span>
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                borderLeft: "1px solid var(--border)",
              }}
            >
              {tracks.map((track) => (
                <button
                  key={track.id}
                  aria-label={`${label}・${Math.round(track.start)}msへ`}
                  title={`${Math.round(track.start)}ms / ${Math.round(track.duration)}ms`}
                  onClick={() => {
                    props.onPlayingChange(false)
                    void props.onSeek(
                      Math.max(0, Math.min(props.duration, track.start))
                    )
                  }}
                  style={{
                    position: "absolute",
                    top: 3,
                    left: `${(track.start / props.duration) * 100}%`,
                    width: `${Math.max(0.3, (Math.min(props.duration, track.duration) / props.duration) * 100)}%`,
                    height: 13,
                    border: "1px solid var(--border)",
                    borderRadius: 2,
                    background: "var(--muted-foreground)",
                    cursor: "pointer",
                  }}
                />
              ))}
              {props.actions.map((action, index) => (
                <button
                  key={index}
                  aria-label={`${action.label}の時刻へ`}
                  title={`${action.at}ms: ${action.label}`}
                  onClick={() => {
                    props.onPlayingChange(false)
                    void props.onSeek(action.at)
                  }}
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${(action.at / props.duration) * 100}%`,
                    width: 2,
                    padding: 0,
                    border: 0,
                    background: "var(--primary)",
                    cursor: "pointer",
                  }}
                />
              ))}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${(props.time / props.duration) * 100}%`,
                  width: 2,
                  background: "var(--foreground)",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
