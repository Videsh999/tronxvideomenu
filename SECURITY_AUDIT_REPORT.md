# Security Audit Report (incremental)

**Date:** 2026-11-05  
**Scope:** Changes in this audit + spot checks. Not a full pentest.

## Verified

| Control | Evidence |
| --- | --- |
| Menu export requires restaurant admin session | `GET /api/admin/menu-export` → **401** without cookie |
| Export formula injection mitigation | Leading `= + - @` prefixed with `'` in export cells |
| Import upload size / type guards | Existing `assertSafeUpload` path (prior work) |
| No PHYSICALLY_VERIFIED claims added | Hardware docs unchanged / simulator honesty preserved |
| Demo seed blocked in production | Requires `ALLOW_PRODUCTION_SEED=true` |

## Existing controls relied upon (not re-proven end-to-end here)

- Cookie session auth for admin / captain / super-admin  
- Feature flags + org RBAC for multi-outlet  
- Payment ledger as source of truth for money  
- Device diagnostics secret redaction  

## P1 / P2 follow-ups

- Formal IDOR sweep on every `/api/*` restaurantId parameter  
- Rate limits on public order + login endpoints under load  
- Customer PII export/delete workflow documentation for CRM  
- Confirm Excel import never echoes raw Zod JSON to end users (UI path reviewed earlier; keep regression tests)

## Explicit non-claims

- No destructive security testing against production data  
- No claim of zero vulnerabilities  
