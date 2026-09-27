# PugaAI Health Design System v1.3.1

## Purpose
A shared visual and interaction contract for the PugaAI Health frontend. The system consolidates color, spacing, typography, radius, elevation, focus, status and responsive conventions without changing backend contracts.

## Brand
- Primary: Puga Purple `#4b126f`
- Secondary Purple: `#6d22a1`
- Accent Gold: `#d9a52d`
- Ink: `#1e1825`
- Muted: `#756b7d`
- Line: `#e8e1ec`
- Surface: `#ffffff`
- Soft surface: `#faf8fc`

## Tokens
CSS custom properties are defined in `src/styles.css` under `:root`. JavaScript consumers can use `src/design-system.js`.

### Spacing
`--space-1` 4px · `--space-2` 8px · `--space-3` 12px · `--space-4` 16px · `--space-5` 24px · `--space-6` 32px · `--space-7` 48px

### Radius
`--radius-sm` 8px · `--radius-md` 12px · `--radius-lg` 16px · `--radius-xl` 20px · `--radius-pill` 999px

### Typography
Body 13px, supporting text 10px, labels 9px, page heading 35px, hero heading 52px. Responsive overrides reduce display sizes on smaller screens.

## Components
Use the existing component classes as the canonical frontend vocabulary: `.button`, `.nav-item`, `.topic-card`, `.feature-card`, `.page-header`, `.section-header`, `.modal`, `.status-*`, `.online-chip`, `.privacy-badge`, `.composer`, and `.chat-composer`.

New shared utilities: `.ds-card`, `.ds-chip`, `.ds-status`, `.ds-divider`, `.ds-visually-hidden`, `.ds-field`, and `.ds-skeleton`.

## Accessibility
- All interactive controls must expose a visible `:focus-visible` state.
- Touch targets should be at least 44×44px on mobile.
- Reduced motion must suppress non-essential animations.
- Color must not be the sole carrier of status.
- Sensitive health information must not be exposed in transient UI or notification previews.

## Responsive contract
- Desktop: > 900px
- Tablet: 721–900px
- Mobile: 381–720px
- Small mobile: ≤ 380px

## Do / Don't
- Do use token variables rather than new arbitrary brand colors.
- Do reuse established cards, buttons, status chips and modal patterns.
- Do preserve the purple/gold Puga visual language.
- Don't create a second design language for a new module.
- Don't encode clinical meaning through color alone.
