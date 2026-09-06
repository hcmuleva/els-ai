# Shared UI Components & Design Tokens

This folder is the closest thing the app has to a design system: a small set
of reusable primitives layered on top of the tokens in
[`src/theme/index.ts`](../../theme/index.ts). It's an organized folder inside
the existing app, not a separate package — there's no build step or
versioning to manage, just an import path (`../../src/components/common/*`).

There's no Storybook here. This README is the catalog: every component's
purpose, props, and a copy-paste usage example. Screenshots would go stale
faster than they'd help; read the prop table and the linked source instead.

## Design tokens (`src/theme/index.ts`)

Six token groups, all plain objects (no theming/dark-mode switch — the app
has one visual theme):

| Export | Contains | Example |
|---|---|---|
| `Colors` | Semantic colors: `primary`/`accent`/`success`/`warning`/`purple` (+ `*Light` tints), `text`/`textSecondary`/`textMuted`/`textDisabled`, `background`/`surface`/`surfaceAlt`/`border`/`borderLight`, `error`/`errorLight` | `Colors.textMuted` |
| `RoleColors` | Per-role identity color (student/teacher/parent/admin/superadmin) — a categorical palette, distinct from the state-semantic colors above even where hues overlap | `RoleColors.superadmin` |
| `Typography` | `size` (xs→hero) and `weight` (regular→black) scales | `Typography.size.lg` |
| `Radius` | Corner radii, xs→xxl plus `card` and `full` (pill) | `Radius.lg` |
| `Shadow` | Elevation presets (`sm`/`md`/`lg`) — spread directly into a style object | `{ ...Shadow.sm }` |
| `Spacing` | Spacing scale, xs→xxxl | `Spacing.base` |

**Why these values specifically:** every `Colors` entry was reverse-engineered
from whichever hex literal was already dominant across the shipped app (via a
repo-wide grep), so introducing the token file was a visual no-op — it named
what was already there rather than redesigning it. `primary`, `accent`,
`textMuted`, and the `parent`/`superadmin` role colors were later *darkened*
from that baseline after an `agent-browser a11y` audit found all of them
failed WCAG AA contrast (2.0–3.3:1 against white; need 4.5:1). See the
comments at the top of `theme/index.ts` for the exact before/after values.

**Using tokens in new code:** import from `../../theme` (adjust the relative
path per file depth) and reference the token instead of a hex literal —
`color={Colors.textMuted}` instead of `color="#525C6B"`. This makes an a11y
or rebrand pass a one-file change instead of a repo-wide grep, and it's the
same reasoning that drove the `reports.tsx`/`manage.tsx`/`planner.tsx`
cleanup below.

**What's intentionally *not* tokenized:** literal `#fff`/`#000` (white/black
used as plain text or icon color rather than a themed surface), and one-off
decorative colors — subject-icon backgrounds, gradient accents, per-topic
category colors — that exist in exactly one place and don't represent a
reusable semantic value. Forcing those into `Colors.*` would be a false
abstraction (a coincidental hex match today doesn't mean the two usages
should move together tomorrow). When in doubt, a hex literal used in exactly
one semantic role is fine to leave as-is; a hex literal repeated across many
files for the same meaning (muted text, a border, a primary CTA) is a
tokenization candidate.

## Components

### `Card`

```tsx
import { Card } from '../../src/components/common/Card';

<Card variant="elevated" padding={16}>
  <Text>Elevated white panel with a soft shadow</Text>
</Card>

<Card variant="outlined" shadow="md">…</Card>   {/* bordered, no shadow */}
<Card variant="flat" padding={0}>…</Card>       {/* flat grouped container */}
```

Shared surface primitive for the three ad hoc "card" shapes that were
duplicated across Planner/Manage/etc. before this component existed.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `'elevated' \| 'outlined' \| 'flat'` | `'elevated'` | `elevated` = shadow, no border; `outlined` = border, no shadow; `flat` = neither |
| `shadow` | `keyof typeof Shadow` | `'sm'` | Only applies when `variant="elevated"` |
| `padding` | `number` | `Spacing.base` (16) | Pass `0` for grouped containers that manage their own row padding |
| `radius` | `number` | `Radius.lg` (16) | |
| `overflow` | `ViewStyle['overflow']` | `'visible'` for elevated, `'hidden'` otherwise | Override only if a screen needs different corner-clipping behavior |
| `style` | `StyleProp<ViewStyle>` | — | Merged last, so it can override any of the above |

### `ConfirmModal`

```tsx
import ConfirmModal from '../../src/components/common/ConfirmModal';

<ConfirmModal
  visible={showDelete}
  itemName={topic.title}
  loading={isDeleting}
  onConfirm={handleDelete}
  onClose={() => setShowDelete(false)}
/>
```

Centered confirmation dialog for destructive (`danger=true`, default — trash
icon, red) or non-destructive (`danger=false` — warning icon, amber)
confirmations. Renders `null` when `visible` is `false` rather than hiding
via style, so it never intercepts touches while closed.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `visible` | `boolean` | — | required |
| `onConfirm` / `onClose` | `() => void` | — | required |
| `title` | `string` | `'Confirm Delete'` | |
| `itemName` | `string` | — | Interpolated into the default message (`Are you sure you want to delete "{itemName}"?`) if `message` isn't set |
| `message` | `string` | derived from `itemName` | Fully overrides the body text |
| `confirmText` / `cancelText` | `string` | `'Delete'` / `'Cancel'` | |
| `loading` | `boolean` | `false` | Swaps the confirm button's content for a spinner and disables both buttons |
| `danger` | `boolean` | `true` | Toggles icon/color scheme between destructive and warning |

### `ModalHeader`

```tsx
import { ModalHeader } from '../../src/components/common/ModalHeader';

<ModalHeader title="Edit Topic" subtitle="1 · First · English" onClose={onClose} />
<ModalHeader onBack={goBack} center={<ProgressBar value={0.4} />} />
```

Safe-area-aware header bar for full-screen modals and headerless screens —
applies `Math.max(insets.top, minTop)` once so content never slips under the
notch/status bar. Supply `onBack`/`onClose` for the default icon buttons, or
pass `left`/`right`/`center` directly for custom layouts (e.g. a progress bar
in place of the title).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `title` / `subtitle` | `string` | — | Ignored if `center` is provided |
| `center` | `ReactNode` | — | Overrides the title/subtitle block entirely |
| `left` / `right` | `ReactNode` | — | Overrides the corresponding slot; falls back to a back/close icon button driven by `onBack`/`onClose`, or an empty spacer if neither is set |
| `onBack` / `onClose` | `() => void` | — | Renders the default `ArrowLeft`/`X` icon button when set and `left`/`right` isn't overridden |
| `tone` | `string` | `Colors.surface` | Header background |
| `titleColor` / `subtitleColor` / `iconColor` | `string` | `Colors.text` / `Colors.textMuted` / `Colors.text` | |
| `minTop` | `number` | `12` | Floor for the top safe-area padding |
| `borderless` | `boolean` | `false` | Omits the bottom border |

### `PaginationControls`

```tsx
import { PaginationControls } from '../../src/components/common/PaginationControls';

<PaginationControls
  currentPage={page}
  totalPages={totalPages}
  totalCount={total}
  itemLabel="students"
  loading={isFetching}
  onFirst={() => setPage(1)}
  onPrev={() => setPage((p) => p - 1)}
  onNext={() => setPage((p) => p + 1)}
  onLast={() => setPage(totalPages)}
/>
```

First/Prev/Next/Last pager with a "Page X of Y • N items" summary line.
Memoized (`React.memo`) since it's typically rendered inside a list-heavy
screen. Renders `null` when there's only one page and no items, so callers
don't need their own conditional.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `currentPage` / `totalPages` / `totalCount` | `number` | — | required |
| `onFirst` / `onPrev` / `onNext` / `onLast` | `() => void` | — | required |
| `loading` | `boolean` | `false` | Shows a small spinner next to the count |
| `itemLabel` | `string` | `'items'` | e.g. `'students'`, `'topics'` |

### `LatexText`

```tsx
import LatexText from '../../src/components/common/LatexText';

<LatexText content={question.prompt} style={{ fontSize: 15, color: Colors.text }} />
<LatexText content={preview} compact compactHeight={44} numberOfLines={2} />
```

Renders a string that may contain LaTeX (`$...$`, `$$...$$`, `\(...\)`,
`\[...\]`) mixed with plain text — used for Math/Physics/Chemistry question
content. If `content` has no LaTeX delimiters it renders as a plain `<Text>`
(zero WebView overhead); otherwise it renders via a transparent WebView with
KaTeX loaded from a CDN, auto-sized via `postMessage`.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `content` | `string` | — | required; may be plain text, pure LaTeX, or a mix |
| `style` | `TextStyle` | — | `fontSize`/`color` are read out of this and forwarded into the KaTeX page; other style props only apply to the plain-text fallback path |
| `compact` | `boolean` | `false` | Fixes height to `compactHeight` and clips overflow — for card/list previews needing a consistent row height |
| `compactHeight` | `number` | `44` | Only used when `compact` |
| `numberOfLines` | `number` | `2` | `numberOfLines` for the plain-text fallback when `compact` |
| `background` | `string` | `'transparent'` | Background passed into the KaTeX page |

Also exports `hasLatex(text: string): boolean` if a caller needs to detect
LaTeX content without rendering (e.g. to decide layout before mounting).

### `SafeScreen`

```tsx
import { SafeScreen } from '../../src/components/common/SafeScreen';

<SafeScreen scroll edges={['top', 'bottom']}>
  <YourScreenContent />
</SafeScreen>
```

Themed full-height body wrapper that applies safe-area padding
(`Math.max(insets.x, min)`) on the requested edges. Use for full-screen views
that own their layout (no native header, no tab bar) so content never slips
under the notch or the home indicator. Pair the `top` edge with `ModalHeader`
when the screen also needs a header bar (the header applies its own top
inset, so don't double it up with `SafeScreen`'s).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `children` | `ReactNode` | — | required |
| `edges` | `('top' \| 'bottom')[]` | `['top', 'bottom']` | Which edges get safe-area padding |
| `scroll` | `boolean` | `false` | Renders a `ScrollView` instead of a plain `View` |
| `background` | `string` | `Colors.background` | |
| `minTop` / `minBottom` | `number` | `12` / `12` | Floor for each edge's padding |
| `style` | `StyleProp<ViewStyle>` | — | Applied to the outer `View`/`ScrollView` |
| `contentContainerStyle` | `StyleProp<ViewStyle>` | — | Only used when `scroll` (merged with the safe-area padding) |

## Scope note (P2 backlog item 12)

This pass deliberately did **not** add new primitives (e.g. a shared
`Button`/`Badge`) — the components above were already covering their niches
well enough that inventing new ones would mean migrating call sites with no
functional gain. It also didn't move this folder into a separate workspace
package; there's exactly one app consuming it, so the extra
build/versioning overhead had no payoff yet. Both are worth revisiting if a
second app (e.g. a future admin-only web build) needs to share these
components.

The hex-literal → token migration swept the three largest offenders
(`reports.tsx`, `manage.tsx`, `planner.tsx` — hundreds of raw hex literals
each) for **exact matches against existing `Colors`/`RoleColors` values
only**. It didn't invent new tokens for the remaining one-off colors in those
files (see "What's intentionally not tokenized" above) — that's a
judgment call best made per-color as those screens are touched again, not a
one-shot script.
