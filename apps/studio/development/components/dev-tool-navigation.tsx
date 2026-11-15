import { Link } from "@void/react"
import { SidebarGroup } from "@/development/ui/sidebar-group"
import { SidebarMenu } from "@/development/ui/sidebar-menu"
import { SidebarMenuButton } from "@/development/ui/sidebar-menu-button"
import { SidebarMenuItem } from "@/development/ui/sidebar-menu-item"
import { SidebarSeparator } from "@/development/ui/sidebar-separator"

const tools = [
  { value: "studio", label: "スタジオ", href: "/studio" },
  { value: "layouts", label: "レイアウト一覧", href: "/layouts" },
  { value: "save", label: "セーブで試遊", href: "/save" },
] as const

/** 開発の道具を人物資料のメニューと同じ左側に置く。 */
type Props = {
  current?: (typeof tools)[number]["value"]
}

export function DevToolNavigation(props: Props) {
  return (
    <>
      <SidebarGroup>
        <SidebarMenu>
          {tools.map((tool) => (
            <SidebarMenuItem key={tool.value}>
              <SidebarMenuButton
                isActive={props.current === tool.value}
                render={<Link href={tool.href} />}
              >
                {tool.label}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
      <SidebarSeparator />
    </>
  )
}
