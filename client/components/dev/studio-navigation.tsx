import { Link } from "@void/react"
import { Sidebar } from "@/client/components/ui/sidebar"
import { SidebarContent } from "@/client/components/ui/sidebar-content"
import { SidebarGroup } from "@/client/components/ui/sidebar-group"
import { SidebarGroupLabel } from "@/client/components/ui/sidebar-group-label"
import { SidebarMenu } from "@/client/components/ui/sidebar-menu"
import { SidebarMenuButton } from "@/client/components/ui/sidebar-menu-button"
import { SidebarMenuItem } from "@/client/components/ui/sidebar-menu-item"
import { SidebarSeparator } from "@/client/components/ui/sidebar-separator"
import { studioScenes } from "@/development/studio/scenarios"
import { DevToolNavigation } from "@/client/components/dev/dev-tool-navigation"
import { devCategories } from "@/development/categories"

type Props = { scene?: string }

export function StudioNavigation(props: Props) {
  return (
    <Sidebar
      side="left"
      collapsible="none"
      style={{ height: "100dvh", flexShrink: 0 }}
    >
      <SidebarContent>
        <DevToolNavigation active layouts={props.scene === undefined} />
        <SidebarGroup>
          <SidebarMenu>
            {devCategories.map((category) => (
              <SidebarMenuItem key={category.value}>
                <SidebarMenuButton
                  render={<Link href={`/dev/${category.value}`} />}
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
                  render={<Link href={`/dev/studio/${entry.slug}`} />}
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
