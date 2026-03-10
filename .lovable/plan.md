

## Add `video.changeStatus` handler to panda-webhook

### Problem
Panda sends `video.changeStatus` events (not `video.encoded`) with a flat payload structure (`payload.video_id` instead of `payload.video.id`). The current webhook doesn't handle this event.

### Change: `supabase/functions/panda-webhook/index.ts`

Replace the processing block (lines 68-92) to add the new `video.changeStatus` handler before the existing `video.encoded` fallback:

```
} else if (
  eventType === "video.changeStatus" &&
  payload.status === "CONVERTED" &&
  payload.video_id
) {
  // Handle Panda's actual event format
  console.log('VIDEO.CHANGESTATUS RECEBIDO:', {
    videoId: payload.video_id,
    status: payload.status
  });
  const { error: updateError } = await supabase
    .from("aulas")
    .update({ is_published: true, updated_at: new Date().toISOString() })
    .eq("panda_video_id", payload.video_id);
  if (updateError) console.error('ERRO ao publicar aula:', updateError);
  else console.log('AULA PUBLICADA COM SUCESSO:', payload.video_id);

} else if (eventType === "video.encoded" && payload.video) {
  // Keep as fallback
  ...
} else {
  console.log('EVENTO NÃO MAPEADO:', eventType);
}
```

### Files changed
1. `supabase/functions/panda-webhook/index.ts` — add `video.changeStatus` handler

No other files changed.

