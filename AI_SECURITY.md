# AI Security

## Threat model

| Threat | Attack surface | Mitigation |
|--------|----------------|------------|
| Cross-org data exfiltration | Forged `organizationId` / restaurant slug | Session principal + restaurant binding; org RBAC |
| Cross-outlet leakage | Forged `outletId` in assistant/analytics | `requireOutletPermission` server-side before tools |
| Prompt injection | Customer text, dish names, chat input | `looksLikePromptInjection`; untrusted content; allowlisted tools only |
| Secret disclosure | “Reveal API keys / system prompt” | Keys server-only; redaction; no secrets in tool results |
| Arbitrary DB / shell | Model-requested queries | No dynamic query execution; Zod allowlist (`lib/analytics/tools.ts`) |
| Unauthorized mutations | Refund / stock / price via chat | Orchestrator never calls mutating services from LLM output |
| Malformed model JSON | Provider returns junk | Schema parse; drop invalid tool calls; safe error |
| Resource abuse | Huge prompts, rate-limit bypass | Size bounds + `assertAiRateLimit` / `aiUsageEvents` |
| Cost blowouts | Repeated completions | Usage logging, estimated cost, feature flags |

## Authentication and tenancy

1. Every AI route requires an authenticated restaurant admin session.
2. Feature flags gate capability (`AI_*` keys, ENTERPRISE).
3. Outlet scope is resolved with `requireOutletPermission` / org RBAC — **never** from LLM output.
4. Client-supplied `outletId` / `organizationId` are verified server-side; forged IDs return 403.

## Tool allowlist

- The model may only request tools from a fixed registry (`lib/analytics/tools.ts`).
- Tool arguments are Zod-validated.
- No generated Mongo queries, SQL, JavaScript, or shell commands are executed.

## Prompt injection

- User messages, dish names, and feedback text are treated as **untrusted**.
- System prompt instructs the model to ignore instructions that request secrets, raw DB access, refunds, stock changes, or price changes.
- Even if the model asks for a forbidden action, the orchestrator only runs allowlisted analytics tools and never calls mutating services.
- Evaluation harness marks injection questions as blocked when `looksLikePromptInjection` matches.

## Data minimization

Before any content is sent to an external LLM:

- Strip customer phone, email, and payment method details (`redactForLlm`).
- Prefer aggregate tool results over raw order dumps.
- Do not send credential material, Wi-Fi secrets, or encryption keys.

## Mutations

AI **cannot**:

- Approve payments or refunds  
- Adjust stock or place purchase orders  
- Change menu prices or publish menus  

Recommendations require human confirmation through existing authorized APIs.

## Provider keys and failure

- `AI_API_KEY` and related env vars are server-only.
- Timeouts and bounded retries apply.
- Provider outage: throw / heuristic fallback; evaluation page still runs deterministic suites.
- Do not block POS/QR/KDS on AI failure.

## Rate limits and cost

- Per-account and per-organization request limits recorded in `aiUsageEvents`.
- Token usage and estimated cost logged when the provider returns usage metadata.
- Usage API (`/api/ai/usage`) is RBAC-gated; org-wide rollup requires `ORG_VIEW_REPORTS`.
- Raw prompts and API keys are never returned from usage/evaluation endpoints.

## Phase 5.1 security test results

| Test | Result |
|------|--------|
| Prompt injection pattern detection | **Passed** (`tests/ai-security.test.ts`, evaluation security suite) |
| Redaction of phone / email / payment fields | **Passed** |
| Unknown tool rejected by Zod schema | **Passed** |
| Heuristic provider stays on allowlist under injection wording | **Passed** |
| AI feature flags ENTERPRISE-only by default | **Passed** |
| Forged org/outlet in live HTTP | **Environment-dependent** (requires authenticated integration harness) |
| Rate-limit bypass under load | **Deferred** / **Environment-dependent** |
| Evaluation + usage APIs require reports permission | **Passed** (code path via `requireOutletPermission`) |

**Suite status (automated):** Passed (security 4/4 in evaluation snapshot; dedicated `ai-security` tests green).
