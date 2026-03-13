

## Plan: Harden panda-sync Profile Assignment + Fix Auth

### What's already done (no changes needed)
- `aulas.embed_url` column exists
- `PandaPlayer` is already embed-only with postMessage listeners for progress/completion
- `AulaPage` passes `embed_url` to PandaPlayer and persists to `progresso` table

### Changes needed

**1. Fix `panda-sync` auth method**
The function uses `anonClient.auth.getClaims(token)` which may not exist in supabase-js v2. Replace with `anonClient.auth.getUser()` which is the standard method.

**2. Harden PANDA_PROFILE_ID block in `panda-sync`**
Currently the profile assignment catch block is minimal. Add:
- Explicit logging of request/response status
- Test with and without Bearer prefix on API key
- Non-blocking: sync succeeds even if profile assignment fails
- Log the HTTP status code and response body for diagnostics

**File: `supabase/functions/panda-sync/index.ts`**

Auth fix (lines 42-48):
```typescript
// Replace getClaims with getUser
const { data: userData, error: userError } = await anonClient.auth.getUser();
if (userError || !userData?.user) {
  return unauthorized response
}
const userId = userData.user.id;
```

Profile assignment (lines 180-198): wrap with detailed logging:
```typescript
const profileId = Deno.env.get("PANDA_PROFILE_ID");
if (profileId && syncedVideoIds.length > 0) {
  try {
    console.log(`[panda-sync] Assigning profile ${profileId} to ${syncedVideoIds.length} videos`);
    const profileRes = await fetch(...);
    const profileStatus = profileRes.status;
    const profileBody = await profileRes.text();
    console.log(`[panda-sync] Profile response: ${profileStatus} — ${profileBody}`);
    if (!profileRes.ok) {
      results.errors.push(`Profile assignment (status ${profileStatus}): ${profileBody}`);
    }
  } catch (profileErr) {
    console.error(`[panda-sync] Profile assignment error:`, profileErr);
    results.errors.push(`Profile assignment: ${(profileErr as Error).message}`);
  }
}
```

No other files are touched. No routes, layouts, RLS, or other functionality changes.

