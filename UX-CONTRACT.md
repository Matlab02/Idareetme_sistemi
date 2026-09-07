# UX Contract

## Product context

- Audience: AzPlom superadmin və admin istifadəçiləri
- Primary jobs: sorğu, qiymət, qaimə, anbar, sənəd, hesabat və audit idarəetməsi
- Target market: Azərbaycan
- Active locale: `az-AZ`
- Timezone/calendar: `Asia/Baku`, Qriqorian
- Accessibility target: WCAG 2.2 AA

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Permission model | `auth-gate.js`, `superadmin-users.js` | Verified implementation | 2026-09-01 |
| Data lifecycle | `supadmin.html`, feature modules, `api/` | Verified implementation | 2026-09-01 |
| Deletion / retention | `request-documents.js`, `log-retention.js` | Verified implementation | 2026-09-01 |

## Visual contract

- Project design: `DESIGN.md`
- Token ownership: existing runtime CSS is canonical
- Runtime source: `design-system.css`, with legacy compatibility in `modern-ui.css`
- Supported themes: light and dark

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native select styled globally | UX contract | native | keyboard + popup |
| Form | `.field` + feature validation | UX contract | create / edit | browser flow |
| Scrollbar | `design-system.css` global rules | DESIGN.md | stable gutter where needed | computed style |
| Toast | global `.toast` + `toast()` | UX contract | success / warning / info / error | live region audit |
| CRUD | feature modules + `render()` | UX contract | return to owner / detail stay | browser flow |
| ERP istifadəçiləri və To-do alıcıları | `superadmin-users.js` + `erp_user_profiles` | Superadmin “İstifadəçilər” siyahısı | Superadmin / Admin | browser flow + server list equality |
| To-do | `todo-module.js` + shared `.field`, toast and modal | UX contract | open / completed filters | browser flow |

## Component behavior

| Component | Default | Hover | Focus | Active | Disabled | Busy | Error |
|---|---|---|---|---|---|---|---|
| Button | semantic tone | lifted tone | blue ring | pressed | muted | stable size | inline feedback |
| Icon button | 42px target | tonal surface | blue ring | pressed | muted | stable size | tooltip/label |
| Input | white surface | border emphasis | blue ring | n/a | muted | stable | red ring + text |
| Search | clear button | border emphasis | blue ring | n/a | muted | stable | inline |
| Textarea | resize none | border emphasis | blue ring | n/a | muted | stable | red ring + text |
| Table/list | sticky header | row tint | control focus | selected tint | n/a | stable panel | inline state row |

## Dataset navigation

- Tables own horizontal overflow; the document remains the vertical scroller.
- Search, folder and status filters preserve the selected business view.
- Empty/no-result/error states remain inside the table footprint and include a next action when available.

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome |
|---|---|---|---|---|---|---|
| Create | primary create button | control disabled/busy | owning list | toast | form values preserved | created row/list heading |
| Edit | edit/save button | stable busy control | detail or owning list | toast | form preserved | trigger/heading |
| Soft-delete | danger action | confirmation | owning list | toast | cancel returns unchanged | prior safe trigger/list |
| Search | input, 300ms for remote | stable results | same list | result count | clear button | search input |
| Upload | file picker/drop zone | per-file progress | same entity | toast + document row | retry/remove | upload trigger |
| Əlavə sorğu sənədi | “Əlavə sənəd yüklə” multi-file picker | bölmə passivləşir | eyni sorğu sənədləri | yüklənən fayl sayı və endirmə sətri | mövcud fayllar qalır, yenidən seçilir | əlavə sənədlər bölməsi |
| To-do create | primary “Yeni tapşırıq” | stable busy button | To-do list | toast | entered values preserved | list heading |
| To-do recipient | “Bütün istifadəçilər” or named user selection | selected recipients saved with task | same task card | recipient label | validation keeps form | recipient group |
| Köhnə Superadmin hesablarının köçürülməsi | Superadmin “Köhnə istifadəçiləri bazaya köçür” | sabit düymə | İstifadəçilər siyahısı | say məlumatlı toast | lokal siyahı dəyişməz qalır | istifadəçi siyahısı |
| To-do icra statusu | Qəbul etdim / İcra edirəm / Tamamla | serverdə saxlanır | eyni To-do kartı | status və qəbul edən istifadəçi | xəta kartı dəyişməz saxlayır | növbəti status düyməsi |
| To-do complete | row action | immediate local save | same filtered list | toast | row remains unchanged on failed save | action button |
| To-do delete | danger row action, then confirmation | stable delete button | same filtered list | toast + audit event | cancel keeps task unchanged | cancel button |

## Navigation and responsive behavior

- Document title follows active module.
- Desktop sidebar becomes a modal left drawer below 900px.
- Tables scroll internally on narrow screens and retain column headers.
- Focus is never hidden behind the sticky topbar.

## Overlays and feedback

- Global z-index scale lives in `design-system.css`.
- Dialogs remain within safe viewport and restore focus where the legacy flow provides a trigger.
- Toasts use one fixed placement, maximum visual footprint, and semantic live-region behavior.
- Destructive actions name the object and consequence.

## Async and resilience

- Mutations remain pessimistic; duplicate submit is prevented where a busy state exists.
- API failure keeps user input and exposes retry guidance.
- Offline writes are not presented as successful.

## Validation

- Application owns validation copy in Azerbaijani.
- Errors are inline and first invalid field receives focus for migrated workflows.
- Sensitive values remain masked and are not included in logs or toasts.

## Permission and clipboard

- Superadmin-only user management is hidden for admin users and enforced server-side. Every account created there is automatically an ERP and To-do account; there is no separate recipient directory.
- Forbidden direct access receives an explanatory access-denied state.

## Migration status

- Canonical visual owner: `design-system.css`.
- Legacy inline and module CSS remains compatibility evidence; new visual changes go through semantic tokens.
- High-risk workflows migrate before low-risk static screens.

## Verification

- Static audit: Frontend Design Premium strict project audit.
- Browser matrix: desktop, 900px, 640px; light/dark; keyboard focus and reduced motion.
- Canonical sibling comparison: Sorğular list/detail and Anbar list.
