

## Finalizar Edge Function `panda-proxy` e Frontend `AdminCursos`

### 1. Reescrever `supabase/functions/panda-proxy/index.ts`

Código limpo e definitivo:
- Manter auth check do usuário (admin) como está
- Header para Panda: `Authorization: apiKey` (sem Bearer)
- Remover todas as variações de auth e logs de debug
- Extrair `rawData.folders` ou `rawData.videos` conforme resource
- Retornar erro 400 se resource inválido ou folder_id ausente para videos

### 2. Atualizar `src/components/admin/AdminCursos.tsx`

**Interface PandaVideo** — corrigir campos:
- `duration` → `length` (float, segundos)
- Remover `name` (não existe na API)
- Adicionar campos opcionais: `thumbnail`, `video_player`

**Interface PandaFolder** — `videos_count` como `string | number`

**Parsing de resposta** — a edge function já retorna array direto, então:
- Pastas: `json as PandaFolder[]` (sem `.folders`)
- Vídeos: `json as PandaVideo[]` (sem `.videos`)

**Tabela de vídeos**:
- Duração: usar `video.length` com `formatDuration`
- Status badge colorido:
  - `CONVERTED` → verde, label "Pronto"
  - `PROCESSING` → amarelo, label "Processando"
  - default → vermelho, label status original

**Badge de vídeos na pasta**: `parseInt(String(folder.videos_count))` para garantir número

### Arquivos alterados
1. `supabase/functions/panda-proxy/index.ts` — reescrita completa
2. `src/components/admin/AdminCursos.tsx` — interfaces e mapeamento de campos

Nenhum outro arquivo será alterado.

