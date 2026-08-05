# `@seren/domain`

Shared TypeScript domain types for Seren SOS.

Internal names stay generic (`Organization`, `Site`, `Zone`, `Membership`, `Responder`).  
University UI labels are presentation-only (`UNIVERSITY_LABELS`).

## Usage

```ts
import type { Organization, Site, Membership } from '@seren/domain';
import { isResponderDispatchEligible } from '@seren/domain';
```

## Build

```bash
npm run domain:build
# or
npm run build --workspace=@seren/domain
```

Phase 1: types only. Firestore persistence and claim enforcement land in Phase 2.
