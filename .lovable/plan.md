

## Plan: Execute setup-watermark via service role bypass

The `setup-watermark` function requires an admin user's JWT for authentication, but the tool I have to call edge functions doesn't pass user auth tokens. Since this is a **one-time setup operation**, I will:

1. **Temporarily update `setup-watermark/index.ts`** to accept a service role key header as an alternative auth path (checking `SUPABASE_SERVICE_ROLE_KEY` match instead of requiring a logged-in admin user)
2. **Execute the function** via the curl tool with the service role header
3. **Capture the returned `group_id` and `private_token`**
4. **Add both as secrets** (`PANDA_WATERMARK_GROUP_ID`, `PANDA_WATERMARK_PRIVATE_TOKEN`)
5. **Revert the function** back to admin-only auth (remove the service role bypass)

### Alternative approach
Instead of modifying the function, I can add a simple **admin button in the UI** (AdminPandaDiagnostics) that calls the function when you click it while logged in as admin. This is safer and lets you trigger it from the preview.

| Approach | Pro | Con |
|----------|-----|-----|
| Modify function temporarily | Immediate execution | Requires revert step |
| Add UI button | Safe, reusable | Requires you to click it in preview while logged in |

I recommend **adding a UI button** in the Diagnostics tab. You click "Setup Watermark Group" while logged in as admin, and the results (group_id, token) are displayed. I then add them as secrets.

### Changes

| File | Action |
|------|--------|
| `src/components/admin/AdminPandaDiagnostics.tsx` | Add "Setup Watermark Group" button + result display at the top of the page |

The button calls `supabase.functions.invoke("setup-watermark")` which will use your admin session token automatically.

