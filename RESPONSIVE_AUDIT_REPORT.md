# Responsive Audit Report

**Date:** 2026-11-05

## Critical fix validated by layout rules

POS / Kitchen immersive shell removes the `max-w-6xl` clamp that caused horizontal clipping of the bill panel at typical laptop widths (≈1280–1440 CSS px with sidebar).

## Breakpoint matrix

| Size | Result | Evidence |
| --- | --- | --- |
| 320–430 phone | Not fully re-screenshoted this pass | Sidebar drawer + POS single-column stack via grid collapse below `lg` |
| 768–1024 tablet | Improved | Catalog + bill stack until `lg`; bill usable |
| 1280×800 / 1366×768 | **Primary bug target** | `minmax(0,1fr)` + constrained bill column |
| 1440–1920 | Should fit comfortably | Full width immersive content |
| Zoom 125–150% | Manual follow-up | Use Chrome device toolbar after hard refresh |

## How to re-verify visually

1. Hard refresh `/admin/<slug>/pos` after pulling these changes  
2. Confirm **Current bill**, CASH/UPI/CARD, and **Record** are fully on-screen  
3. Resize to 1024 and 768 — bill should move below catalog, not off-screen  
4. Customer menu `/menu/<slug>` — names + prices visible without hover  

## Remaining P2

- Admin data tables (dishes, orders) still rely on horizontal scroll on very small phones — acceptable but polishable with card layouts  
- Kitchen fullscreen tablet UX not re-shot in this session  
