

## Plan: Fix Panda Video Player (6-Second DRM Limit)

### Diagnosis

The `panda-token` edge function consistently fails with **502 Internal Server Error** when calling `GET /drm/videos/{group_id}/jwt`. This Panda API endpoint is unreliable. Without a valid JWT, DRM-protected videos show only a 6-second preview.

The official Panda docs recommend **generating JWTs locally** using the DRM group's `secret` key and `jsonwebtoken`, not via the API endpoint.

### Root Cause Chain

```text
panda-token → GET /drm/videos/{group_id}/jwt → 502
           → returns { token: null }
PandaPlayer → iframe loads with no jwt param
           → Panda DRM shows 6s preview only
```

### Solution: Local JWT Signing

Instead of calling the buggy Panda JWT endpoint, the `panda-token` function will:
1. Fetch the DRM group's `secret` via `GET /drm/videos/{group_id}` (reliable endpoint)
2. Sign a JWT locally using that secret (as per Panda's official docs)
3. Return the signed JWT to the frontend

### Files to Change

| File | Change |
|------|--------|
| `supabase/functions/panda-token/index.ts` | Replace buggy GET JWT call with local JWT signing using `jsonwebtoken`. Fetch group secret from `GET /drm/videos/{group_id}`. |
| `src/components/cursos/PandaPlayer.tsx` | No changes needed -- already uses `&jwt=` correctly and handles null JWT fallback. |
| `src/components/cursos/HLSPlayer.tsx` | No changes needed -- already uses `?jwt=` correctly. |
| `src/components/admin/AdminPandaDiagnostics.tsx` | Add a "Fetch Group Info" button that calls `GET /drm/videos/{group_id}` to verify the group exists, has videos, and display the secret. This helps debug whether videos are actually in the DRM group. |

### Technical Details: Local JWT Signing (per Panda docs)

```typescript
import * as jose from "https://deno.land/x/jose@v5.2.0/index.ts";

const secret = groupData.secret; // from GET /drm/videos/{group_id}
const payload = {
  drm_group_id: groupId,
  string1: user.email || "member",
};
const jwt = await new jose.SignJWT(payload)
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(secret));
```

### What This Does NOT Change
- No changes to `setup-watermark`, `panda-sync`, `panda-webhook`, `panda-proxy`, `panda-recovery`, `panda-diagnostics` (core logic)
- No changes to any other page or feature
- No database changes

### Important Note
If the DRM group (`ef76bdb0-eaae-434f-b784-ac27e68aed2e`) doesn't have videos associated, you'll need to add them via the Panda dashboard or by updating `setup-watermark` to include `video_ids`. The diagnostic button will help verify this.

