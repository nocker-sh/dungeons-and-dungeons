import { Link } from "@void/react"
import { Sidebar } from "@/development/ui/sidebar"
import { SidebarContent } from "@/development/ui/sidebar-content"
import { SidebarGroup } from "@/development/ui/sidebar-group"
import { SidebarGroupLabel } from "@/development/ui/sidebar-group-label"
import { SidebarMenu } from "@/development/ui/sidebar-menu"
import { SidebarMenuButton } from "@/development/ui/sidebar-menu-button"
import { SidebarMenuItem } from "@/development/ui/sidebar-menu-item"
import { SidebarSeparator } from "@/development/ui/sidebar-separator"
import { studioScenes } from "@/development/studio/scenarios"
import { DevToolNavigation } from "@/development/components/dev-tool-navigation"
import { devCategories } from "@/development/categories"

type Props = { scene?: string; tool?: "layouts" | "save" }

export function StudioNavigation(props: Props) {
  return (
    <Sidebar
      side="left"
      collapsible="none"
      style={{ height: "100dvh", flexShrink: 0 }}
    >
      <SidebarContent>
        <DevToolNavigation
          current={props.scene === undefined ? props.tool : "studio"}
        />
        <SidebarGroup>
          <SidebarMenu>
            {devCategories.map((category) => (
              <SidebarMenuItem key={category.value}>
                <SidebarMenuButton
                  render={<Link href={`/${category.value}`} />}
                >
                  {category.label}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>場面</SidebarGroupLabel>
          <SidebarMenu>
            {studioScenes.map((entry) => (
              <SidebarMenuItem key={entry.slug}>
                <SidebarMenuButton
                  isActive={props.scene === entry.slug}
                  render={<Link href={`/studio/${entry.slug}`} />}
                >
                  {entry.title}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
