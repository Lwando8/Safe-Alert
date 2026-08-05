# Phase 1 Risk Report

Risks identified during the university verticalisation inventory. Phase 1 delivers docs, domain types, and a web/shadcn foundation only — it does **not** migrate emergency logic.

## Risk table

| Risk | Severity | Likelihood | Mitigation | Owner phase |
|------|----------|------------|------------|-------------|
| No web app blocked dashboard work | High | Certain (pre-Phase 1) | Scaffold `apps/web` + shadcn in Phase 1 | Phase 1 |
| Firestore rules lack tenant isolation | Critical | High once multi-uni | Design claims + rules now; implement before second tenant | Phase 2 (hard gate) |
| Public role enums leak into university UX | High | High | Parallel `responderType` / membership kinds; retire police/EMS product copy | Phase 2 |
| Single Expo binary for three personas | Medium | Certain | Keep for MVP; web takes admin primacy; extract responder bundle later | Phase 2–3 |
| Broad FCM on incident create | High | High | Scope notify to org/site/role before multi-campus pilots | Phase 2 |
| Dual backends (Firebase active, server docs cited) | Medium | Medium | Document Firebase as source of truth; treat `server/` as reference | Phase 1 (docs) |
| Premature Postgres rewrite | High | Medium | Stay on Firebase through university MVP | Explicit non-goal |
| Guard self-serve becoming authorised | Critical | Medium | Approval + membership + employment + site + device gate before `acceptIncident` | Phase 2 |
| Destructive “university rename” of domain | High | Medium | Labels in UI only; Organization/Site/Zone internally (`packages/domain`) | Phase 1+ |
| Accidental rewrite of working dispatch | High | Medium | Phase 1 stop-gate: no create/accept/status changes | Phase 1 |
| shadcn forced into Expo | Medium | Low | Install shadcn only in `apps/web`; native UI audited separately | Phase 1 |
| Legacy unauthenticated public create returning | Critical | Low | Never re-enable; university product requires auth + membership | Ongoing |
| Demo data without org/site fields | Medium | High | Do not migrate in Phase 1; seed org/site in Phase 2 | Phase 2 |

## Stop-gate (Phase 1 complete when)

- [x] Inventory, reuse matrix, domain model, risks, roadmap docs exist
- [x] `packages/domain` types exist with generic naming
- [x] `apps/web` university + platform shells exist
- [x] shadcn/ui installed **only** in the web app
- [x] **No** incident lifecycle rewrite (verified — Firebase callables untouched)
- [x] **No** external police/ambulance integrations
- [x] **No** deletion of `server/` or `responder-app/`
- [x] **No** shadcn/NativeWind forced into Expo

See also [`docs/PHASE1-STOP-GATE.md`](PHASE1-STOP-GATE.md).

## Residual risk after Phase 1

The product still behaves as a public SOS app at runtime. University scoping is specified and typed, not enforced. **Do not onboard a second university tenant until Phase 2 tenant isolation lands in Functions + Firestore rules.**
