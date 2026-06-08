# Diamond Intelligence — Editorial Image Library

Curated assets for the luxury advisory experience. Drop finalized files here; the UI resolves curated paths first and falls back to diamond-tech-suite interim assets until these ship.

## Required assets

| File | Use | Spec |
|------|-----|------|
| `hero-diamond.webp` | Hero verdict — primary emotional anchor | Round brilliant, top/table view. Bright white or soft ivory seamless background. Realistic photography or high-end retouch — not CGI gaming style. Min 1600×1600px. Subtle sparkle, elegant soft shadow optional. |
| `diamond-side-profile.webp` | Notice: Bright with Crisp Sparkle | Side/crown angle, soft studio light, white background. Shows depth and light return. ~1200×1400px. |
| `diamond-light-performance.webp` | Notice: Emphasizes Colorful Flashes | Angle that shows fire/spectral return. White/ivory bg. ~1200×1400px. |
| `diamond-scale-reference.webp` | Notice: Looks Larger for Its Weight | Diamond on hand or next to scale reference. Bright, minimal, editorial — not lifestyle stock. ~1200×1400px. |
| `diamond-compact-profile.webp` | Notice: Appears Slightly Smaller | Slightly elevated angle emphasizing depth. White bg. ~1200×1400px. |
| `diamond-balanced-sparkle.webp` | Notice: Balanced Everyday Sparkle | Top or 3/4 view, even neutral lighting. ~1200×1400px. |
| `diamond-broad-flash.webp` | Notice: Broad, Open Sparkle | Table-forward, open brightness. ~1200×1400px. |
| `diamond-lively-character.webp` | Notice: Lively but Less Conventional | 3/4 view with distinctive contrast pattern. ~1200×1400px. |
| `diamond-neutral-study.webp` | Notice: incomplete / preliminary | Soft illustrative or muted study shot. ~1200×1400px. |
| `diamond-facet-outline.webp` | Performance profile watermark | Very subtle facet outline or light-pattern graphic on transparent/white. Used at ~7% opacity behind radar. SVG or PNG. |

## Style guide

- **Background:** bright white `#faf8f5`–`#ffffff` — never mixed grey studio drops
- **Lighting:** single soft key, no lens flare, no glitter overlays
- **Crop:** generous padding; diamond breathes in frame
- **Consistency:** same stone or matched lighting across set preferred
- **Format:** WebP preferred (PNG acceptable for transparency)

## Interim fallbacks (automatic)

Until curated files exist, components use:

- Hero / most notice slots → `/diamond-tech-suite/diamonds/round.png`
- Spread / scale → `/diamond-tech-suite/finger/finger-light.png`
- Performance watermark → `/diamond-tech-suite/diamonds/round-backing.png`

Toggle imagery: `DI_IMAGERY.enableHeroImagery` (hero only) and `DI_IMAGERY.enableEditorialImagery` (notice slots) in `di-editorial-imagery.ts`.
