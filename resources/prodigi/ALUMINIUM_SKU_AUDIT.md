# Prodigi aluminium frame SKU audit

Reviewed: 2026-10-11

Scope: FrameWorthy's currently supported Prodigi markets, Great Britain (`GB`)
and Jersey (`JE`). The live Prodigi standard-shipping price sheets are the
source of truth for orderable size and finish combinations.

## GB and JE orderable range

| SKU | Print size | Metric size | Finishes | GB | JE |
| --- | --- | --- | --- | --- | --- |
| `GLOBAL-FRA-ALU-8X10` | 8 x 10 in | 20 x 25 cm | Black, gold, silver | Yes | Yes |
| `GLOBAL-FRA-ALU-10X10` | 10 x 10 in | 25 x 25 cm | Black, gold, silver | Yes | Yes |
| `GLOBAL-FRA-ALU-18X24` | 18 x 24 in | 45 x 60 cm | Black, gold, silver | Yes | Yes |
| `GLOBAL-FRA-ALU-20X20` | 20 x 20 in | 50 x 50 cm | Black, gold, silver | Yes | Yes |
| `GLOBAL-FRA-ALU-24X36` | 24 x 36 in | 60 x 90 cm | Black, gold, silver | Yes | Yes |

The application therefore needs 5 size SKUs and 15 selectable SKU/finish
variants for aluminium frames in each supported market. Every imported row is
an aluminium frame with EMA 200 gsm fine art paper, no mount, and acrylic /
Perspex glaze.

## Regional SKUs intentionally excluded

Prodigi's live Australia and Singapore sheets also list
`GLOBAL-FRA-ALU-13X19` and `GLOBAL-FRA-ALU-20X28`. Neither SKU appears in the
GB or JE live sheet, so neither belongs in the current FrameWorthy size list.
They should be reconsidered only if FrameWorthy adds a destination whose live
price sheet supplies them.

## Verification rules

- Classify only the `GLOBAL-FRA-ALU-` prefix as the aluminium family.
- Keep exactly the five GB/JE SKUs above in the customer size picker.
- Require black, gold, and silver variants for every listed size.
- Require both `GB` and `JE` market records on every imported variant.
- Resolve the selected size and finish to a real SKU before enabling a quote.

## Sources

- GB live framed-print price sheet: https://prodigipricingpublic.blob.core.windows.net/public/live/prodigi-wall-art-framed-prints-gb.csv
- JE live framed-print price sheet: https://prodigipricingpublic.blob.core.windows.net/public/live/prodigi-wall-art-framed-prints-je.csv
- Prodigi aluminium frame page: https://www.prodigi.com/products/wall-art/framed-prints/aluminium-frames/
