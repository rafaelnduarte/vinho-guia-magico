
Plano definitivo para corrigir o DRM/JWT/Player Panda no JDV (sem alterar outras áreas)

1) Diagnóstico do estado atual (já verificado no código)
- `panda-token` já não usa JWT local, mas ainda está focado em `/drm/videos/{groupId}/jwt` e em estratégia de compatibilidade antiga.
- `PandaPlayer` já usa `jwt=` corretamente, porém:
  - não valida `config.json` antes de carregar o player,
  - ainda entra em fallback HLS automático mesmo em cenários de token/DRM inválido.
- Já existe ação `assign_drm` no diagnóstico, mas apenas por vídeo individual (não “todos os vídeos”).

2) Ajustes de backend (edge functions)

2.1 `supabase/functions/panda-token/index.ts` (reescrita completa da lógica)
- Manter autenticação do usuário (como já está).
- Remover qualquer resquício de assinatura local (confirmado: não há hoje, manter assim).
- Implementar fluxo oficial priorizando endpoint de Watermark Group:
  - Tentativa principal:
    - `GET https://api.pandavideo.com/watermark/groups/{DRM_GROUP_ID}/jwt?expiredAtJwt={exp}`
    - `Authorization: Bearer {PANDA_API_KEY}`
  - Compatibilidade automática (apenas se falha de autorização/rota):
    - sem `Bearer`
    - rota equivalente `/drm/videos/{groupId}/jwt`
    - fallback de host (`api-v2...`) se necessário
- Retorno padrão:
  - sucesso: `{ token: data.jwt }`
  - falha: `{ token: null }`
- Logs objetivos por tentativa (status + endpoint) para rastreio.

2.2 `supabase/functions/panda-diagnostics/index.ts`
- Fortalecer `assign_drm` para usar padrão compatível de auth (Bearer + fallback) e hosts compatíveis.
- Adicionar ação nova `assign_drm_all`:
  - buscar todos `panda_video_id` válidos em `aulas` (via service role),
  - fazer `PUT /videos/{id}` com `{ drm_group_id: <group_secret> }`,
  - retornar resumo: total, sucesso, falhas, ids com erro.
- (Opcional no mesmo endpoint) adicionar ação `check_config` para validar `config.json` server-side por vídeo + jwt, evitando limitação de CORS no browser.

3) Ajustes de frontend admin

3.1 `src/components/admin/AdminPandaDiagnostics.tsx`
- Manter botão atual de associação por vídeo.
- Adicionar botão “Associar TODOS ao DRM Group” (dispara `assign_drm_all`).
- Exibir relatório claro de sucesso/falhas por lote.
- (Se implementar `check_config`) adicionar ação de validação de `config.json` no próprio painel.

4) Ajustes de player (bloquear fluxo inválido)

4.1 `src/components/cursos/PandaPlayer.tsx`
- Manter `jwt=` (já correto).
- Antes de renderizar iframe, validar `config.json`:
  - construir URL de config com o `videoId` e `jwt`,
  - exigir HTTP 200 para liberar render do player.
- Se config falhar:
  - mostrar erro explícito de DRM/JWT (não mascarar como “vídeo em processamento”),
  - tentar reobter token 1x e revalidar config.
- Ajustar fallback:
  - não cair automaticamente para HLS quando o erro for de autorização/config (404/401/403),
  - usar fallback HLS apenas em falhas técnicas de reprodução após config válido.

5) Escopo e segurança
- Sem mudanças de banco/migração.
- Sem mudanças em autenticação global.
- Sem mexer em outras features fora do fluxo Panda.
- Sem JWT local, sem `jose`, sem `jsonwebtoken`.

6) Validação obrigatória (fim-a-fim)
- Pré-condição: usuário logado no preview (atualmente está em `/login`).
- Teste técnico:
  1. Abrir uma aula com `panda_video_id`.
  2. Confirmar request `config.tv.pandavideo.com.br/.../{VIDEO_ID}.json` com status 200.
  3. Reproduzir além de 6 segundos (confirmar playback contínuo).
  4. No admin, executar “Associar TODOS” e validar resumo sem falhas críticas.
- Critérios de aceite:
  - `config.json` = 200,
  - reprodução integral sem corte de 6s,
  - token retornado pelo Panda (não local),
  - vídeo(s) associados ao grupo DRM.

Detalhes técnicos (resumo)
- Endpoint preferencial JWT: `/watermark/groups/{groupId}/jwt`.
- Endpoint equivalente de compatibilidade: `/drm/videos/{groupId}/jwt`.
- Query de expiração: `Math.floor(Date.now()/1000) + 3600`.
- Param do player: `jwt` (somente esse).
