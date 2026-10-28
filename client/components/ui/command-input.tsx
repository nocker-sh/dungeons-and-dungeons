import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "cn"
import { InputGroup } from "@/client/components/ui/input-group"
import { InputGroupAddon } from "@/client/components/ui/input-group-addon"
import { SearchIcon } from "lucide-react"

type Props = React.ComponentProps<typeof CommandPrimitive.Input>

export function CommandInput(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div data-slot="command-input-wrapper" className="p-1 pb-0">
      <InputGroup className="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!">
        <CommandPrimitive.Input
          data-slot="command-input"
          className={cn(
            "w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            props.className
          )}
          {...restProps}
        />
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
