

## Plan: Fix Panda Video DRM/Watermark API Endpoints

### Root Cause

From the edge function logs, the error is clear:
```
"must have required property 'name'"
```

The `setup-watermark` function calls `POST /drm/videos` without the required `name` field. Additionally, `panda-token` uses wrong endpoints for JWT generation.

### Correct Panda API Endpoints (from docs)

Based on analysis of all Panda API documentation:

| Operation | Correct Endpoint | Method |
|-----------|-----------------|--------|
| Create DRM group | `POST /drm/videos` | POST |
| List groups | `GET /drm/videos/` | GET |
| Get group | `GET /drm/videos/{drm_group_id}` | GET |
| Create private token | `POST /drm/tokens` | POST |
| Get JWT from group | `GET /drm/videos/{drm_group_id}/jwt` | GET |

### Changes (3 files)

**1. `supabase/functions/setup-watermark/index.ts`** -- Fix the complete setup flow:
- Step 1: `POST /drm/videos` with `{ name: "VinhoGuiaMagico_DRM", active: true, percent_ts: 0.5 }` (was missing `name` and `active`)
- Step 2: `POST /drm/tokens` with `{ drm_group_id, jwt: true, key: "system_key_...", string1: "..." }` to create private token
- Return both `group_id` and token `key` for storing as secrets

**2. `supabase/functions/panda-token/index.ts`** -- Fix JWT endpoint:
- Change from `POST /watermark/jwt/{groupId}` to `GET /drm/videos/{groupId}/jwt`
- This is a GET request, not POST
- Passes `expiredAtJwt` as query parameter for expiration

**3. `src/components/admin/AdminPandaDiagnostics.tsx`** -- Display the returned token key from setup result (minor adjustment to show `key` field from new response shape)

### No other files or features are modified.

