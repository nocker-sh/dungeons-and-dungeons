import { defineConfig, mergeConfig } from "vite-plus"
import sharedConfig from "./vite.shared"

export default defineConfig(() => mergeConfig(sharedConfig, {}))
