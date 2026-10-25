import { Link } from "@void/react"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
/** 開発の道具を人物資料のメニューと同じ左側に置く。 */
export function DevToolNavigation({
  active = false,
  layouts = false,
}: {
  active?: boolean
  layouts?: boolean
}) {
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
