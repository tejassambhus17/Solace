# Matched daily-pause artwork

Generated with the **built-in ImageGen tool**, not a CLI or API-key workflow. The image is a decorative production asset; all headings, controls and progress are rendered in React Native.

- New dark asset: `assets/daily-pause-dark-v2.png` — RGB PNG, 1536 × 1024, 1,949,541 bytes.
- Light companion and composition reference: existing `assets/moment-light.png` (retained unchanged).
- Original generated output retained at `C:/Users/Tejas Sambhus/.codex/generated_images/01a1ab93-0efe-76c2-9080-d266c9204f52/exec-eb11a146-fe5e-414b-9903-185d3a68d34e.png`.
- Existing `moment-dark.png`, other artwork, source references and the PDF remain intact.
- Consumers: `PauseArtwork` in `src/ui.tsx`, used by Today and Explore. The helper has a theme-specific readability scrim and hides decorative art from accessibility focus. It uses the installed React Native 0.88 `backgroundImage` style; no new native library was added.

## Exact built-in prompt

> Use case: lighting-weather / precise visual adaptation. Asset type: finished landscape botanical illustration for the daily-pause hero in the Solace wellness mobile app. Input image is the LIGHT version and composition reference, not a UI mockup. Create its equally beautiful DARK counterpart. Preserve the delicate translucent real petal textures, large sculptural blooming flower on the RIGHT, cropped arching leaves at upper/right edges, soft flowing material near the bottom, and calm mostly-empty LEFT 48 percent for live UI text. Transform only the lighting and materials for dark mode: deep neutral graphite/soft black backdrop (#141416 family), softly lit champagne and apricot petal centers, pale blush and faint smoky-lilac tips, leaves in warm stone/bronze grey, subtle directional warm moonlight. The overall scene must stay black/charcoal, NEVER green, olive, teal or an overall purple wash. Retain enough dimensional midtone detail to feel inviting and alive, not a black void. The left half must be consistently quiet dark charcoal with no bright marks, strong highlights, stems or leaf silhouettes behind typography. Composition should survive center-cropping to a mobile card roughly 1.45:1 aspect. Sophisticated tactile botanical still life, close-up, serene editorial craft, luminous natural translucency, gentle ambient shadows. No text, letters, UI, buttons, borders, gradient bands, logos, people, watermark, neon glow, or tiny floating ornaments. Landscape 3:2.

The reference was provided through `referenced_image_paths` after local inspection. `transparent_background` was false. The generated file was copied unchanged into the project. Screenshot contact sheets crop browser padding only and are separate verification artifacts, not generated app assets.
