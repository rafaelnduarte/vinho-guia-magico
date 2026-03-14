

## Diagnóstico: Por que os KPIs estão vazios

O componente `AdminConsumptionKPIs.tsx` está **funcionando corretamente** — as queries buscam dados reais das tabelas `progresso`, `aulas` e `cursos`. O problema é simples:

- Todos os 9 registros de `progresso` pertencem ao user `53d3c91d`
- Esse user é **admin**
- Linha 54 filtra admins: `filter((p) => !adminUserIds.has(p.user_id))`
- Resultado: **0 registros** → KPIs mostram "Nenhum dado de progresso encontrado"

As queries estão corretas. Não há tabela `progresso_aulas` — a tabela real é `progresso`. Não há necessidade de criar hooks separados, RPCs ou novas queries.

## Correção

Remover o filtro de admins do `AdminConsumptionKPIs`. Na tela de Analytics, o admin quer ver **todos** os dados de consumo, incluindo os próprios. O filtro de admins faz sentido para rankings competitivos, mas não para KPIs de consumo agregados.

### Arquivo: `src/components/admin/AdminConsumptionKPIs.tsx`

**Alteração única** — linha 53-56: usar `progressoRaw` diretamente em vez de filtrar admins:

```tsx
const progresso = useMemo(() => progressoRaw ?? [], [progressoRaw]);
```

Nenhuma outra alteração necessária. As queries já conectam corretamente `progresso` → `aulas` (via `aula_id`) → `cursos` (via `curso_id`), e todos os cálculos de KPIs usam dados reais.

