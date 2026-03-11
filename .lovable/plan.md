

## Plano: Ordenação natural (numérica) das aulas

### Diagnóstico
O problema **não é um bug** — é que a ordenação alfabética pura trata "Módulo 10" como vindo antes de "Módulo 2" (comparação caractere a caractere: "1" < "2"). As outras pastas funcionam porque não têm numeração no título.

### Solução
Usar `localeCompare` com `{ numeric: true }` no client-side para ordenação natural. Isso faz "Módulo 2" vir antes de "Módulo 10" automaticamente.

### Mudança

| Arquivo | Ação |
|---------|------|
| `src/pages/CursoDetailPage.tsx` | Adicionar `.sort()` client-side com `localeCompare({ numeric: true })` após receber os dados |

```typescript
// Após receber aulasRes.data, ordenar com natural sort:
setAulas(
  (aulasRes.data ?? [])
    .map((a) => ({ ...a, concluido: completedSet.has(a.id) }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR', { numeric: true }))
);
```

Isso garante:
- "Módulo 1" → "Módulo 2" → ... → "Módulo 15" (ordem numérica correta)
- Pastas sem números continuam em ordem A-Z normal
- Zero impacto nas outras páginas

