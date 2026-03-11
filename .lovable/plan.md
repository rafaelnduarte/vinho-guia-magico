

## Plano: Navegação com ordenação natural

O problema está em `src/pages/AulaPage.tsx` linhas 62-66: a query de siblings usa `.order("sort_order")` em vez de ordenação natural por título.

### Mudança

| Arquivo | Ação |
|---------|------|
| `src/pages/AulaPage.tsx` | Buscar `titulo` nos siblings, ordenar com `localeCompare` natural, e determinar prev/next a partir dessa lista |

### Detalhes

1. Alterar a query de siblings (linha 63) para incluir `titulo`: `.select("id, titulo")`
2. Remover `.order("sort_order")` da query
3. Ordenar client-side com `localeCompare('pt-BR', { numeric: true })` (mesmo padrão do `CursoDetailPage`)
4. Determinar prev/next a partir da lista ordenada naturalmente

```typescript
// Siblings query:
supabase
  .from("aulas")
  .select("id, titulo")
  .eq("curso_id", cursoId)
  .eq("is_published", true),

// Após receber:
const siblings = (siblingsRes.data ?? [])
  .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR', { numeric: true }));
const idx = siblings.findIndex((s) => s.id === aulaId);
setPrevAulaId(idx > 0 ? siblings[idx - 1].id : null);
setNextAulaId(idx < siblings.length - 1 ? siblings[idx + 1].id : null);
```

Nenhum outro arquivo alterado. ~5 linhas modificadas.

