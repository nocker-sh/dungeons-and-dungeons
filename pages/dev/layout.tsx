import { SidebarProvider } from "@/client/components/ui/sidebar-provider"
import { ArtworkVersionProvider } from "@/client/components/dev/artwork-version-provider"

type Props = { children: React.ReactNode }

export default function Layout(props: Props) {
  return (
    <ArtworkVersionProvider>
      <SidebarProvider>{props.children}</SidebarProvider>
    </ArtworkVersionProvider>
  )
}
