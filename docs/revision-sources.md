# September 2026 Revisions

## Official Sources

Verified on 11 September 2026: https://krya.global/academia/

- Logo: the hero asset `Kryacademia-3-1024x1024.png`, saved unchanged as `public/kryacademia-logo.png`.
- Klass catalog: all ten distinct entries under Innovation & Creativity, Technology, and Art & Language. Descriptions are brief English summaries.
- New class illustrations: `Makerset.png` and `Architecture.png` from the official page.
- Activity photographs: the official gallery's `11.jpg`, `33.jpg`, `12.jpg`, `26.jpg`, and `16.jpg`. These supplement the two existing local photographs until Mr. Richard supplies the documentation collection.

## Content Still Awaiting Confirmation

- The official catalog does not assign Online/Onsite modes. Six existing prototype mode assignments are retained provisionally; four added entries say "Mode to confirm". The default All modes view includes every Klass. Confirm all modes and schedules before public release.
- Programs retain their existing content pending discussion with KRYAcademia.
- Agenda entries remain explicitly labeled sample data, dated September 2026. They are not official events or registration links.
- Students (141) and partner schools (7) retain the existing prototype figures. Programs and Klass counts reflect the displayed catalog, not enrollment or delivery totals.
- Documentation links from Mr. Richard, the WTL update workflow, and the proposed Updates section/logo still need final content or scope.
- Inquiry remains a UI prototype: submissions are not transmitted or persisted. Direct email and WhatsApp links are active.

## Implementation Notes

- Montserrat is self-hosted through `@fontsource/montserrat`; Georgia is the retained editorial accent.
- Agenda uses local calendar dates, Monday-first month alignment, a persistent animated selection disc, and a separate today outline. Event/date selection is bidirectional with no popup. All matching events receive the selected style.
- Vertical wheel and touch scrolling remain available over the image-only activity gallery. Reduced-motion visitors receive a native horizontal photo strip.
- Option 2 is intentionally untouched.

## Verification

- Production export and standalone TypeScript check passed.
- Targeted ESLint check passed for the changed interactive components.
- Playwright checked desktop (1440x960), mobile (390x844), and text bounds at 320, 360, 768, 1024, and 1280 pixels.
- Repeated mode/category filtering, calendar selection in both directions, intermediate animation positions, empty dates, month navigation, today marker, keyboard navigation, and conditional institution validation passed.
- Gallery screenshot pixel variation and motion checks passed. Both vertical mouse-wheel and native touchscreen gestures continue scrolling the page.
- Reduced-motion fallback, local images, and contact destinations passed. Calendar helper checks cover leap years, Monday-first alignment, local dates, and multiple events on one date.
