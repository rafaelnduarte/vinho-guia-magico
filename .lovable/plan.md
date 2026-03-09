

## Plano: Trilha de Aulas — 6 Novas Tabelas + Secrets

### Resumo

O documento solicita a criação de **6 tabelas aditivas** para a funcionalidade de Trilha de Aulas com integração Panda Vídeo, além de **3 novos secrets**. Nenhuma tabela existente será modificada.

---

### 1. Migration SQL — 6 tabelas

Uma única migration criará, em ordem de dependência:

| Tabela | Colunas-chave | RLS Policies |
|--------|--------------|--------------|
| `cursos` | titulo, nivel, tipo, panda_folder_id, is_published | 2 (select membros + all admin) |
| `modulos` | curso_id (FK), titulo, sort_order | 2 (select membros + all admin) |
| `aulas` | modulo_id + curso_id (FK), panda_video_id, panda_quiz_id, duracao_segundos | 2 (select membros + all admin) |
| `matriculas` | user_id, curso_id (FK), progresso_pct, status | 4 (select/insert/update own + admin all) |
| `progresso` | user_id, aula_id/curso_id/modulo_id (FK), posicao_segundos, concluido | 4 (select/insert/update/upsert own + admin) |
| `downloads` | user_id, aula_id/curso_id (FK), panda_download_url, status | 5 (CRUD own + admin all) |

Cada tabela terá:
- RLS habilitado
- Trigger `update_updated_at_column()` (função já existente)
- Índices nos campos de FK relevantes

### 2. Secrets novos (3)

Serão solicitados ao usuário via ferramenta de secrets:
- **PANDA_API_KEY** — Chave da API do Panda Vídeo
- **PANDA_WEBHOOK_SECRET** — Token de validação de webhooks do Panda
- **N8N_WEBHOOK_URL** — URL do endpoint N8N para eventos

### 3. Observações

- A função `update_updated_at_column()` já existe no banco; o script usará `CREATE OR REPLACE` para segurança.
- Os campos `user_id` nas tabelas `matriculas`, `progresso` e `downloads` **não** terão FK para `auth.users` (seguindo o padrão do projeto).
- Nenhuma alteração de frontend nesta etapa — o documento indica que o próximo passo é criar a Edge Function `panda-webhook`.
- O `has_role` será chamado com `'admin'::app_role` (cast correto para o enum existente).

