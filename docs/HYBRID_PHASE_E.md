# Hybrid Phase E — Maintenance UX deepen (SLA + team picker)

Deepens facilities work management **without** merging into emergency `Incident`
or rewriting Express SOS.

## What landed

| Area | Change |
|------|--------|
| SLA helpers | Priority → default window (`urgent` 4h … `low` 72h); `computeSlaTargetAt` / `evaluateSlaStatus` |
| Callable assign | Auto-stamps `slaTargetAt` on request + work order; accepts `slaHours` |
| Web `/ops/requests` | Team picker, priority, optional SLA hours; SLA badge + due time |
| Web assign API | `assignedTeamId`, `priority`, `slaHours` / `slaTargetAt`; rejects security-only assignees |
| Seed | `team_a_facilities` with `status: 'active'` |
| Domain | `packages/domain/src/sla.ts` |

## SLA status vocabulary (derived, not a stored enum)

| Status | Meaning |
|--------|---------|
| `none` | No `slaTargetAt` |
| `on_track` | Before target, not in due-soon window |
| `due_soon` | Remaining ≤ 20% of window |
| `breached` | Past target (open) or completed late |
| `met` | Resolved/closed on or before target |

Stored request statuses remain unchanged (`submitted` → … → `closed`).

## Explicit non-changes

- Express SOS / marketplace
- No ops request → Incident merge
- No Firebase auth fallback flip
- Incident assignment machine untouched

## Tests

```bash
npm test --prefix firebase/functions
# phaseESla.test.ts
```

## Next

Phase F — **Done** — see [`HYBRID_PHASE_F.md`](./HYBRID_PHASE_F.md) (person-first My Services hub).
