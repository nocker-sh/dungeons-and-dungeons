import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { Dialog } from "@/client/components/ui/dialog"
import { DialogContent } from "@/client/components/ui/dialog-content"
import { DialogDescription } from "@/client/components/ui/dialog-description"
import { DialogHeader } from "@/client/components/ui/dialog-header"
import { DialogTitle } from "@/client/components/ui/dialog-title"

type Props = Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
  children: React.ReactNode
}

export function CommandDialog(props: Props) {
  const title = props.title === undefined ? "Command Palette" : props.title
  const description =
    props.description === undefined
      ? "Search for a command to run..."
      : props.description
  const showCloseButton =
    props.showCloseButton === undefined ? false : props.showCloseButton
  const restProps = omitProps(props, [
    "title",
    "description",
    "children",
    "className",
    "showCloseButton",
  ])

  return (
    <Dialog {...restProps}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn(
          "top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0",
          props.className
        )}
        showCloseButton={showCloseButton}
      >
        {props.children}
      </DialogContent>
    </Dialog>
  )
}
