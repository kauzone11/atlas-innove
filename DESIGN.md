---
version: alpha
name: Atlas Innove
description: Calm institutional workspace with floating pill navigation, soft cards and a restrained professional social layer.
colors:
  background: "#ececf0"
  surface: "#ffffff"
  subtle: "#f1f1f4"
  ink: "#111114"
  muted: "#6c6c78"
  border: "#e6e6eb"
  brand: "#ee5a2c"
  action: "#c63e12"
  focus: "#f08a63"
  danger: "#c22c24"
typography:
  sans:
    fontFamily: 'Geist, "Segoe UI", system-ui, -apple-system, sans-serif'
  mono:
    fontFamily: '"Geist Mono", ui-monospace, "Cascadia Mono", Consolas, monospace'
rounded:
  control: "14px"
  card: "24px"
  tile: "20px"
  pill: "999px"
spacing:
  page-max: "1320px"
  control-height: "2.625rem"
components:
  button:
    owner: src/components/ui.tsx
  dialog:
    owner: src/components/dialog.tsx
  shell:
    owner: src/components/app-shell.tsx
  theme:
    owner: src/components/theme-toggle.tsx
  profile:
    owner: src/components/profiles/profile-renderer.tsx
---

# Atlas Innove design context

## Overview

The interface is a calm light workspace: grey canvas, white rounded cards, black pills for everything active and brand orange as the only accent (primary card, observed data, small signals). Light and dark themes are first-class and switch through a sun/moon control with a circular reveal; the choice is stored in `localStorage` and applied before first paint. Product copy is Brazilian Portuguese; source and technical documentation are English.

## Token ownership

`src/app/globals.css` owns the CSS variables for both themes (`:root` and `html[data-theme="dark"]`) and the shared component classes. `tailwind.config.ts` resolves utility colors through those variables, so utilities such as `bg-surface` and `text-slate` follow the theme. Legacy names (`--canvas`, `--slate`, `--line`) alias the current tokens. Brand orange is never small text on white; text uses `--action`. Absence of data is hatched, zero is outlined and pending is dashed.

## Shell

Authenticated pages use a floating header (brand pill, section pill navigation with a sliding black indicator, search/messages/notifications and the account menu), a 84px icon rail with the theme switch and shortcuts, and a floating tab bar plus drawer below 1024px. Global search (`Ctrl/⌘ + K`) queries programs and ventures of the active organization after server-side membership validation, and people through the visibility-filtered directory. Public pages use the same header language with a dark footer card. Authentication uses a split layout with the contour-line signature panel; it never shows invented metrics.

## Shapes, elevation and motion

Controls are pills; text fields use 14px corners; cards 24px; stat tiles 20px; the primary orange card 28px. Cards have no border, only a two-layer shadow (a 1px translucent outline in dark). Clickable cards rise 2px with a lifted shadow. Blocks enter with a 10px blur and 16px rise, staggered by 70ms, and only on navigation. Everything honors `prefers-reduced-motion`.

## Components and states

Reuse the canonical owners in `UX-CONTRACT.md`. Primary buttons express the next action; secondary actions remain restrained. Each asynchronous action exposes pending, success and failure states, prevents duplicate submission and preserves input after failure. Lists use explicit bounded pagination with empty and unavailable states. Destructive actions use an application-owned confirmation dialog.

## Content and accessibility

Following subscribes to content; connecting authorizes a professional relationship and messaging. Activity never replaces verified trajectory. Audience labels explain who can see content. Native buttons and links retain visible keyboard focus; controls use actual Portuguese labels. Dialogs trap focus, support Escape and restore focus. Copy-link feedback uses a live region and an accessible fallback. No interaction depends on hover.

## Professional social surfaces

The social profile, feed, post, activity and people surfaces use the shared tokens in both themes. Posts, the composer and the profile introduction are soft cards; feed tabs are pill segments; the profile cover uses the brand gradient with one restrained geometric detail. `.social-surface` only maps the cream tone to the subtle surface.

Professional identity leads the profile: a brand-gradient cover with one restrained geometric detail, an overlapping avatar, name, headline, location, current visible experience and secondary social counts. Own-profile actions prioritize creating a post and editing the profile; public preview and social settings live in the overflow. Visitor actions follow the configured primary relationship action, with invitations and destructive relationship actions in the overflow. Counts link only to lists belonging to the viewer when those routes exist.

Profile sections use quiet rules and chronological records. Featured and activity content use the canonical PostCard `profile` variant: bounded text, compact media and a permalink action. Each preview has at most three posts; skills and interests expose six topics before a native disclosure. Verified participation retains the existing careful source language.

The feed uses a central measure of 43.5rem and a secondary rail of at most 18rem on wide desktops. Below 1280px the rail is hidden; discovery remains available through the existing navigation and feed empty-state action. The rail contains only profile context and three deterministic people suggestions. Feed ordering remains in the URL. Loading more is explicit.

The post author, professional context and audience form one hierarchy. Body text uses 0.9375rem with 1.7 line height; metadata stays at 0.8125rem. Mobile engagement controls use a deliberate two-column grid. Repost commentary precedes a simpler original-post presentation. Comments load on opening, use avatar-led author rows, and indent replies only one level. Reaction choices are a click/tap disclosure with Escape, outside-click dismissal and keyboard focus return.

Media is owned by `src/components/media`: Avatar, MediaImage, PostImages and PostImagePicker. Images reserve dimensions, show resilient fallbacks, and use server-authorized media URLs with generated responsive variants. Post media opens in the canonical Dialog. The composer treats text, link, audience, comment rules, image order and alt text as draft state; it preserves failed submissions, blocks publishing during upload and confirms discarding changes. Photo controls explicitly report unavailable storage.
