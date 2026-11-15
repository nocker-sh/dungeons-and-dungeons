import { unitStep } from "@/client/components/stage/unit-step"

/** いまの単位（px）。Canvas の --u と同じ値。 */
export const unitPx = () => unitStep(innerWidth, innerHeight)
