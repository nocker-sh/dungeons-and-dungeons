import { defineConfig } from "void/config"

export default defineConfig({
  sourceDir: "src",
  // ゲームはブラウザだけで動くので、各ページを静的なHTMLに書き出す
  output: "static",
  head: {
    title: "ダンジョンズ & ダンジョンズ！",
    htmlAttrs: { lang: "ja", "data-theme": "dark" },
    bodyAttrs: {
      class:
        "h-dvh overflow-hidden overscroll-none antialiased [-webkit-tap-highlight-color:transparent]",
    },
    meta: [
      { charset: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      // ホームに追加（PWA）
      { name: "theme-color", content: "#000000" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "D&D" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
    ],
    link: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Reggae+One&display=swap",
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", href: "/icon-192.png" },
    ],
  },
  routing: {
    redirects: {
      "/dev": "/dev/characters",
      "/dev/goods": "/dev/weapons",
      "/dev/studio": "/dev/studio/battle",
    },
  },
  worker: { compatibility_date: "2026-09-20" },
  cloudflare: {
    name: "dungeons-and-dungeons",
    account_id: "5b7537bae3233beb7ebbcdb7f47c3ec0",
    routes: [{ pattern: "dnd.nocker.sh", custom_domain: true }],
  },
})
