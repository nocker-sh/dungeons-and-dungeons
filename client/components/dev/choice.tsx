import { Select as SelectPrimitive } from "@base-ui/react/select"
import { SelectContent } from "@/client/components/ui/select-content"
import { SelectItem } from "@/client/components/ui/select-item"
import { SelectTrigger } from "@/client/components/ui/select-trigger"
import { SelectValue } from "@/client/components/ui/select-value"

type Props = {
  value: string
  onChange: (value: string) => void
  options: readonly { slug: string; name?: string; title?: string }[]
  disabled?: boolean
}

export function Choice(props: Props) {
  const disabled = props.disabled === undefined ? false : props.disabled

  return (
    <SelectPrimitive.Root
      value={props.value}
      disabled={disabled}
      onValueChange={(value) => {
        if (value) props.onChange(value)
      }}
    >
      <SelectTrigger style={{ width: "100%" }}>
        <SelectValue>
          {props.options.find((entry) => entry.slug === props.value)?.name ??
            props.value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {props.options.map((entry) => (
          <SelectItem key={entry.slug} value={entry.slug}>
            {entry.name ?? entry.title ?? entry.slug}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectPrimitive.Root>
  )
}
