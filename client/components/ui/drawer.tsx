import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import { DrawerContext } from "@/client/components/ui/drawer-shared"

type Props = DrawerPrimitive.Root.Props & {
  showSwipeHandle?: boolean
}

export function Drawer(props: Props) {
  const modal = props.modal === undefined ? true : props.modal
  const showSwipeHandle =
    props.showSwipeHandle === undefined ? false : props.showSwipeHandle
  const swipeDirection =
    props.swipeDirection === undefined ? "down" : props.swipeDirection
  const restProps = omitProps(props, [
    "modal",
    "showSwipeHandle",
    "snapPoints",
    "swipeDirection",
  ])

  const hasSnapPoints = props.snapPoints != null && props.snapPoints.length > 0
  const contextValue = React.useMemo(
    () => ({ hasSnapPoints, modal, showSwipeHandle, swipeDirection }),
    [hasSnapPoints, modal, showSwipeHandle, swipeDirection]
  )

  return (
    <DrawerContext.Provider value={contextValue}>
      <DrawerPrimitive.Root
        data-slot="drawer"
        modal={modal}
        snapPoints={props.snapPoints}
        swipeDirection={swipeDirection}
        {...restProps}
      />
    </DrawerContext.Provider>
  )
}
