# Canonical interface owners

| Capability | Owner | Contract |
| --- | --- | --- |
| Buttons, forms, fields, empty states | `src/components/ui.tsx` | Reuse existing components and semantic CSS classes; explicit pending and error state. |
| Dialog / confirmation | `src/components/dialog.tsx` | Portal, focus trap, inert background, Escape and focus restoration. |
| Select/Listbox | Native select through shared field styles | Operating-system popup ownership is intentional; labels and options use pt-BR. |
| Date | Existing native date inputs | Preserve current platform behavior; the social composer has no date picker. |
| Profile | `src/components/profiles/profile-renderer.tsx` | Own, authenticated and public views share composition with server-filtered data. |
| Post | `src/components/social/post-card.tsx` | Feed, activity and permalink share text, actions and unavailable-original behavior. |
| Composer | `src/components/social/post-composer.tsx` | Shared dialog, explicit audience, comment controls, preserved failed input. |
| Network feedback | `src/components/network/ui.tsx` | Shared request error handling and canonical network behavior. |
| Toast / status | Inline application status and error regions | Feedback is readable, announced and retained near its action. |
| CRUD | Social composer, post actions and comment actions | Mutation completes on server before refresh; edit/delete target ownership is rechecked. |
| Pagination | Server read models and explicit pagination controls | Bounded lists, audience filtering before page selection, meaningful empty state. |
| Scrollbar | Browser native scrollbars | Preserve visible, operable browser scrollbars; document owns page scrolling. |

Social content is plain text. Links use HTTPS and no remote metadata fetching. Restricted posts, hidden comments and blocked authors never enter public client data. Public social views do not grant authenticated interaction privileges.

The scoped browser suite exercises create, edit, delete, follow, reactions, comments, replies, reposts, notifications and blocking. Unit/database tests own audience and concurrency contracts. Static design checks do not establish runtime accessibility or privacy.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | Shared Field and native select | src/components/ui.tsx | Native popup | tests/browser/social.spec.ts |
| Form | Shared Field and social composer | src/components/ui.tsx | Text and HTTPS link | tests/browser/social.spec.ts |
| Scrollbar | Browser native scrollbar | src/app/globals.css | Document and dialog scrolling | tests/browser/social.spec.ts |
| Toast | Inline status and error regions | src/components/social | Success and error | tests/browser/social.spec.ts |
| CRUD | Canonical PostCard | src/components/social/post-card.tsx | Feed, activity, permalink | tests/browser/social.spec.ts |
