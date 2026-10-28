/**
 * 画面の決まった形（枠・アイコンのSVG）。誰がどの絵か・名前・台詞などの中身は
 * content/looks/ が JSON から組み立てる。
 */

/** 役割ごとの枠の形と背景。形は手で崩した多角形。 */
export const ROLES: Record<
  string,
  { shape: string; edge: string; base: string; art: string }
> = {
  tank: {
    shape:
      "polygon(2% 12%, 10% 0, 46% 5%, 90% 0, 100% 16%, 97% 72%, 88% 100%, 42% 95%, 9% 100%, 0 64%)",
    edge: "#eeebe3",
    base: "#1a2233",
    art: `<svg viewBox="0 0 200 100" preserveAspectRatio="none"><path d="M70 8 L130 8 L128 60 Q100 90 72 60Z" fill="#eeebe3" opacity=".14"/><path d="M84 16 L116 16 L115 52 Q100 70 85 52Z" fill="#1b2030" opacity=".6"/><g fill="#dcdee5" opacity=".35">${[12, 32, 52, 72, 92].map((y) => `<circle cx="7" cy="${y}" r="2.2"/><circle cx="193" cy="${y}" r="2.2"/>`).join("")}</g><rect x="0" y="40" width="200" height="6" fill="#12141c" opacity=".35"/><rect x="0" y="72" width="200" height="4" fill="#12141c" opacity=".3"/></svg>`,
  },
  damage: {
    shape:
      "polygon(0 22%, 20% 0, 52% 9%, 100% 0, 91% 42%, 100% 78%, 68% 100%, 32% 90%, 5% 100%, 9% 56%)",
    edge: "#eeebe3",
    base: "#2a1217",
    art: `<svg viewBox="0 0 200 100" preserveAspectRatio="none"><g stroke="#eeebe3" stroke-linecap="butt" fill="none" opacity=".18"><path d="M40 -5 L120 105" stroke-width="7"/><path d="M70 -5 L150 105" stroke-width="3"/><path d="M95 -5 L175 105" stroke-width="10"/></g><path d="M150 12 L186 48 L180 54 L144 18Z M186 12 L150 48 L156 54 L192 18Z" fill="#dcdee5" opacity=".25"/></svg>`,
  },
  summoner: {
    shape:
      "polygon(0 14%, 16% 0, 48% 6%, 78% 0, 100% 10%, 96% 58%, 100% 100%, 54% 94%, 18% 100%, 3% 70%)",
    edge: "#eeebe3",
    base: "#b8901c",
    art: `<svg viewBox="0 0 200 100" preserveAspectRatio="none"><g fill="none" stroke="#0b0c12" stroke-opacity=".28"><polygon points="150,8 186,70 114,70" stroke-width="3"/><polygon points="150,92 186,30 114,30" stroke-width="3"/></g><path d="M30 10 L60 40 M60 10 L30 40" stroke="#0b0c12" stroke-opacity=".2" stroke-width="6"/><path d="M40 60 L64 66 L62 88 L40 96 L18 88 L16 66Z" fill="#0b0c12" fill-opacity=".18"/></svg>`,
  },
  healer: {
    shape:
      "polygon(5% 6%, 28% 0, 68% 4%, 97% 0, 100% 44%, 95% 100%, 62% 95%, 22% 100%, 0 82%, 3% 42%)",
    edge: "#eeebe3",
    base: "#14231d",
    art: `<svg viewBox="0 0 200 100" preserveAspectRatio="none"><defs><radialGradient id="hg" cx=".75" cy=".4" r=".6"><stop offset="0" stop-color="#eeebe3" stop-opacity=".16"/><stop offset="1" stop-color="#eeebe3" stop-opacity="0"/></radialGradient></defs><rect width="200" height="100" fill="url(#hg)"/><path d="M150 20 H162 V34 H176 V46 H162 V60 H150 V46 H136 V34 H150Z" fill="#eeebe3" opacity=".2"/><g fill="#dcdee5" opacity=".5">${[
      [30, 20],
      [60, 70],
      [110, 30],
      [185, 80],
      [90, 85],
    ]
      .map(
        ([x, y]) =>
          `<rect x="${x}" y="${y}" width="5" height="5" transform="rotate(45 ${x} ${y})"/>`
      )
      .join("")}</g></svg>`,
  },
}

export const EVENT_ICONS: Record<string, string> = {
  discovery: "treasure",
  battle: `<svg viewBox="0 0 40 40" fill="#eeebe3"><path d="M6 4 L22 20 L20 22 L4 6Z M34 4 L18 20 L20 22 L36 6Z"/><path d="M12 22 L18 28 L14 32 L8 26Z M28 22 L22 28 L26 32 L32 26Z"/><rect x="5" y="30" width="7" height="4" transform="rotate(-45 8 32)"/><rect x="28" y="30" width="7" height="4" transform="rotate(45 32 32)"/></svg>`,
  treasure: `<svg viewBox="0 0 40 40" fill="#eeebe3"><path d="M6 16 Q20 4 34 16 V20 H6Z"/><rect x="6" y="22" width="28" height="12"/><rect x="17" y="18" width="6" height="8" fill="#0b0c12"/><rect x="18.5" y="20" width="3" height="4" fill="#eeebe3"/></svg>`,
  trap: `<svg viewBox="0 0 40 40" fill="#eeebe3"><path d="M4 34 L10 14 L14 26 L20 6 L26 26 L30 14 L36 34Z"/><path d="M8 22 L14 26 M32 22 L26 26" stroke="#0b0c12" stroke-width="2"/></svg>`,
  midboss: `<svg viewBox="0 0 40 40" fill="#eeebe3"><path d="M6 10 L13 16 L20 6 L27 16 L34 10 L31 30 H9Z"/><path d="M9 33 H31 V36 H9Z"/><circle cx="20" cy="22" r="3.5" fill="#6b1723"/></svg>`,
  boss: `<svg viewBox="0 0 40 40" fill="#eeebe3"><path d="M20 4 C10 4 5 11 5 18 C5 23 8 26 11 27 V33 H29 V27 C32 26 35 23 35 18 C35 11 30 4 20 4Z"/><circle cx="14" cy="18" r="4.5" fill="#6b1723"/><circle cx="26" cy="18" r="4.5" fill="#6b1723"/><path d="M18 24 L20 21 L22 24Z" fill="#6b1723"/><rect x="15" y="29" width="2" height="4" fill="#6b1723"/><rect x="19" y="29" width="2" height="4" fill="#6b1723"/><rect x="23" y="29" width="2" height="4" fill="#6b1723"/></svg>`,
}

export const EVENT_NAMES: Record<string, string> = {
  discovery: "発見",
  battle: "戦闘",
  treasure: "宝箱",
  trap: "罠",
  midboss: "中ボス",
  boss: "ボス",
}

/** 絵がまだ無い敵の仮の影絵。 */
export function foeSvg(glow: string) {
  return `<svg viewBox="0 0 400 420" style="width:100%;height:100%;display:block;overflow:visible">
    <defs><radialGradient id="fa" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="${glow}" stop-opacity=".7"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
    <pattern id="fd" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="#eeebe3" opacity=".25"/></pattern></defs>
    <ellipse cx="200" cy="250" rx="210" ry="190" fill="url(#fa)"/>
    <path d="M200 40 L262 70 L300 40 L292 120 L340 150 L352 250 L322 250 L330 360 L260 330 L240 410 L200 360 L160 410 L140 330 L70 360 L78 250 L48 250 L60 150 L108 120 L100 40 L138 70Z" fill="#0b0c12" stroke="#eeebe3" stroke-width="6" stroke-linejoin="miter"/>
    <path d="M200 40 L262 70 L300 40 L292 120 L340 150 L352 250 L322 250 L330 360 L260 330 L240 410 L200 360 L160 410 L140 330 L70 360 L78 250 L48 250 L60 150 L108 120 L100 40 L138 70Z" fill="url(#fd)"/>
    <path d="M140 160 L190 178 L146 190Z M260 160 L210 178 L254 190Z" fill="${glow}"/>
    <path d="M150 240 L170 262 L186 240 L200 262 L214 240 L230 262 L250 240" fill="none" stroke="#eeebe3" stroke-width="7" stroke-linejoin="miter"/>
  </svg>`
}

export const HIT_SFX = [
  "BAM!",
  "POW!",
  "WHAM!",
  "SLASH!",
  "CRACK!",
  "THWACK!",
  "SMASH!",
]
