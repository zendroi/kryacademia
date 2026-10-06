# KRYAcademia Design System

This document describes the visual language and interaction rules used by the KRYAcademia landing page. The source of truth remains `app/globals.css`, `app/revisions.css`, and the components in `app/` and `components/`.

## Product Direction

KRYAcademia is presented as a premium, welcoming 21st-century education center. The interface should feel:

- Curious and optimistic
- Practical and project-based
- Editorial rather than corporate
- Energetic, but calm enough for parents and schools to scan
- Human, photographic, and grounded in real learning activities

The page should communicate learning through doing: ideas become projects, projects become confidence, and confidence becomes meaningful impact.

## Brand Principles

1. **Show the learning.** Prefer real student, coach, classroom, and project photography over decorative graphics or generic illustrations.
2. **Lead with clarity.** Every section needs one clear heading, one short explanation, and an obvious next action where relevant.
3. **Use motion with purpose.** Motion should reveal, guide, or confirm an interaction. It must not delay reading or trap page scrolling.
4. **Keep the editorial contrast.** Use strong navy headings, red accents, warm off-white surfaces, and occasional dark sections to create rhythm.
5. **Respect the approved composition.** Refine motion and responsive behavior without redesigning the page into a card-heavy marketing layout.

## Color Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--page-background` | `#faf9f5` | Main page background and warm canvas |
| `--navy` | `#173051` | Primary headings, navigation, controls |
| `--navy-dark` | `#0b192c` | Footer, dark sections, deep overlays |
| `--red` | `#e8001b` | Primary action, active state, eyebrow accent |
| `--red-glow` | `rgba(232, 0, 27, .4)` | Red interaction glow |
| `--cream` | `#f5f2e9` | FAQ and soft editorial surfaces |
| `--pale` | `#edf3f7` | Soft information panels |
| `--ink` | `#10243f` | Body text and default foreground |
| `--muted` | `#5e6b7c` | Supporting copy and metadata |
| `--line` | `#d8dee5` | Borders, separators, calendar rules |
| `--gold` | `#ffb800` | Small energetic highlights |

Use the tokens above instead of introducing one-off brand colors. White (`#fff`) is reserved for cards, partner-logo surfaces, form surfaces, and text on dark backgrounds.

## Typography

- **Primary family:** Montserrat, loaded from `@fontsource/montserrat`.
- **Display accent:** Georgia or the existing serif fallback for selected italic words such as “Education” and section accents.
- **Eyebrows and metadata:** uppercase, bold, small, red or muted depending on context.
- **Headings:** navy, generous line height, never condensed with negative letter spacing.
- **Body copy:** muted navy-gray, comfortable line height, short paragraphs.
- **Buttons:** uppercase, bold, compact, and readable at mobile widths.

Recommended hierarchy:

| Element | Desktop | Mobile |
| --- | --- | --- |
| Hero title | `76px` | `48px` |
| Section heading | `54px` | `30–36px` |
| Large FAQ heading | `60px` | `44px` |
| Body copy | `16px` | `13–15px` |
| Metadata / labels | `10–12px` | `9–11px` |

Keep letter spacing at `0`. Let wrapping handle long localized text instead of shrinking text until it becomes hard to read.

## Layout

- The navbar is fixed and uses a transparent warm surface until scrolling, then a subtle translucent surface.
- Desktop navigation is visible above `1050px`.
- The StaggeredMenu burger replaces the desktop navigation at `1050px` and below.
- Mobile layouts are tuned for widths from `360px` upward.
- The main content uses wide editorial sections with constrained inner content, not nested cards.
- Cards are reserved for repeated items, program details, coach profiles, and dialogs.
- Use a maximum radius of `8px` for cards and dialogs unless an existing component already defines a circular control.
- Section IDs are part of the public navigation contract: `home`, `klass`, `programs`, `agenda`, `activities`, `partners`, `coaches`, `updates`, `faq`, and `contact`.

## Section Patterns

### Hero

The hero combines the “The 21st Education Center” message with two actions: `Klass` and `See How We Learn`. The right-hand media is an upcoming-agenda carousel only. Its supporting label and metadata must stay synchronized with the active image.

The hero phrase is fixed as:

`INSPIRING → CREATING → DEDICATING`

Keep carousel controls keyboard accessible and announce the active slide through the existing live region.

### Klass Catalog

Klass cards are filterable by mode and category. A card must retain its data when filters change and must expose a details action. Details include mode, teacher team, description, and documentation images. Availability labels should use `Online`, `Onsite`, or the supported combined wording; avoid placeholder text such as “to confirm”.

### Why KRYAcademia

Use the bounded ScrollExpand treatment for the main learning image. The background, vision, and mission copy follows the image. The SDG image is informational only: it is not a button and should remain visually smaller and contained within the section.

### Programs

Program cards open a centered native dialog. The dialog contains a larger image gallery, a complete description, key facts, and a request action. Keep the close control visible, preserve keyboard escape behavior, and make the dialog fit within small mobile viewports.

### Coaches

The section opens with the adapted Skiper30 image entrance and continues into a coach grid. Coach cards represent coaches, not administrative staff. Dummy specialties are acceptable during prototyping, but official profile images must remain mapped to the official team source and stored locally in `public/coaches/`.

### Agenda

The calendar and event list are related controls. Selecting a date highlights the date and brings the matching event detail into view. The selected-day marker should move smoothly, while the current day may use a softer visual marker. On mobile, preserve the readable two-column calendar/event relationship where the existing layout supports it.

### Activities

Activities use the existing infinite-scroll treatment and real documentation imagery. The section is intentionally shorter than a full viewport so users can continue scrolling. Do not add activity titles over the images unless the content request explicitly requires them.

### Partner Institutions

Partner logos run in a LogoLoop. The logo strip uses a clean white surface so white-backed logo assets do not appear as mismatched boxes against the page background. Keep the loop decorative and accessible with an appropriate region label.

### Updates

Updates are a normal horizontal card track, not an independently trapped page scroller. Vertical and diagonal wheel input must continue moving the document. Keep the Updates section in the main navbar.

### FAQ

Use the existing Smooth UI accordion. The first item may be open by default. Questions should be short and written in the active language; answers should be concise and useful to parents, students, and partner schools.

### Contact and Footer

The inquiry form uses Smooth UI controls for dropdowns, animated inputs, checkbox consent, and success notification. Required fields must be validated before the prototype success state appears.

The primary contact links are:

- `mailto:aha@krya.global`
- `https://wa.me/6285111212362` with the label `+62 851-1121-2362 (Cleo)`

Contact links and textual footer links use Skiper40 `Link003`: underline grows on hover and the arrow enters from below. Keep link hit areas readable and do not let the underline stretch across an entire footer column.

## Interaction and Motion

- Use the existing `motion/react` and CSS transitions already installed.
- Use `ScrollExpand` for the Why section and adapted `Skiper30` for Coaches.
- Use `LogoLoop` for partner logos.
- Use native `<dialog>` for program and Klass details where already implemented.
- Use `BasicDropdown` for language and form selection controls.
- Use `Link003` for contact and footer link hover behavior.
- Keep transitions around `200–450ms` with smooth easing.
- Respect `prefers-reduced-motion: reduce`: remove non-essential transforms, looping motion, and animated state changes.
- Do not introduce global smooth scrolling that interferes with wheel input, dialogs, or anchor navigation.

## Responsive Rules

### Desktop (`>1050px`)

- Full navigation and login action are visible.
- Hero uses a two-column composition.
- Klass and program collections use multi-column grids.
- Coach cards use a four-column grid where space allows.

### Tablet (`721–1050px`)

- Navigation collapses into StaggeredMenu.
- Preserve two-column content where it remains readable.
- Keep dialogs bounded by the viewport.

### Mobile (`≤720px`)

- Language picker and burger button are both `44px` high.
- Hero and catalog sections become single-column.
- Coach cards use a compact image/text arrangement.
- Horizontal tracks must not create document-wide horizontal overflow.
- Hide cursor-only decoration on coarse pointers.
- Keep form labels, controls, arrows, and close buttons inside their parent bounds.

## Accessibility

- Use semantic landmarks: `header`, `nav`, `main`, `section`, `aside`, `footer`, and native dialogs.
- Every interactive control needs a visible or screen-reader label.
- Preserve keyboard focus and escape behavior for menus, dropdowns, accordions, and dialogs.
- Use `aria-live` for changing hero agenda details.
- Provide meaningful image alt text for content images; use empty alt text for decorative images.
- Keep visible focus states. Never remove outlines without an equivalent focus treatment.
- Test at `360px`, `390px`, `720px`, `768px`, `1024px`, and `1440px`.

## Localization

The public interface supports English (`en`), Indonesian (`id`), and Mandarin (`zh`). New user-facing text must be added to `app/i18n.tsx` rather than hard-coded inside a section. Check longer translations at mobile widths before finalizing.

## Implementation Guardrails

- Reuse existing components and CSS tokens before adding a dependency.
- Prefer Lucide icons for controls.
- Keep real media in `public/` and use stable local paths.
- Do not commit raw working media from `media/` unless it has been intentionally selected for the product.
- Keep dummy coach specialties clearly separate from official role claims.
- Keep page composition stable during animation refinements.

## Verification

Run the focused checks before delivery:

```powershell
npx next typegen
npx tsc --noEmit
npx eslint app/page.tsx app/i18n.tsx app/mockData.ts components/ui/skiper-ui/skiper30.tsx components/ui/skiper-ui/skiper40.tsx
npx vinext build
node tests/responsive-check.cjs
```

For visual changes, also inspect the affected section at mobile and desktop widths and confirm there is no horizontal overflow or console error.
