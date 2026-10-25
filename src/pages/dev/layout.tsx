import { SidebarProvider } from "@/components/ui/sidebar"
import { ArtworkVersionProvider } from "@/components/dev/artwork-version"

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <ArtworkVersionProvider>
      <SidebarProvider>{children}</SidebarProvider>
    </ArtworkVersionProvider>
  )
}
