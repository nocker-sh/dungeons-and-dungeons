import { SidebarProvider } from "@/development/ui/sidebar-provider"
import { ArtworkVersionProvider } from "@/development/components/artwork-version-provider"

type Props = { children: React.ReactNode }

export default function Layout(props: Props) {
  return (
    <ArtworkVersionProvider>
      <SidebarProvider>{props.children}</SidebarProvider>
    </ArtworkVersionProvider>
  )
}
