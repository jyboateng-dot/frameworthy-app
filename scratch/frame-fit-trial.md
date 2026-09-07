# Frame Fit Trial

Rollback checkpoint: `732ba9e` (committed and pushed before this trial).
The checkpoint was deployed to Firebase Hosting; this trial must remain uncommitted and local until approved.

Trial edits:
- src/pages/framing/CustomizeFramePage.jsx
- src/pages/checkout/CheckoutPage.jsx
- src/pages/admin/OrderDetailModal.jsx
- src/services/storage.js
- src/utils/itemFormatters.js

Trial additions:
- src/components/framing/FrameFitPanel.jsx
- src/services/frameFitOutput.js
- src/utils/frameFit.js
- src/utils/frameFit.test.js
- src/utils/bestFitOptions.js
- src/utils/bestFitOptions.test.js
- scratch/verify-frame-fit.mjs
- scratch/frame-fit-desktop.png
- scratch/frame-fit-mobile.png
- scratch/frame-fit-review.png
- scratch/frame-fit-position.png
- this file

When reverting, inspect for later user edits and undo only trial changes. Preserve scratch/ig_profile_logo.png and scratch/ig_profile_logo.svg, which predate the trial.

Scope: standard custom single-image paper frames. Presets, generated posters, collages and canvas continue their existing flows. Browser tests mock uploads and do not submit paid orders.
