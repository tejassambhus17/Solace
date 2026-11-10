# Artwork provenance

## Home Quick Actions

`today-quick-breathe.jpg`, `today-quick-reflect.jpg` and `today-quick-focus.jpg` are 312 × 312 optimized crops of an ImageGen artwork sheet based on the written forest, reflective lake and mountain sunrise directions. Sleep reuses `redesign-explore-sleep.jpg`. Both themes use the same images, with separate contrast overlays, icons and labels drawn by the app.

## Habits hub

`habits-sunset-header.jpg` is an optimized 1080 × 360 ImageGen landscape based on the approved botanical sunset reference. Five 764 × 337 garden images show the established Seed, Sprout, Growing, Blooming and Flourishing stages in the same landscape. The first frame shows planted soil and a seed. The shared Garden scene selects its image from the saved stage. All cards, controls and statistics are drawn separately by the app.

## Journal editor header

`journal-editor-window.jpg` is a 1170 × 543 crop of ImageGen artwork based on the approved Journal reference. The arched sunset window, book, lantern and foliage are illustrated. The title, date and controls are rendered separately by the app.

## Launcher icon appearances

The six 1024 × 1024 PNGs in `assets/app-icons/` reuse the original translucent three-petal `petal.png` artwork from Solace’s launcher identity. They share the same petal proportions and use a tightly cropped source with stray edge pixels removed. The light and dark compositions use warm cream `#FAEFE2` and midnight plum `#191321`. The iOS dark variant uses transparent padding for the system background. The iOS tinted variant is grayscale. Android uses matching transparent color and monochrome layers with the same alpha mask, fitted within the 66 dp adaptive icon safe area. Platform masks supply the final shape. The in-app header continues to use `redesign-lotus.png`. [Apple asset catalog guidance](https://developer.apple.com/documentation/xcode/configuring-your-app-icon?changes=_3), [Android adaptive icons](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive)

## Scenic Today, Explore, and Solace redesign

ImageGen recreated the supplied sunrise, lotus pond, woodland companion, violet lake, and ringed lake as matched light and dark artwork. It also generated the guided breath sunrise, four square Explore illustrations, and the transparent lotus mark. The `redesign-*.jpg` files were cropped and compressed for the app. The small chat avatar is a crop of the woodland scene. The art contains no app copy or controls. The screens render text, data, and actions separately.

## Today and Solace reference update

The built-in ImageGen tool recreated the five watercolor petals from the supplied mood strip and the botanical card art from the supplied Today and Solace mockup. The transparent strip was cropped into `mood-okay.png`, `mood-calm.png`, `mood-low.png`, `mood-stressed.png`, and `mood-great.png`. The reference's light pause illustration was recreated as `today-pause-light.jpg`. The reset artwork was packaged as `chat-reset-light.jpg` and `chat-reset-dark.jpg`, with the pale peach and muted charcoal backgrounds leaving room for live type. The app renders its text and controls as React Native elements.

The existing petal.png and botanical.png remain from the initial app build. This pass added moment-light.png and moment-dark.png using the built-in ImageGen tool, not a provider key from the application. No reference mockup was used as a screenshot background. Both assets are 1536×1024 PNGs; UI copy and controls are rendered in React Native. The original outputs are retained in Codex generated_images; project copies live here.

## Light prompt

Use case: stylized-concept. Create a production background artwork for Solace wellness mobile app's featured breathing activity card. Landscape 1536x1024. No text, letters, logos, UI, borders or device. Premium ethereal botanical still life in warm ivory, luminous blush peach and muted sage. A single translucent glowing sculptural flower petal cluster with lilac upper tips and apricot light at its base in the RIGHT THIRD only. Large elegant translucent sage leaves curve from lower right and top right edges. LEFT TWO THIRDS are very quiet smooth pale warm cream (#F0E5D0) negative space for dark forest text. Soft diaphanous layered fabric-like hills at bottom, atmospheric diffuse light, subtle fine real petal vein details, high-end wellness editorial art direction, gentle sophisticated natural material, no gritty grain. Art should feel three dimensional but delicate and restrained. The scene remains light, no dark or black background. This is art to sit behind separately coded controls.

## Dark prompt

Use case: stylized-concept. Production background artwork for Solace wellness mobile app featured breathing activity card in DARK MODE. Landscape 1536x1024. No text letters logos UI borders or device. Premium ethereal botanical still life in very deep forest green (#16251B), muted olive gold, warm ivory light. A single translucent glowing sculptural petal cluster with lavender upper tips and amber light at its base, placed in the RIGHT THIRD only. Elegant long olive botanical leaves curve at top right and lower right edges. LEFT TWO THIRDS very quiet smooth deep forest green negative space for ivory text and coded controls. Subtle translucent flowing olive fabric-like hills at bottom. Atmospheric restrained golden light around flower, fine natural vein detail, high-end editorial botanical art, quiet and luxurious. No stars, glitter, grain or neon. Background must be dark green not pitch black. Art only.
## Today twilight and Explore More

Five optimized JPEGs were generated with built-in ImageGen for the supplied dark Today reference. The live app renders the controls and lettering over the images.

| File | Size | Prompt summary |
|---|---|---|
| `today-twilight-lotus.jpg` | 1100 × 591 | Cinematic violet mountain lake at dusk. Amber sun and pink-peach lotus on the lower right. Keep the top and left quiet for live copy. |
| `today-twilight-stones.jpg` | 1050 × 448 | Twilight lake and three wet river stones stacked on the right. Warm sun, olive leaves, reflected ripples, and dark ink-plum space on the left. |
| `today-explore-guided.jpg` | 432 × 432 | Layered indigo hills with a pale pink twilight sky and shadowed aubergine foreground. |
| `today-explore-toolkit.jpg` | 432 × 432 | Shadowy olive woodland ridges, warm clouds, and a dark pine foreground. |
| `today-explore-checkins.jpg` | 432 × 432 | Rose-brown mountain silhouettes, a small apricot sun, and a dark purple-brown foreground. |

All five prompts specified editorial photographic realism and excluded text, icons, logos, device frames and interface controls.
## Profile mountains

Four optimized 1120 × 373 JPEGs were generated with built-in ImageGen. The app renders the account details, lotus, and copy separately.

| File | Prompt summary |
|---|---|
| `profile-mountains-light.jpg` | Wide golden-hour scene with pale sage wooded ridges, a small sun on the right, and a quiet cream field on the left. |
| `profile-mountains-dark.jpg` | Wide dusk scene with violet mountain layers, a small orange sun on the right, and a dark plum field on the left. |
| `profile-footer-light.jpg` | Low, soft peach mountain ridges beneath a blank warm cream field. |
| `profile-footer-dark.jpg` | Low, subdued aubergine ridges beneath a blank near-black plum field. |

Prompts excluded interface elements, text, people, and foreground objects. The four JPEGs total about 83 KB.

## Voice Companion dusk and dawn

The built-in ImageGen tool created two 852 × 1846 portrait scenes from the approved Voice Companion reference and the existing Solace lotus artwork. The app bundles them as progressive JPEGs. Together they occupy 177 KB. The status, waveform, labels, and controls are rendered separately in React Native.

| File | Prompt summary |
|---|---|
| `voice-companion-night.jpg` | A continuous midnight-plum sky, violet mountain ridges, sunset on the right, and a reflective lake. Center the established peach and lavender lotus at about half the viewport width. Use thin, translucent halo ribbons and keep botanical accents at the outer corners. |
| `voice-companion-dawn.jpg` | Keep the night scene's composition, focal point, and lotus proportions. Use a warm ivory dawn sky, pale sage ridges, peach sunrise, a light reflective lake, and muted botanical accents. |

Both prompts reserved quiet top and bottom space for live UI and excluded text, icons, frames, and interface controls.
The moving voice scene uses a registered pair per theme. `voice-night-plate.jpg` and `voice-dawn-plate.jpg` retain the original full-frame artwork around the petal matte. ImageGen reconstructed only the scenery hidden by the blossom. The composited clean plates keep the mountain and lake framing, baked energy rings, and water reflections fixed.

`voice-night-lotus.png` and `voice-dawn-lotus.png` use the original petal pixels with a transparent feathered edge. Each 460 × 240 crop starts at (195, 770) in the source canvas. The original complete scenes serve as the immediate loading and Reduce Motion artwork.

<details>
<summary>ImageGen prompt set</summary>

Each prompt used the shared paragraph followed by the corresponding appearance paragraph.

**Shared paragraph**

> Create ONLY a full-bleed portrait mobile app BACKGROUND ART PLATE, very tall 9:19.5 composition. Reference image 1 is the approved interface screenshot for exact scene composition. Reference image 2 is the existing Solace lotus artwork as subject identity and visual style reference. Remove all interface from reference 1, reconstruct the environmental artwork behind it. Absolutely NO text, glyphs, microphone, circles used as buttons, waveform bars, menus, navigation, clocks, borders, phone frame, widgets, panels, or UI. The single centered Solace lotus is the same realistic sculpted faceless luminous pink/peach petal identity as reference 2. Lotus across ONLY about 48% of image width (x26%–74%), petal crown at y43%, petal base y54%. Flower must NOT dominate the full width. Calm continuous water underneath with delicate elliptical ripples and muted light reflection fading by y64%. Mountain silhouettes along y39%–48%, small sun at x69%, y40%. A very thin, nearly transparent organically curved violet refraction canopy arches from y31% around the flower to y55%, like thin glass filaments. The refraction arcs are integrated into the scene, with flower visually in front. Absolutely NO thick ribbon, upright hoop, strong artificial ring or bright halo obscuring petals. Dainty leaf silhouettes only clipped in upper-left and far bottom corners. Image remains dark/quiet or cream/quiet above y28% and below y66% to ensure readable overlaid native text and controls. Entire environment fades smoothly into quiet top and bottom, no separate image rectangle, no horizontal seam, no dividing bands. High-end coherent cinematic digital painting, restrained saturation, refined atmospheric perspective. Keep the detailed scene spatially centered exactly as reference 1.

**Dark appearance**

> DARK theme artwork. Preserve the reference's deep midnight aubergine sky and violet lake, dark lavender-gray mountain layers, warm peach and amber sun on the right, radiant apricot and pale lavender petals. The very top and lower third are softly textured near-black plum (#161225), with very subtle aubergine leaf silhouettes. Overall luminosity concentrated in the restrained sunset and lotus. The reference should be recognizable as the same cinematic landscape after the controls are removed.

**Light appearance**

> LIGHT theme artwork. Translate the same composition into a soft misty sunrise. Cream and pale rose upper and lower zones (#FBF0E8) with atmospheric warmth. Distant pale lavender and desaturated sage mountains, light apricot sunrise, muted silvery blue-lavender lake, luminous pink-peach petals. Sage botanical leaf silhouettes at corners, gently translucent. Lake reflects pastel sunrise and lotus, retaining enough depth and localized value contrast to distinguish the flower and its thin translucent lavender canopy. Upper and lower thirds stay warmly light for forest-green typography. Avoid harsh white and dark green forest framing.

</details>

## Wellness goals

ImageGen created four text-free illustrations for the goal picker and first recommendation. The dawn and twilight backgrounds are 910-pixel-wide portrait JPEGs. The two new card illustrations are 720 × 480. Together these four assets occupy about 312 KiB.

| File | ImageGen prompt summary |
|---|---|
| `goals-dawn.jpg` | Portrait mountain sunrise with pink and ivory mist in the middle, soft lavender mountain layers and sunlight near the top, golden leaves in the top right, and lavender and pink flowers at the bottom corners. |
| `goals-twilight.jpg` | Portrait twilight counterpart with violet mountain layers near the top, a faint moon, a botanical sprig, dark plum mist through the middle, and restrained night flowers in the bottom corners. |
| `goals-feelings.jpg` | A recognizable pink flowering tree beside a still lake with soft sunrise, lavender mountains, and a reflection. Landscape thumbnail composition. |
| `goals-sleep.jpg` | A bright crescent in an indigo sky, billowing pink and lavender clouds, and a few restrained stars. Landscape thumbnail composition. |

The cards for calm, habits, focus, and exploration reuse the existing Solace lake lotus, balanced stones, mountain sunrise, and sunlit forest illustrations. All copy, branding, and interactions render in React Native.
