

## Plan: Final Panda Video Embed Restructure

### Current State
The codebase is already mostly clean — DRM, diagnostics, audit functions, and auxiliary tables have been removed in prior iterations. What remains:

1. **`panda-sync`** builds `embed_url` locally via `buildEmbedUrl()` instead of fetching the real `embed_url` and `embed_html` from Panda's API
2. **`panda-sync`** uses deprecated `getClaims()` for auth
3. **`aulas` table** is missing `embed_html` column
4. **`PandaPlayer`** does not support `embed_html`
5. **`AulaPage`** does not fetch or pass `embed_html`

### Changes

**1. Database Migration — add `embed_html` column**
```sql
ALTER TABLE public.aulas ADD COLUMN IF NOT EXISTS embed_html text;
```

**2. Rewrite `panda-sync` edge function**
- Fix auth: replace `getClaims()` with `getUser()`
- For each video from the folder listing, fetch individual video details via `GET /videos/{id}` to extract `embed_url` and `embed_html` (the fields Panda returns as `video.embed_url` and `video.embed_code` or similar)
- Remove `buildEmbedUrl()` helper — use API-provided values
- Save `embed_html` alongside `embed_url` in the aulas upsert
- Keep profile assignment as non-blocking

**3. Update `PandaPlayer.tsx`**
- Add `embedHtml` prop
- If `embedHtml` is provided, render it via `dangerouslySetInnerHTML` (wrapped in aspect-ratio container)
- Otherwise fall back to iframe with `embedUrl` or constructed URL from `pandaVideoId`
- Keep postMessage listeners for progress tracking (they work with standard embed iframes)

**4. Update `AulaPage.tsx`**
- Add `embed_html` to the `AulaData` interface and the Supabase select query
- Pass `embedHtml={aula.embed_html}` to `PandaPlayer`

**5. No other changes** — AdminPage, AdminCursos, config.toml, and all other features remain untouched.

