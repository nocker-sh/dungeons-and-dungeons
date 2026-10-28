import { Link } from "@void/react"
import { SidebarGroup } from "@/client/components/ui/sidebar-group"
import { SidebarMenu } from "@/client/components/ui/sidebar-menu"
import { SidebarMenuButton } from "@/client/components/ui/sidebar-menu-button"
import { SidebarMenuItem } from "@/client/components/ui/sidebar-menu-item"
import { SidebarSeparator } from "@/client/components/ui/sidebar-separator"

/** 開発の道具を人物資料のメニューと同じ左側に置く。 */
type Props = {
  active?: boolean
  layouts?: boolean
}

export function DevToolNavigation(props: Props) {
  const active = props.active === undefined ? false : props.active
  const layouts = props.layouts === undefined ? false : props.layouts

  return (
    <>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={active && !layouts}
              render={<Link href="/dev/studio" />}
            >
              スタジオ
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={layouts}
              render={<Link href="/dev/layouts" />}
            >
              レイアウト一覧
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      <SidebarSeparator />
    </>
  )
}
