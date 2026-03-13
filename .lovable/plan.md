

## Analysis

The audit confirms all 105 videos exist in Panda (`config_api_exists_count: 105`), but **config.json returns 404 for ALL of them** even with JWT. The videos are DRM-protected and the config endpoint simply doesn't serve them via direct fetch -- only the iframe player knows how to handle the JWT internally.

The `PandaPlayer` component pre-validates config.json (line 72-108). When it gets 404, it shows "Erro de acesso DRM" -- but this is a **false positive**. The iframe player handles JWT auth differently than a raw HTTP fetch.

## Root Cause

`PandaPlayer.validateConfig` fetches `config.json?jwt=...` and if it returns 404/401/403, it blocks rendering with `drm_error`. For DRM-protected videos, config.json is NOT publicly accessible even with JWT in query string -- the iframe player uses internal mechanisms to authenticate.

## Fix

**Update `src/components/cursos/PandaPlayer.tsx`**: When we have a valid JWT from panda-token, skip config.json validation entirely and go straight to "ready". The JWT was already validated server-side by panda-token. Only validate config.json when there's NO JWT (public videos).

```text
Flow change:
BEFORE: jwtLoading=false → fetch config.json → 404 → "drm_error" ✗
AFTER:  jwtLoading=false + jwt exists → "ready" (trust the JWT)
        jwtLoading=false + no jwt → fetch config.json → validate
```

The validateConfig effect (lines 72-108) will be updated:
- If `jwt` is present → immediately set `playerState("ready")` without fetching config.json
- If `jwt` is null → keep existing config.json validation logic (for public/non-DRM videos)
- If `playerState` is already `"not_found"` → skip (already handled by panda-token)

Single file change, no other functionality affected.

