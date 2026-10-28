import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizBuiltInActionName } from "@/lib/wiz/core/runtime/action"
import type { WizPluginSceneAction } from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import { WizStandardSchema } from "@/lib/wiz/core/standard-schema"
import { getSynchronousSchemaValue } from "@/lib/wiz/core/runtime/plugin/get-synchronous-schema-value"

export const getCanonicalPluginSceneAction = <
  TInput,
  TAction extends WizPluginSceneAction,
>(
  schema: WizStandardSchema<TInput, TAction>,
  input: unknown
): WizDeepReadonly<TAction> | null => {
  const action = getSynchronousSchemaValue(schema, input)
  if (typeof action !== "object" || action === null) {
    return null
  }
  const type = Object.getOwnPropertyDescriptor(action, "type")?.value
  if (
    typeof type !== "string" ||
    type.length === 0 ||
    type !== type.trim() ||
    WizBuiltInActionName.is(type)
  ) {
    return null
  }

  return action
}
