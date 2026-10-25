import { useEffect, useRef, type ReactNode } from "react"
import { Link } from "@void/react"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { devCategories, type DevCategory } from "@/lib/dev/categories"
import { DevToolNavigation } from "./navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useArtworkVersion } from "./artwork-version"
import { Button } from "@/components/ui/button"

type MenuEntry = { id: string; slug: string; name: string }

/** キャラ・品物・会話・エフェクトで同じ一覧と詳細の枠を使う。 */
export function DevDataLayout({
  category,
  sections,
  activeId,
  onEntryChange,
  filters,
  children,
}: {
  category: DevCategory
  sections: { label: string; entries: readonly MenuEntry[] }[]
  activeId?: string
  onEntryChange: (slug: string) => void
  filters?: ReactNode
  children: ReactNode
}) {
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
  }, [category, activeId, isMobile])

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
                    isActive={category === item.value}
                    aria-current={category === item.value ? "page" : undefined}
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
          {filters && <SidebarGroup>{filters}</SidebarGroup>}
          {sections
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
                        ref={activeId === entry.id ? selectedButton : undefined}
                        isActive={activeId === entry.id}
                        aria-pressed={activeId === entry.id}
                        title={entry.name}
                        onClick={() => {
                          onEntryChange(entry.slug)
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
            {children}
          </div>
        </ScrollArea>
      </SidebarInset>
    </>
  )
}
