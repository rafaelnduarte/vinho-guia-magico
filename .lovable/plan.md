

## Plan: Switch panda-token to Official Panda DRM JWT Endpoint

### Problem
Local JWT signing with `jose` is not accepted by Panda for DRM streaming — videos play only 6 seconds. Previous 502 errors may have been caused by using the wrong API base URL and missing the `Bearer` prefix on the Authorization header.

### Change: 1 file

**`supabase/functions/panda-token/index.ts`** — Complete rewrite:
- Remove `jose` import and all local JWT signing logic
- Remove `getGroupSecret` function and caching
- Call `GET https://api-v2.pandavideo.com.br/drm/videos/{group_id}/jwt?expiredAtJwt={timestamp}` with `Authorization: Bearer {PANDA_API_KEY}`
- Keep user authentication check (Supabase auth)
- Return `{ token: data.jwt }` on success, `{ token: null }` on failure (allows fallback)

Key differences from previous attempts:
- Use `Bearer ${PANDA_API_KEY}` header (previously sent API key without Bearer prefix)
- Use `api-v2.pandavideo.com.br` base (matching existing working endpoints like panda-sync)

**No changes needed to PandaPlayer.tsx** — already uses `&jwt=` correctly.
**No changes needed to HLSPlayer.tsx** — already uses `?jwt=` correctly.

