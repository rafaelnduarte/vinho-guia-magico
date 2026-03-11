

## Plano: Adicionar JWT ao Player Panda Video

### Contexto

Ja existe uma Edge Function `panda-token` que gera JWTs assinados com `PANDA_SECRET_KEY`. Porem o `PandaPlayer.tsx` **nao usa esse JWT** -- monta a URL do iframe sem autenticacao. Isso pode causar rejeicao silenciosa pelo Panda em videos protegidos.

A memoria do projeto diz "Autenticacao JWT desativada para evitar conflitos de DRM", mas o erro persistente sugere que precisamos **reativar** o JWT no player.

### Abordagem Pragmatica

O prompt do usuario propoe criar watermark groups, user tokens, enrollment tables, audit logs -- mas isso duplica infraestrutura existente (`matriculas`, `progresso`) e depende de endpoints da API Panda que podem nao existir exatamente como descritos. 

**Plano focado:** Usar a `panda-token` function que ja existe para injetar o JWT na URL do iframe.

### Mudancas

| Arquivo | Acao |
|---------|------|
| `src/components/cursos/PandaPlayer.tsx` | Buscar JWT via `panda-token` antes de montar iframe; passar `&token=` na URL |
| `src/pages/AulaPage.tsx` | Passar `cursoId` ao PandaPlayer (ja passa `userId` e `aulaId`) |

### Detalhes Tecnicos

**PandaPlayer.tsx:**
1. Adicionar prop `cursoId` (opcional, para contexto)
2. No `useEffect` do `pandaVideoId`, chamar `supabase.functions.invoke("panda-token", { body: { video_id: pandaVideoId, aula_id: aulaId } })`
3. Guardar o JWT em state
4. Montar URL do iframe com `&token=${jwt}` quando disponivel
5. Se a chamada falhar, continuar sem JWT (fallback atual)
6. Mostrar loading enquanto busca o token

**HLS fallback:** Tambem incluir `?token=${jwt}` na URL do m3u8 se disponivel.

**Nenhuma tabela nova.** Nenhuma Edge Function nova. Usa infraestrutura existente.

### Nota sobre Watermark/DRM

Se apos adicionar o JWT os erros persistirem, o problema e no lado do Panda (video nao processado, sem qualidades, download server). A ferramenta de diagnostico ja criada (`panda-diagnostics`) ajuda a identificar isso. Watermark groups e DRM sao funcionalidades avanccadas que podem ser adicionadas depois se necessario, mas nao sao a causa raiz do erro atual.

