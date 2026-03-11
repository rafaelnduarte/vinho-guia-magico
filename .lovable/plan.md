

## Plano: Ordenar aulas A-Z + remover extensão .mp4

Duas mudanças no `src/pages/CursoDetailPage.tsx`:

| Mudança | Local |
|---------|-------|
| Ordenar por `titulo` em vez de `sort_order` | Linha 42: `.order("sort_order")` → `.order("titulo", { ascending: true })` |
| Remover extensões de arquivo do título exibido | Linha 102: adicionar função `sanitizarTitulo()` que remove `.mp4`, `.mkv`, etc. |

### Função utilitária (adicionada no mesmo arquivo):

```typescript
function sanitizarTitulo(titulo: string): string {
  return titulo.replace(/\.(mp4|mkv|avi|mov|flv|webm|m4v)$/i, "").trim();
}
```

### Aplicação na renderização (linha 102):

```typescript
// Antes:
<p className="...">{aula.titulo}</p>

// Depois:
<p className="...">{sanitizarTitulo(aula.titulo)}</p>
```

Nenhum outro arquivo ou página alterado.

