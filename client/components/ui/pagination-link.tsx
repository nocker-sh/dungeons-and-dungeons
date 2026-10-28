import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { Button } from "@/client/components/ui/button"

export type Props = {
  isActive?: boolean
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">

export function PaginationLink(props: Props) {
  const size = props.size === undefined ? "icon" : props.size
  const restProps = omitProps(props, ["className", "isActive", "size"])

  return (
    <Button
      variant={props.isActive ? "outline" : "ghost"}
      size={size}
      className={cn(props.className)}
      nativeButton={false}
      render={
        <a
          aria-current={props.isActive ? "page" : undefined}
          data-slot="pagination-link"
          data-active={props.isActive}
          {...restProps}
        />
      }
    />
  )
}
