import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"

const ownership = new WizObjectService()

/**
 * Vault factory 群が共有する所有境界。
 *
 * 同じ factory graph 内ですでに所有した monster/event node は再複製せず、
 * area からも同じ canonical node を参照する。
 */
export const ownWizVaultFactoryValue = <TValue>(value: TValue): WizDeepReadonly<TValue> =>
  ownership.ownImmutable(value)
