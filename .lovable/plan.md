

## Plano: Corrigir 2 problemas de sync Panda → JDV

### Problema 1: Aulas deletadas no Panda ficam órfãs no Radar
### Problema 2: Campo `description` do Panda não é sincronizado para `descricao` das aulas

---

### Mudanças

#### 1. Criar tabela `sync_orphans` (migração SQL)
Tabela de auditoria para registrar aulas órfãs detectadas durante a sincronização.

```sql
CREATE TABLE IF NOT EXISTS public.sync_orphans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL,
  panda_video_id text NOT NULL,
  titulo text NOT NULL,
  curso_id uuid,
  status text DEFAULT 'detected',
  detected_at timestamptz DEFAULT now(),
  action_taken_at timestamptz,
  action_type text
);

ALTER TABLE public.sync_orphans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sync_orphans"
  ON public.sync_orphans FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_orphans_status ON public.sync_orphans(status);
CREATE INDEX idx_orphans_detected_at ON public.sync_orphans(detected_at);
```

#### 2. Atualizar `panda-sync/index.ts`
Duas mudanças no mesmo arquivo:

**2a. Sincronizar `description`** — Linha 190, trocar `descricao: ""` por `descricao: video.description || detail?.description || ""` (capturar do detail fetch que já existe).

**2b. Detecção de órfãos** — Após o loop de folders (após linha 208), para cada curso sincronizado: comparar os `panda_video_id` vindos do Panda com os existentes no DB para aquele `curso_id`. Aulas no DB cujo `panda_video_id` não existe mais no Panda são marcadas como `is_published: false, status: 'orphaned'` e registradas na tabela `sync_orphans`. Escopo por curso (não global) para evitar falsos positivos em sync parcial.

Resultado retornado incluirá `orphans_detected` e `orphans_unpublished`.

#### 3. Atualizar `panda-webhook/index.ts`
**3a. `video.created`** — Incluir `descricao: video.description || ""` no insert (linha 60-66).

**3b. `video.deleted`** — Além de despublicar (linha 132-139), também marcar `status: 'orphaned'` e registrar na `sync_orphans`.

#### 4. Deploy
Redeployar ambas edge functions: `panda-sync` e `panda-webhook`.

---

### Arquivos alterados
- `supabase/functions/panda-sync/index.ts` — description sync + detecção de órfãos
- `supabase/functions/panda-webhook/index.ts` — description no insert + orphan logging no delete
- Nova migração SQL — tabela `sync_orphans` com RLS

### O que NÃO será alterado
- Nenhum arquivo frontend
- Nenhuma outra edge function
- Nenhuma outra tabela ou trigger existente

