import { defineConfig } from "void/config"

export default defineConfig({
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
      { rel: "apple-touch-icon", href: "/tmp/icons/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", href: "/tmp/icons/icon-192.png" },
    ],
  },
  routing: {
    // 公開URLを保ち、コンポーネントは名前と一致するファイルへ置く。
    // 開発アプリのホスト全体が開発用なので、URLに /dev を付けない。ページは (tools) にまとめる。
    rewrites: {
      "/previews": "/previews/preview-list",
      "/previews/conversations": "/previews/conversation-frame",
      "/previews/:slug": "/previews/:slug/preview-page",
      "/layouts": "/layouts-page",
      "/save": "/save-page",
      "/view": "/view-page",
      "/preview-frame": "/preview-frame-page",
      "/play/:scene": "/play/:scene/play-page",
    },
    // 書き換えは静的ファイルより先に効く。資料の一覧のような汎用の形は、
    // 画像や manifest.json を横取りしないよう、何にも当たらないときだけ使う。
    fallbacks: {
      "/:category/:entry": "/:category/:entry/entry-page",
      "/:category": "/:category/category-index",
    },
    redirects: {
      // スタジオにゲームのトップはない。開発画面から始める。
      "/": "/characters",
      "/goods": "/weapons",
      "/studio": "/studio/battle",
    },
  },
})
