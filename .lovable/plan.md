

# Historico de Vinhos no Radar do Jovem

## O Problema

Hoje a Curadoria mostra apenas vinhos com `is_published = true`, que representam vinhos disponíveis para compra. Vinhos de safras antigas, descontinuados ou não vendidos no Brasil ficam invisíveis.

## Solucao Proposta: Campo "status" no vinho + abas na Curadoria

A abordagem mais limpa e intuitiva: adicionar um campo `status` aos vinhos para distinguir entre **curadoria ativa** e **acervo historico**, e mostrar ambos na interface com separacao clara.

### Para o usuario final

A pagina de Curadoria ganha duas abas no topo:

```text
+--------------------+--------------------+
|   Curadoria (12)   |   Acervo (47)      |
+--------------------+--------------------+
```

- **Curadoria**: vinhos disponíveis atualmente (comportamento atual)
- **Acervo**: vinhos historicos -- safras antigas, vinhos importados que sairam do mercado, vinhos provados em viagem, etc.

Os cards do Acervo podem ter um badge sutil ("Historico") e os filtros funcionam igualmente em ambas as abas. A pagina de detalhe continua identica (com comentarios, votos e notas do Thomas).

### Para o admin

No formulario de vinho, o campo "Publicado" (switch) e substituido por um **select de status**:

- **Curadoria** (disponivel atualmente)
- **Acervo** (historico/review)
- **Rascunho** (nao visivel)

Isso permite que o admin mova vinhos entre curadoria e acervo facilmente, sem perder reviews e comentarios.

---

## Detalhes Tecnicos

### 1. Migracao de banco de dados

- Adicionar coluna `status` (text, default `'curadoria'`) na tabela `wines`
- Migrar dados existentes: `is_published = true` vira `status = 'curadoria'`, `is_published = false` vira `status = 'rascunho'`
- Atualizar a politica RLS para permitir leitura de vinhos com status `'curadoria'` ou `'acervo'` (ambos visiveis para membros ativos)
- A coluna `is_published` pode ser mantida temporariamente para compatibilidade ou removida

### 2. Pagina CuradoriaPage.tsx

- Adicionar parametro de URL `aba` (curadoria/acervo) via `useFilterParams`
- Componente de abas (Tabs do Radix) no topo, antes dos filtros
- Query ajustada: filtrar por `status` ao inves de `is_published`
- Contagem de vinhos por aba mostrada nos labels das abas

### 3. WineDetailPage.tsx

- Remover filtro `.eq("is_published", true)` e trocar por `.in("status", ["curadoria", "acervo"])`
- Mostrar badge "Acervo" no detalhe de vinhos historicos para sinalizar que pode nao estar disponivel

### 4. WineCard.tsx

- Prop opcional `isArchive` para mostrar badge visual sutil
- Sem mudancas estruturais no card

### 5. AdminWines.tsx

- Trocar switch "Publicado" por select com 3 opcoes (Curadoria / Acervo / Rascunho)
- Coluna de status na tabela com badges coloridos distintos
- Filtro de status na listagem admin

### 6. CSV Import

- Adicionar coluna `status` no mapeamento CSV (default: `curadoria`)

### 7. Sommelier AI (sommelier-chat)

- Incluir vinhos do acervo no contexto do chatbot para que ele possa recomendar e comentar sobre historico

