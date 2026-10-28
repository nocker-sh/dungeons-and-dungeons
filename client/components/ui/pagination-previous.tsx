import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { ChevronLeftIcon } from "lucide-react"
import { PaginationLink } from "@/client/components/ui/pagination-link"

type Props = React.ComponentProps<typeof PaginationLink> & { text?: string }

export function PaginationPrevious(props: Props) {
  const text = props.text === undefined ? "Previous" : props.text
  const restProps = omitProps(props, ["className", "text"])

  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn("pl-1.5!", props.className)}
      {...restProps}
    >
      <ChevronLeftIcon data-icon="inline-start" />
      <span className="hidden sm:block">{text}</span>
    </PaginationLink>
  )
}
