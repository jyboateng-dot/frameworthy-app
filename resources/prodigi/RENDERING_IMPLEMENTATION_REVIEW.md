# Frame rendering integration review

Reviewed 12 October 2026 from current application files and the remote `master`
source in `jyboateng-dot/frameworthy-app`. This is a fresh source investigation;
the checkout is an extracted archive without `.git`. Remote source was inspected
through GitHub rather than treating the local archive as a fetched branch.
The exact deployed Hosting build identifier was not independently established.

## Production architecture inspected

- `src/pages/framing/CustomizeFramePage.jsx`: four clipped, mitred material
  rails, photographed material, directional profile shading, mats, canvas
  presentation, room placement, physical dimensions, close-up and fullscreen.
- `src/components/framing/FrameFitPanel.jsx`: detailed composition previews
  using the same rail assets and shading.
- `src/utils/frameRail.js`: horizontal/vertical strip resolution, tiling at
  cross-profile scale, opposing-side flips, and profile/finish shading.
- `src/utils/frameRenderProfile.js`: catalogue measurements and conservative
  fallbacks for unmeasured legacy styles.
- `src/utils/ar/frameProfiles.js` and `frameMesh.js`: procedural cross-section
  sweep with mitres, true metre dimensions, mat board, cut bevel and backing.
- `src/utils/ar/arTextures.js`: local photo strips; artwork cover composition;
  sRGB preview preservation. Oblique corner photos are not valid rail textures.
- `src/utils/ar/buildArModel.js`: one mesh/material set feeds both GLB and USDZ,
  bounded object-URL cache, unlit artwork and face textures for exposure parity.
- `src/utils/ar/arScene.js`: Three.js orbit controls, neutral environment,
  directional lighting, WebXR placement and disposal.
- `src/components/framing/ArViewer.jsx`, `arCapabilities.js` and `arModelRelay.js`:
  desktop preview, Safari Quick Look, native mobile handoff, Android Scene
  Viewer and WebXR. No replacement AR launcher was introduced.

Remote files independently inspected on `master`:

| File | GitHub blob SHA |
| --- | --- |
| `src/utils/ar/buildArModel.js` | `7256face4fe33976afa42056b06a95abd2ab5bd9` |
| `src/utils/ar/arTextures.js` | `4807d9acf66517b36e045aeda97b4ea9b893f2ae` |
| `src/pages/framing/CustomizeFramePage.jsx` | `13d88444d99d6b5b5e554cd8ad4b3e68ce98dd2f` |

Recent remote history includes the catalogue addition and earlier detailed
best-fit previews, artwork App Check monitoring, and mobile release hardening.
These integrations were retained, not replaced with a different preview app.

## Implemented

1. A reproducible, alpha-aware asset extraction pipeline creates 20 opaque
   rail pairs covering all 34 framed finishes. The source crop, extraction
   fractions, physical texture aspect and source SHA-256 are recorded in
   `src/data/prodigiRenderAssets.json`. Original supplier assets are untouched.
2. White frames use alpha rather than colour thresholding to distinguish
   white paint from the photo background. The upper straight chevron arm is
   rectified away from its mitre/end. Float frames use only the narrow front
   rim; their broad inner wall is not stretched across the face.
3. Slow studio exposure variations are reduced, then a mirrored extension
   provides matching repeat endpoints. The result is explicitly classified
   as photo-derived, not a measured PBR or seamless albedo scan.
4. The production 2D material resolver and 3D texture candidate resolver now
   share these assets. The chevron border-image path is a fallback when no
   reusable rail exists. Finish thumbnails remain product reference images.
5. Supplier square-faced constructions use a conservative square section
   rather than the legacy decorative deep-profile step. Face, exterior wall
   and inner wall have separate materials. Aluminium side response differs
   from foil-finished wood. The natural floater's inner wall uses the dark
   finish visibly present in its source photograph.
6. Framed canvases have four sides and measured 19mm/38mm depth. Float and Eco
   use a real 5mm gap with a recessed shadow floor; the canvas sits near the
   front of the frame instead of becoming a flat panel at the gap floor.
   Their L-shaped base is 32mm wide and 13mm thick, underneath the narrow
   12mm face and the canvas, following the published section dimensions.
7. Stretched canvas has no frame rails. Black/white edges use solid materials;
   mirror edges reflect adjacent artwork strips; image wrap extends artwork
   edge pixels. Edge treatment participates in the model cache key.
8. Canvas products suppress stale paper mats and generic hanging hardware.
   Mounted supplier print size is treated as the glazing/sight size: the mat
   reduces artwork dimensions rather than increasing the frame's outer size.
   The included snow-white mount resets the preview to white.
9. Room/2D exterior dimensions include the measured floating gap. Supplier
   rails preserve their physical width in close-up and fit views. Cart/order
   thumbnail captures use those same local rails and physical proportions.
10. An absent total depth falls back to legacy rabbet plus backing. JavaScript
    `Number(null) === 0` no longer collapses an unmeasured frame to zero depth.

## Workarounds and limits

- Chevron assets are small and perspective-lit. Rectified strips improve
  consistency but cannot supply absent microscopic detail or exact albedo.
  The mirror repeat may be recognizable at extreme zoom.
- Classic and Aluminium face radii and rear channel details are unmeasured;
  small edge chamfers are visual approximations. Frame dimensions are measured,
  while the full manufacturing cross-section is not a CAD reconstruction.
- Float canvas attachment clearance is unmeasured. The model uses a 2mm front
  setback within the published 53mm frame, with a 38mm canvas body.
- Image-wrap print bleed is not provided by the preview artwork. Extending
  its outer edge is the conservative visual workaround; it does not change
  print-file cropping or claim to be the supplier's final bleed generation.
- Eco reuses the same frame construction and finish assets. Its recycled
  satin weave has no measured texture scan, so no invented weave is applied
  over the customer's image. Artwork remains colour-preserving and unlit.
- Mount board thickness is 2.4mm. The UI's mount reveal remains its existing
  visual convention, since exact window dimensions for every mounted SKU are
  not present in the imported catalogue.
- Supplier hardware is not selectable in this flow. Unknown fittings are
  omitted instead of displaying the unrelated legacy wire/easel selection.
- GLB/USDZ generation and desktop Three.js rendering can be verified locally.
  Actual Quick Look/Scene Viewer camera placement needs a compatible device.

## Verification

- Baseline: 356 tests passed; production build passed before changes.
- Final verification: 361 tests passed, changed rendering utilities passed
  ESLint, and the production build completed. The browser review passed 38
  model configurations: all 35 products, plus mirror, black and white variants
  of the stretched canvas. Image and mirror exports contained distinct edge
  images with the colour-coded review artwork. The added rail assets total
  approximately 220KB on disk.
- Rendering tests exercise all 35 product records, sizes, matching local
  2D/AR sources, float canvas body/reveal, and both model container formats.
- `scripts/prodigi-render-review.html` is a development-only review page served
  by Vite. It uses colour-coded artwork to inspect four edge treatments,
  measured thumbnails and an orbitable 3D model, with downloadable GLB/USDZ.
  Its validation button builds every product and checks embedded textures,
  model dimensions and file headers in a real browser.
- `resources/prodigi/rail-review.jpg` records the reviewed repeated material
  strips. `scripts/build-prodigi-rail-textures.py` rebuilds the material set.

## Primary sources

- https://github.com/jyboateng-dot/frameworthy-app/tree/master/src/utils/ar
- https://www.prodigi.com/products/wall-art/framed-prints/box-frames/
- https://www.prodigi.com/products/wall-art/canvas/framed-canvas/framed-canvas/
- Local original supplier photos, product diagrams and sheets under
  `resources/prodigi/source` and `resources/prodigi/extracted`.
