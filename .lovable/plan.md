

## Plano: Corrigir nomes dos campos no body do profile assignment

### Problema

Os logs mostram claramente:
```
status=400 body={"errCode":"BadRequest","errMsg":["profile is a required field"]}
```

A API do Panda espera o campo `profile` (não `profile_id`) e provavelmente `videos` (não `video_ids`). O código atual envia `profile_id` e `video_ids`, que a API não reconhece.

### Mudanças

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/panda-sync/index.ts` | Renomear `profile_id` para `profile` e `video_ids` para `videos` no body |
| `supabase/functions/panda-webhook/index.ts` | Mesma correção |

### Detalhe

```typescript
// De:
body: JSON.stringify({
  profile_id: profileId,
  video_ids: syncedVideoIds,
})

// Para:
body: JSON.stringify({
  profile: profileId,
  videos: syncedVideoIds,
})
```

Adicionalmente, incluir log do payload antes do envio para facilitar debug futuro.

### Sem mudanças no banco ou frontend

