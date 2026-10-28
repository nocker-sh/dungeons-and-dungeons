import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { Link } from "@void/react"
import { ScrollArea } from "@/client/components/ui/scroll-area"
import { Sidebar } from "@/client/components/ui/sidebar"
import { SidebarContent } from "@/client/components/ui/sidebar-content"
import { SidebarGroup } from "@/client/components/ui/sidebar-group"
import { SidebarGroupLabel } from "@/client/components/ui/sidebar-group-label"
import { SidebarHeader } from "@/client/components/ui/sidebar-header"
import { SidebarInset } from "@/client/components/ui/sidebar-inset"
import { SidebarMenu } from "@/client/components/ui/sidebar-menu"
import { SidebarMenuButton } from "@/client/components/ui/sidebar-menu-button"
import { SidebarMenuItem } from "@/client/components/ui/sidebar-menu-item"
import { SidebarSeparator } from "@/client/components/ui/sidebar-separator"
import { SidebarTrigger } from "@/client/components/ui/sidebar-trigger"
import { useSidebar } from "@/client/components/ui/sidebar-shared"
import { devCategories } from "@/development/categories"
import type { DevCategory } from "@/development/categories"
import { DevToolNavigation } from "@/client/components/dev/dev-tool-navigation"
import { Tabs } from "@/client/components/ui/tabs"
import { TabsList } from "@/client/components/ui/tabs-list"
import { TabsTrigger } from "@/client/components/ui/tabs-trigger"
import { useArtworkVersion } from "@/client/components/dev/use-artwork-version"
import { Button } from "@/client/components/ui/button"

export type MenuEntry = { id: string; slug: string; name: string }

/** キャラ・品物・会話・エフェクトで同じ一覧と詳細の枠を使う。 */
type Props = {
  category: DevCategory
  sections: { label: string; entries: readonly MenuEntry[] }[]
  activeId?: string
  onEntryChange: (slug: string) => void
  filters?: ReactNode
  children: ReactNode
}

export function DevDataLayout(props: Props) {
  const { isMobile, setOpenMobile } = useSidebar()
  const { version, setVersion, columnCount, setColumnCount } =
    useArtworkVersion()
  function adjustColumns(change: number) {
    const availableWidth = Math.min(
      1280,
      window.innerWidth - (isMobile ? 32 : 320)
    )
    const responsiveColumns = Math.max(
      1,
      Math.floor((availableWidth + 24) / 344)
    )
    setColumnCount(
      Math.max(1, Math.min(6, (columnCount ?? responsiveColumns) + change))
    )
  }
  const selectedButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!isMobile) selectedButton.current?.scrollIntoView({ block: "nearest" })
  }, [props.category, props.activeId, isMobile])

  return (
    <>
      <Sidebar side="left" aria-label="データ一覧">
        <SidebarHeader>
          <div className="flex w-full items-center gap-1">
            <Tabs
              className="min-w-0 flex-1"
              value={version}
              onValueChange={(value) => {
                if (value === "v0" || value === "v1") setVersion(value)
              }}
            >
              <TabsList aria-label="画像バージョン" className="h-7 w-full">
                <TabsTrigger value="v0">v0</TabsTrigger>
                <TabsTrigger value="v1">v1</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="1行の表示数を減らす"
              disabled={columnCount === 1}
              onClick={() => adjustColumns(-1)}
            >
              −
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="1行の表示数を増やす"
              disabled={columnCount === 6}
              onClick={() => adjustColumns(1)}
            >
              ＋
            </Button>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <DevToolNavigation />
          <SidebarGroup>
            <SidebarMenu aria-label="カテゴリ">
              {devCategories.map((item) => (
                <SidebarMenuItem key={item.value}>
                  <SidebarMenuButton
                    isActive={props.category === item.value}
                    aria-current={
                      props.category === item.value ? "page" : undefined
                    }
                    render={<Link href={`/dev/${item.value}`} />}
                    onClick={() => setOpenMobile(false)}
                  >
                    {item.label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarSeparator />
          {props.filters && <SidebarGroup>{props.filters}</SidebarGroup>}
          {props.sections
            .filter((section) => section.entries.length)
            .map((section) => (
              <SidebarGroup key={section.label}>
                {section.label && (
                  <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                )}
                <SidebarMenu aria-label="項目">
                  {section.entries.map((entry) => (
                    <SidebarMenuItem key={entry.id}>
                      <SidebarMenuButton
                        ref={
                          props.activeId === entry.id
                            ? selectedButton
                            : undefined
                        }
                        isActive={props.activeId === entry.id}
                        aria-pressed={props.activeId === entry.id}
                        title={entry.name}
                        onClick={() => {
                          props.onEntryChange(entry.slug)
                          setOpenMobile(false)
                        }}
                      >
                        <span>{entry.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ))}
        </SidebarContent>
      </Sidebar>
      <SidebarInset style={{ minWidth: 0 }}>
        <div className="border-b p-2 md:hidden">
          <SidebarTrigger aria-label="データ一覧を開閉" />
        </div>
        <ScrollArea className="h-[calc(100dvh-45px)] md:h-dvh">
          <div
            className="p-4 md:p-8"
            style={{
              maxWidth: 1280,
              marginInline: "auto",
            }}
          >
            {props.children}
          </div>
        </ScrollArea>
      </SidebarInset>
    </>
  )
}
