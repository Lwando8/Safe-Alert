# Phase 2B — Known Limitations

1. **Firebase Auth fallback remains required** for mobile until the removal gate is met.
2. **Clerk live probes** require operator credentials; agent environments without keys cannot verify the Clerk path.
3. **Unmigrated callables** (`login*`, shifts, heartbeat) still use Firebase custom claims without membership checks.
4. **Client Firestore / RTDB rules (Phase 2E):** tenant-sensitive collections are now **client-deny** (Admin/callable only). Selective client reads with verified org claims are deferred; see `PHASE2E-SECURITY-RULES.md`.
5. **`getNearbyIncidents`** filters by organization and open status but does not yet apply true geo-radius filtering (`radiusKm` is echoed only).
6. **Central audit collection** is not implemented; incident timeline documents include `authProvider` only.
7. **Push org-switch**: registering under a new org does not auto-revoke the prior org device index (explicit modelling required).
8. **`/platform/organizations`** remains a shell — production university provisioning is out of scope.
9. **Physical-device** iOS/Android Clerk auth + critical push registration are not verified in this slice.
