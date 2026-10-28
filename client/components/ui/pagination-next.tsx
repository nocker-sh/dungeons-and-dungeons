import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { ChevronRightIcon } from "lucide-react"
import { PaginationLink } from "@/client/components/ui/pagination-link"

type Props = React.ComponentProps<typeof PaginationLink> & { text?: string }

export function PaginationNext(props: Props) {
  const text = props.text === undefined ? "Next" : props.text
  const restProps = omitProps(props, ["className", "text"])

  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn("pr-1.5!", props.className)}
      {...restProps}
    >
      <span className="hidden sm:block">{text}</span>
      <ChevronRightIcon data-icon="inline-end" />
    </PaginationLink>
  )
}
