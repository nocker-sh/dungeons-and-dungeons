/**
 * 全件の組み合わせを回す重い検査を有効にするか（`vp run test:full`）。
 * 既定の `vp test run` は、同じ処理を通る組み合わせから代表だけを回す。
 * 品物・敵・段階ごとの画面操作を全件確かめたいとき（作品データや画面の部品を大きく変えたとき）に使う。
 */
export const fullRun = process.env.DND_TEST_FULL === "1"
