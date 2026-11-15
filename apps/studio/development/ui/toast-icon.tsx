import * as React from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

type Props = { type: string | undefined }

export function ToastIcon(props: Props) {
  let icon: React.ReactNode = null

  if (props.type === "success") {
    icon = <CircleCheckIcon aria-hidden="true" />
  }

  if (props.type === "info") {
    icon = <InfoIcon aria-hidden="true" />
  }

  if (props.type === "warning") {
    icon = <TriangleAlertIcon aria-hidden="true" />
  }

  if (props.type === "error") {
    icon = <OctagonXIcon className="text-destructive" aria-hidden="true" />
  }

  if (props.type === "loading") {
    icon = <Loader2Icon className="animate-spin" aria-hidden="true" />
  }

  if (!icon) {
    return null
  }

  return (
    <span
      data-slot="toast-icon"
      className="shrink-0 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
    >
      {icon}
    </span>
  )
}
