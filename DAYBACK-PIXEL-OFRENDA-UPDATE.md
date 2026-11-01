# DAYBACK — Pixel-art ofrenda interface refinement

## What changed
- Reworked the visual language toward a 2D pixel-art Día de Muertos ofrenda: stronger pixel-like borders, saturated papel-picado colours, gothic dark backdrop, stepped altar shelves, and warm marigold/candle tones.
- Restored real research-result thumbnails to the framed altar keepsakes and lower-shelf objects instead of rendering platform icons as the primary visual.
- Added a large central archive photograph. It uses a real thumbnail returned with the research result (preferring an image from the event phase); selecting it opens the corresponding source in the existing fragment viewer.
- Kept the expandable archive, source links, chapter filters, and verification labels intact.
- Added the supplied visual reference to `inspo/ofrenda-pixel-art-reference.png`.

## Image integrity
The central photograph and keepsake images are source thumbnails returned by the research integrations. The UI does not fabricate a historical photograph. If the research run returns no image thumbnails, the central frame falls back to the event title and memorial treatment.

## Verification
- Reviewed the updated TSX structure and CSS selectors.
- A full TypeScript/Next.js build could not be completed in this environment: dependency installation timed out, and the global TypeScript check could not resolve the project's Node type definitions.
