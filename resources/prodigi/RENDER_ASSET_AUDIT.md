# Prodigi render asset audit

Reviewed 2026-10-11 against Prodigi's public product pages, product sheets,
downloadable photography, blank compositing files, chevrons, swatches, and ICC
profiles. Raw source material is intentionally stored outside `public/`. A
reviewed 54-image subset is copied to `public/prodigi/` by
`scripts/prepare-prodigi-app-assets.py`; the source archive itself is not
shipped in the application bundle.

## Collection

- 80 downloaded source files, each recorded with its source URL and SHA-256 in
  `manifest.json`.
- 72 useful files extracted from six official ZIP archives. macOS metadata in
  the archives is ignored by `inventory.json`.
- 152 inventoried files in total, including dimensions, alpha-channel status,
  byte size, and SHA-256.
- Seven official product sheets and nine ICC colour profiles.
- Four complete photography bundles: Classic Frames, Box Frames, Float Framed
  Canvas, and Stretched Canvas.
- Two blank-compositing bundles: Classic Frames and Aluminium Frames.
- Web-only detail photography and all available finish chevrons for Aluminium,
  Classic Framed Canvas, and Eco Framed Canvas.

Prodigi describes its downloads area as “Free-to-use assets and marketing
materials.” Preserve the manifest attribution. Confirm whether publishing
derived PBR textures is covered before distributing them outside FrameWorthy.

## Product review

| Frame family | SKU prefix / app family | Confirmed construction | Useful assets now held | Remaining render gap |
| --- | --- | --- | --- | --- |
| Classic framed print | `GLOBAL-CFP`; `classic` and mounted/Motheye variants | 20 mm face, 22 mm wall depth, 5 mm rebate width, 17 mm rebate depth; 2.4 mm optional mount; 8 finishes; Perspex, float glass, or Motheye | Full 2,000 px photo bundle, all chevrons, all blank composites, back view, mount references, flat swatches, product sheet | No orthographic cross-section or seamless rail/PBR maps. Regional wood/foil construction differs. |
| Box framed print | `GLOBAL-BOX`, `GLOBAL-BOXM`, plus Motheye variants | 20 mm face, 33 mm wall depth, 8 mm rebate width, 30 mm rebate depth; 2.4 mm optional mount; black, white, natural | Full 2,000 px bundle, labelled cross-section, front/profile/corner views, mounts, three current chevrons, product sheet | No seamless rail/PBR maps. The downloaded brown chevron is legacy/reference-only and is not a current selectable finish. |
| Aluminium framed print | `GLOBAL-FRA-ALU`; `aluminium` | 10 mm face, 19 mm wall depth, 12 mm rebate depth; black, silver, gold; shatterproof Perspex | Three blank composites, 1,000–2,000 px product/detail views, three transparent chevrons, product sheet | No cross-section, full photo bundle, rear/hanger view, or seamless metal/PBR maps. |
| Float framed canvas | `GLOBAL-FRA-CAN`; `canvas-float` | 38 mm canvas; 12 mm frame face, 5 mm reveal, 32 mm base, 53 mm wall depth, 40 mm rebate; 6 finishes | Full 2,000 px front/angle/profile/rear bundle, labelled cross-section, black/white/brown high-res chevrons, all six transparent chevrons, product sheet | Gold, silver, and natural lack high-res profile photography. No seamless rail/PBR maps. |
| Classic framed canvas | `GLOBAL-FRA-SLIMCAN`; `canvas-classic` | 19 mm stretched canvas inside the same 20 × 22 mm classic frame, with 5 × 17 mm rebate; 8 finishes | 1,000–3,793 px corner/product/group views, classic-frame chevrons and finish references, product sheet | No dedicated bundle, cross-section, rear view, or blank composite. Canvas-to-rebate overlap is not dimensioned. |
| Eco float framed canvas | `ECO-FRA-CAN`; `canvas-eco` | 38 mm, 330 gsm recycled satin canvas; same 12 mm face, 5 mm reveal, 32 mm base, 53 mm wall depth, and 40 mm rebate; 6 finishes | Three 1,000 px product/profile/detail views, six transparent chevrons, finish-group image, product sheet | No photo bundle, rear view, blank composite, or exact eco-canvas weave texture. Float-frame geometry can be shared; canvas material cannot. |
| Stretched canvas | `GLOBAL-CAN`; `stretched-canvas` | 38 mm kiln-dried pine stretcher bar with curved profile; image, mirror, black, and white wraps | Full 2,000 px bundle, canvas texture photograph, all four wrap references, blank composite, corner view, product sheet | Only the 38 mm depth is dimensioned. Bar width, curve radius, back bevel, corner fold, and tension geometry require measurement or supplier confirmation. The texture photo is perspective-lit rather than a seamless material tile. |

## What can be reused safely

The 437 size SKUs do not need separate geometry. The current evidence supports
four shared construction meshes:

1. Classic wood profile — Classic framed print and Classic framed canvas.
2. Box wood profile — no-mount, mounted, Perspex, and Motheye variants.
3. Float canvas profile — standard and Eco framed canvas, with distinct canvas
   materials.
4. Stretched canvas profile — all sizes and four edge treatments.

Aluminium requires a fifth profile when its SKU range is added. Mount and glaze
choices are layers within Classic/Box rather than separate outer-frame meshes.

## Asset fitness by renderer

### 2D

Blank composites and transparent chevrons are immediately useful. High-res
corner and profile images improve product-detail views. They should not be
stretched directly into four frame rails: the source photos contain perspective,
studio lighting, mitres, and backgrounds. Derive rectified horizontal and
vertical rails first.

### 3D and AR

The two labelled cross-sections provide reliable Box and Float Canvas geometry.
Classic and Aluminium can use their published measurements with conservative
square/flat profiles, but the exact face relief remains unmeasured. Stretched
Canvas still lacks enough measurements for an accurate curved stretcher-bar
cross-section.

None of the supplied images is a complete PBR material set. Derive albedo from
the cleanest chevron/profile photography, then review roughness, metalness, and
normal maps by material class. Gold/silver foil and aluminium must use different
metal responses; painted wood, laminated wood, and natural wood must remain
separate materials.

### Artwork colour

The nine ICC profiles are useful for print-file preparation and soft-proofing,
not for browser frame materials. Keep browser previews in sRGB. Apply an ICC
profile only during an explicit print-output conversion step.

## Renderer implementation status

- Classic, Box, Aluminium, Classic Canvas, Float Canvas, and Eco Canvas now
  carry their published face, rebate, and total-depth measurements into the
  shared 2D/3D/AR render profile resolver.
- Float and Eco Canvas share one L-shaped procedural rail plus a measured 5 mm
  reveal; size changes scale the same profile rather than selecting another
  model.
- Stretched Canvas has a dedicated rail-free 38 mm canvas body shared by every
  size and edge treatment.
- Catalogue colour values are normalized to the visual records, including
  gold/silver and light/dark grey, so selections no longer fall back to the
  generic canvas.
- Product views, finish references, and section diagrams load from the audited
  local subset instead of hotlinking at runtime.

## Outstanding supplier follow-ups

1. Ask Prodigi for an Aluminium cross-section and rear/hanger view.
2. Ask for the Stretched Canvas stretcher-bar width, front curve/radius, rear
   bevel, and corner construction.
3. Ask whether high-resolution Gold, Silver, and Natural Float Canvas profile
   photos exist.
4. Confirm reuse rights for derived internal PBR textures. The downloaded
   marketing and blank assets are explicitly presented for reuse, but the site
   does not separately describe derived 3D materials.
5. Treat the Box brown photography as legacy reference and exclude it from the
   customer selector unless Prodigi adds Brown as an orderable attribute.

## Official pages

- https://www.prodigi.com/products/wall-art/framed-prints/classic-frames/
- https://www.prodigi.com/products/wall-art/framed-prints/box-frames/
- https://www.prodigi.com/products/wall-art/framed-prints/aluminium-frames/
- https://www.prodigi.com/products/wall-art/canvas/framed-canvas/framed-canvas/
- https://www.prodigi.com/products/wall-art/canvas/framed-canvas/classic-framed-canvas/
- https://www.prodigi.com/products/wall-art/canvas/framed-canvas/eco-framed-canvas/
- https://www.prodigi.com/products/wall-art/canvas/stretched-canvas/stretched-canvas/
- https://www.prodigi.com/downloads/
