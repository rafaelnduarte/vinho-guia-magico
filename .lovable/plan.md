

## Plan: Add Cover Image to Courses (Admin/Cursos)

### 1. Database Migration
Add `capa_url` text column to the `cursos` table:
```sql
ALTER TABLE public.cursos ADD COLUMN capa_url text;
```

### 2. Storage Bucket
Create a public `course-covers` storage bucket with RLS policies (admin write, public read).

### 3. Code Changes — `src/components/admin/AdminCursos.tsx`

**Interface update**: Add `capa_url: string | null` to the `Curso` interface and include it in the query select.

**Upload handler**: Add `handleUploadCapa(curso)` function that:
- Opens a file input (`accept="image/*"`)
- Uploads to `course-covers/{curso.id}.{ext}` via Supabase Storage
- Updates `cursos.capa_url` with the public URL
- Invalidates the query cache

**Card layout transformation**: Replace the current icon-based card with a cover-image card:
- If `capa_url` exists: show it as background with `aspect-video`, `bg-cover`, `bg-center`
- If not: show a placeholder with `FolderOpen` icon
- Move title, badge, controls, and buttons below the image (same pattern as aulas cards)
- Add an upload button (📷 icon) in the card to import/replace the cover image

**No other functionality changed** — publish toggle, delete, sync, aulas dialog all remain identical.

### Card Structure
```text
┌──────────────────────────────┐
│   [cover image / placeholder] │
│                         [📷] │
├──────────────────────────────┤
│  Course Title                │
│  🎬 X aulas                 │
│  [Switch] Publicado   Badge  │
│  [Ver Vídeos]          [🗑]  │
└──────────────────────────────┘
```

### Technical Notes
- File input is hidden, triggered by button click via `useRef`
- Google Drive import is not natively supported in browsers; the upload button covers local file selection (standard browser file picker)
- Cards auto-resize to match image aspect ratio using `aspect-video`

