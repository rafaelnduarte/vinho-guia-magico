

## Plano: Criar Ferramenta de Diagnóstico Panda Video

### Resumo
Criar uma Edge Function `panda-diagnostics` e adicionar uma aba/seção no painel Admin para diagnosticar problemas de reprodução de vídeos do Panda Video.

### Mudanças

| Arquivo | Ação |
|---------|------|
| `supabase/functions/panda-diagnostics/index.ts` | Nova Edge Function que consulta a API do Panda para verificar status, qualidades e configuração do vídeo |
| `src/components/admin/AdminPandaDiagnostics.tsx` | Novo componente com input de video ID, botão de diagnóstico e exibição de resultados |
| `src/pages/AdminPage.tsx` | Adicionar aba "Diagnóstico" ao painel Admin |
| `supabase/config.toml` | NÃO editar (deploy automático) |

### Edge Function `panda-diagnostics`

- Auth: verifica JWT + role admin via `has_role`
- Recebe `{ video_id }` via POST
- Consulta `GET /videos/{video_id}` na API Panda (sem prefixo Bearer, conforme memory)
- Retorna: status do vídeo, duração, qualidades disponíveis, profile_id
- Consulta Supabase para verificar se a aula existe e está publicada
- CORS headers padrão

### Componente Admin

- Input para colar o `panda_video_id`
- Botão "Diagnosticar"
- Exibe resultados em cards coloridos (verde = OK, amarelo = warning, vermelho = erro)
- Mostra JSON bruto em `<details>` colapsável
- Usa `supabase.functions.invoke("panda-diagnostics", { body: { video_id } })`

### Integração no Admin

- Nova aba "Diagnóstico" no `AdminPage.tsx` entre as abas existentes

