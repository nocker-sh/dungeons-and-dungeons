import type { Props as SourceProps } from "@/client/components/dev/workspace-shared"
import { Workspace } from "@/client/components/dev/workspace"

type Props = SourceProps

export function DevWorkspace(props: Props) {
  return <Workspace {...props} />
}
