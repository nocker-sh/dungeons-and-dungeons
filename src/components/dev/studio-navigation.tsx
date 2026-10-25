import { Link } from "@void/react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { studioScenes } from "@/lib/dev/studio/scenarios"
import { DevToolNavigation } from "./navigation"
import { devCategories } from "@/lib/dev/categories"

export function StudioNavigation({ scene }: { scene?: string }) {
  return (
    <Sidebar
      side="left"
      collapsible="none"
      style={{ height: "100dvh", flexShrink: 0 }}
    >
      <SidebarContent>
        <DevToolNavigation active layouts={scene === undefined} />
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
                  isActive={scene === entry.slug}
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
