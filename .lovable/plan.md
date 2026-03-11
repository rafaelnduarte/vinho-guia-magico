

## Plan: Fix Panda DRM 6-Second Limit (Compatible Auth)

### Root Cause (from logs)

The `panda-token` function returns **401 Unauthorized** from Panda's DRM JWT endpoint. The logs confirm:

```
[PANDA-TOKEN] Error fetching DRM JWT: 401 {"message":"Unauthorized"}
```

Meanwhile, `panda-sync` and `panda-diagnostics` successfully call Panda using `Authorization: {apiKey}` **without** the `Bearer` prefix. The DRM endpoint likely requires the same format.

### Changes

**1. `supabase/functions/panda-token/index.ts`** — Complete rewrite:
- Try `Authorization: Bearer {key}` first (per user's prompt)
- If 401, retry with `Authorization: {key}` (format used by working functions)
- Remove any jose/local signing remnants
- Keep Supabase auth check
- Return `{ token: data.jwt }` on success, `{ token: null }` on failure

**2. `supabase/functions/panda-diagnostics/index.ts`** — Add `assign_drm` action:
- New action to associate a video with the DRM group via `PUT /videos/{video_id}` with `{ drm_group_id }` body
- This addresses point #4 from the user's prompt (videos must be in the DRM group)

**3. `src/components/admin/AdminPandaDiagnostics.tsx`** — Add "Assign to DRM Group" button:
- After diagnostics, show button to assign the video to the DRM group
- Calls the new `assign_drm` action

**No changes needed:**
- `PandaPlayer.tsx` — already uses `&jwt=` correctly
- `HLSPlayer.tsx` — already uses `?jwt=` correctly

