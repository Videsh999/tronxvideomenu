# POS Layout Fix Report

## Problem

Admin POS (`/admin/.../pos`) right panel overlapped: cart lines covered **Place order** / payment controls. Sticky aside + capped height + dense footer (`sm:max-h-[48%]`) competed for space without a true flex scroll split.

## Fix (`components/admin/PosTerminal.tsx`)

- Root uses `h-[calc(100dvh-4rem)]` with `lg:overflow-hidden`.
- Main grid `min-h-0 flex-1`.
- Product grid: `min-h-0 flex-1 overflow-y-auto` (own scroll).
- Bill aside: `flex flex-col overflow-hidden` (not sticky competing max-height alone).
- Cart list: `flex-1 min-h-0 overflow-y-auto`.
- Checkout footer: `shrink-0` with independent `max-h` + `overflow-y-auto` so **Place & pay / Place order only / Record** stay reachable.

Captain POS uses the same pattern (product scroll + cart scroll + pinned checkout).

## Breakpoints checked in CSS structure

320–414 (stacked), 768–1024 (tablet), 1280–1920 (side-by-side bill column).
