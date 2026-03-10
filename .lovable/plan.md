

## Plano: Profile Assignment na Sincronização Panda

### Contexto

O problema relatado ("Este vídeo apresentou falha") ocorre quando vídeos no Panda não têm um profile atribuído. A solução é atribuir automaticamente o profile JDV a todos os vídeos durante a sincronização.

### Pré-requisito: Secret `PANDA_PROFILE_ID`

O profile JDV precisa ser criado manualmente no painel do Panda Video (uma única vez). Após criação, o `profile_id` retornado será armazenado como secret do projeto para uso nas Edge Functions.

### Mudanças

#### 1. `supabase/functions/panda-sync/index.ts`

Após sincronizar os vídeos de cada pasta, fazer um `POST` para `https://api-v2.pandavideo.com/profiles/?type=set-videos` atribuindo o profile a todos os `video_ids` sincronizados. Usa a env `PANDA_PROFILE_ID`. Se não configurada, pula a atribuição (não bloqueia sync). Loga resultado no console.

#### 2. `supabase/functions/panda-webhook/index.ts`

No handler de `video.created`, após inserir a aula, fazer `POST` para atribuir o profile ao vídeo recém-criado usando o mesmo endpoint.

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/panda-sync/index.ts` | Após loop de vídeos, bulk-assign profile via API |
| `supabase/functions/panda-webhook/index.ts` | No `video.created`, assign profile ao vídeo |

### Sem mudanças no banco

Não é necessário criar tabela `panda_profiles` — o `profile_id` fica como secret. Não é necessário adicionar coluna `panda_profile_id` na tabela `aulas` — o profile é gerenciado no lado do Panda.

### Sem mudanças no frontend

Nenhuma outra tela ou componente será alterado.

