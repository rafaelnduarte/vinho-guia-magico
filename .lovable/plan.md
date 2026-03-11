

## Plan: Switch to Panda Watermark JWT Authentication

### Problem
The current `panda-token` Edge Function generates a **custom JWT** signed with `PANDA_SECRET_KEY` locally. Panda Video does not recognize this token — it only accepts JWTs issued through its own **Watermark Group** system. Result: videos show only 6s preview then error.

Additionally, the iframe URL uses `&token=` but Panda expects `&jwt=`.

### Approach

Create the Watermark infrastructure via Panda's API, store the group ID as a secret, and replace the custom JWT generation with Panda's native JWT endpoint.

### Changes

| Item | Action |
|------|--------|
| `supabase/functions/panda-token/index.ts` | Rewrite to call Panda's `/watermark/jwt/{groupId}` API instead of signing custom JWTs |
| `src/components/cursos/PandaPlayer.tsx` | Change URL param from `token` to `jwt` |
| `src/components/cursos/HLSPlayer.tsx` | Change URL param from `token` to `jwt` |
| `supabase/functions/setup-watermark/index.ts` | New one-time function: create Watermark Group + enable DRM + create a shared private token |
| New secret: `PANDA_WATERMARK_GROUP_ID` | Store after running setup |
| New secret: `PANDA_WATERMARK_PRIVATE_TOKEN` | Store the private token for JWT generation |

### Flow

```text
1. Run setup-watermark (once) → creates group + private token
2. Save returned IDs as secrets
3. Link videos to group in Panda Dashboard
4. panda-token now calls POST /watermark/jwt/{groupId} with private_token
5. Player uses &jwt= parameter
```

### Technical Details

**`setup-watermark` Edge Function (one-time):**
- `POST /watermark/group` → create group "Vinho_Guia_Magico"
- `POST /watermark/group/{id}/enable` → enable DRM
- `POST /watermark/private-tokens` → create shared token
- Returns group_id + private_token for storing as secrets

**`panda-token` rewrite:**
- Instead of `new SignJWT(...)` with local key, call `POST /watermark/jwt/{groupId}` with the private token
- Panda returns a valid JWT that its player recognizes
- Keep same response shape `{ token: jwt }` for backward compat

**Player changes (minimal):**
- `PandaPlayer.tsx` line 173: change `token: jwt` → `jwt: jwt` in URLSearchParams
- `HLSPlayer.tsx` line 26: change `?token=` → `?jwt=`

### Prerequisites
After deploying `setup-watermark`, the user must:
1. Run the function once to get the group_id and private_token
2. Add them as secrets (`PANDA_WATERMARK_GROUP_ID`, `PANDA_WATERMARK_PRIVATE_TOKEN`)
3. Link videos to the watermark group in Panda Dashboard

