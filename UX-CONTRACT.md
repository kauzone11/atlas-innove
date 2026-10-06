# Canonical interface owners

| Capability | Owner | Contract |
| --- | --- | --- |
| Buttons, forms, fields, empty states | `src/components/ui.tsx` | Reuse existing components and semantic CSS classes; explicit pending and error state. |
| Dialog / confirmation | `src/components/dialog.tsx` | Portal, focus trap, inert background, Escape and focus restoration. |
| Select/Listbox | Native select through shared field styles | Operating-system popup ownership is intentional; labels and options use pt-BR. |
| Date | Existing native date inputs | Preserve current platform behavior; the social composer has no date picker. |
| Profile | `src/components/profiles/profile-renderer.tsx` | Own, authenticated and public views share composition with server-filtered data. |
| Avatar | `src/components/media/avatar.tsx` | One responsive image and monogram fallback across profile, feed, comments, people, messages, notifications and account controls. |
| Media image / viewer | `src/components/media/media-image.tsx`, `post-images.tsx` | Authorized responsive derivatives, explicit dimensions, lazy loading, unavailable fallback; shared Dialog owns Escape, focus trap and restoration. |
| Media upload / crop | `src/components/media/profile-media-editor.tsx`, `post-image-picker.tsx` | Real server upload, bounded file selection, retained failed input, sequential image processing feedback, keyboard crop/reorder controls and explicit unavailable state. |
| Post | `src/components/social/post-card.tsx` | Feed, activity and permalink share text, actions and unavailable-original behavior. |
| Composer | `src/components/social/post-composer.tsx` | Shared dialog, explicit audience, comment controls, preserved failed input. |
| Network feedback | `src/components/network/ui.tsx` | Shared request error handling and canonical network behavior. |
| Toast / status | Inline application status and error regions | Feedback is readable, announced and retained near its action. |
| CRUD | Social composer, post actions and comment actions | Mutation completes on server before refresh; edit/delete target ownership is rechecked. |
| Pagination | Server read models and explicit pagination controls | Bounded lists, audience filtering before page selection, meaningful empty state. |
| Scrollbar | Browser native scrollbars | Preserve visible, operable browser scrollbars; document owns page scrolling. |

Social content is plain text. Links use HTTPS and no remote metadata fetching. Restricted posts, hidden comments and blocked authors never enter public client data. Public social views do not grant authenticated interaction privileges.

The profile editor owns avatar and cover changes. Crop preview uses normalized coordinates and native range controls; the server performs the trusted crop. Only ready media can be attached. A publication is created after all selected uploads finish. Failed uploads preserve text and already prepared images. Removing an existing post image takes effect when edits are saved; closing a changed composer requires a discard decision. Images have no permanently public object URLs, including images currently visible to anonymous visitors.

The participant navigation retains Início and Minha trajetória as separate destinations. Messages and notifications use the top bar; saved publications and profile settings are account utilities. Mobile uses the established navigation drawer. Profile activity and featured items use compact post previews; feed and permalink retain full discussion controls.

The scoped browser suite exercises create, edit, delete, follow, reactions, comments, replies, reposts, notifications and blocking. Unit/database tests own audience and concurrency contracts. Static design checks do not establish runtime accessibility or privacy.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | Shared Field and native select | src/components/ui.tsx | Native popup | tests/browser/social.spec.ts |
| Form | Shared Field and social composer | src/components/ui.tsx | Text and HTTPS link | tests/browser/social.spec.ts |
| Scrollbar | Browser native scrollbar | src/app/globals.css | Document and dialog scrolling | tests/browser/social.spec.ts |
| Toast | Inline status and error regions | src/components/social | Success and error | tests/browser/social.spec.ts |
| CRUD | Canonical PostCard | src/components/social/post-card.tsx | Feed, activity, permalink | tests/browser/social.spec.ts |
