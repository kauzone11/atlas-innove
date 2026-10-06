---
version: alpha
name: Atlas Innove
description: Institutional innovation workspaces with a restrained professional social layer.
colors:
  background: "#f7f7f4"
  surface: "#ffffff"
  subtle: "#f3f3ef"
  ink: "#1c1c1a"
  muted: "#6d6d68"
  border: "#e5e5df"
  primary: "#bb4518"
  accent: "#f5662d"
  focus: "#f3a17e"
  danger: "#b3261e"
typography:
  sans:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif'
rounded:
  control: "0.5rem"
  panel: "0.875rem"
spacing:
  page-max: "1640px"
  control-height: "2.75rem"
components:
  button:
    owner: src/components/ui.tsx
  dialog:
    owner: src/components/dialog.tsx
  profile:
    owner: src/components/profiles/profile-renderer.tsx
---

# Atlas Innove design context

## Overview

The visual reference is an institutional research workspace: evidence, professional identity and ongoing work receive clear typography and quiet separation. Brazilian innovation program participants and institutional operators share an account but have distinct operational views. Product copy is Brazilian Portuguese; source and technical documentation are English.

The participant profile places current professional activity alongside declared experience and verified trajectory. Social counts remain secondary to content. The monogram and restrained introduction surface carry identity; uploads require real media infrastructure.

The existing curated `/demo` has a separately scoped visual composition and remains unchanged. Do not borrow LinkedIn branding, consumer engagement patterns, giant covers, decorative gradients or popularity scores.

## Token ownership

This document describes the existing runtime, rather than generating it. `src/app/globals.css` owns semantic CSS variables and shared component styles; `tailwind.config.ts` exposes matching utility colors. Primary buttons use `--action`, while `--accent` is a lighter brand accent. The operational font stack is inherited from `body`. Demo-only colors and fonts are not global product tokens.

## Typography and layout

Body text uses the system sans stack at 0.9375rem and line-height 1.5. Page headings use responsive 1.75–2rem text with restrained weight and tracking. Posts preserve line breaks and wrap long URLs. Feed content has a readable central measure inside the existing sidebar shell; it never adds a second application shell. On narrow screens, action groups wrap and the composer uses the existing mobile dialog surface.

## Shapes, elevation and motion

Shared controls use 0.5rem corners, panels 0.875rem. Borders and tonal surfaces establish hierarchy; floating elevation belongs to menus and dialogs. Transitions use the existing short durations and global reduced-motion override. Avoid nested decorative panels around posts.

## Components and states

Reuse the canonical owners in `UX-CONTRACT.md`. Primary buttons express the next action; secondary actions remain restrained. Each asynchronous action exposes pending, success and failure states, prevents duplicate submission and preserves input after failure. Lists use explicit bounded pagination with empty and unavailable states. Destructive actions use an application-owned confirmation dialog.

## Content and accessibility

Following subscribes to content; connecting authorizes a professional relationship and messaging. Activity never replaces verified trajectory. Audience labels explain who can see content. Native buttons and links retain visible keyboard focus; controls use actual Portuguese labels. Dialogs trap focus, support Escape and restore focus. Copy-link feedback uses a live region and an accessible fallback. No interaction depends on hover.
