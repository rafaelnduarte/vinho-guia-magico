

## Plan: Fix Panda DRM Integration

### Problem
- `panda-token` is signing JWTs locally (HMAC) instead of fetching from Panda's official API
- `PandaPlayer` uses `watermark=` param instead of `jwt=`
- Both violate Panda's official DRM documentation

### Changes

**1. `supabase/functions/panda-token/index.ts`** — Complete rewrite of token logic
- Remove `signJwt` function, `base64url` import, and all local signing
- Fetch JWT from official endpoint: `GET https://api.pandavideo.com/watermark/groups/{groupId}/jwt?expiredAtJwt={exp}` with `Authorization: Bearer {PANDA_API_KEY}`
- Fallback to `api-v2.pandavideo.com.br/drm/videos/{groupId}/jwt` if first fails
- Keep existing auth + membership checks intact
- Return `{ token: data.jwt }` from Panda response

**2. `src/components/cursos/PandaPlayer.tsx`** — Fix two param references
- Line 72: Change `?watermark=${jwt}` to `?jwt=${jwt}` in config.json validation URL
- Line 233: Change `{ watermark: jwt }` to `{ jwt: jwt }` in iframe params

**3. No changes to `panda-diagnostics`** — the `assign_drm_all` with `PUT /drm/videos/{groupId}` is already correct.

