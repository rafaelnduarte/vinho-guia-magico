

## Bug Diagnosis

**Root cause: Race condition on navigation**

The data IS being saved correctly to the database (verified — `concluido: true` records exist). The problem is timing:

1. `handleComplete` calls `saveProgress(...)` — this is **async fire-and-forget** (no `await`)
2. User clicks "Voltar ao curso" → navigation happens **immediately**
3. `CursoDetailPage` mounts and fetches `progresso` **before** the upsert from step 1 has committed
4. Result: stale data shows the lesson as not completed

Additionally, the unmount cleanup in AulaPage (lines 127-134) has **stale closures** — it captures `currentTime=0` and `completed=false` from the initial render due to empty `[]` deps, making it effectively dead code.

## Fix Plan — Single file: `AulaPage.tsx`

### 1. Fix the "Voltar ao curso" button
Make it **await** `saveProgress` before navigating, so the DB write commits before CursoDetailPage fetches:

```tsx
const handleBack = useCallback(async () => {
  if (currentTimeRef.current > 0) {
    await saveProgress(currentTimeRef.current, completedRef.current);
  }
  navigate(`/cursos/${cursoId}`);
}, [saveProgress, navigate, cursoId]);
```

### 2. Fix the unmount cleanup
Use **refs** instead of stale state closures so the cleanup actually saves correct values:

```tsx
useEffect(() => {
  return () => {
    if (currentTimeRef.current > 0) {
      saveProgress(currentTimeRef.current, completedRef.current);
    }
  };
}, [saveProgress]);
```

### 3. Await saveProgress in handleComplete
Ensure the completion save finishes before any subsequent navigation:

```tsx
const handleComplete = useCallback(async () => {
  if (completedRef.current) return;
  completedRef.current = true;
  setCompleted(true);
  await saveProgress(durationRef.current || currentTimeRef.current, true);
  toast.success("Parabéns! Aula concluída. 🎉");
}, [saveProgress]);
```

No changes to `CursoDetailPage.tsx`, `PandaPlayer.tsx`, or database needed.

