

## Implementar Seção "Indicadores de Consumo (KPIs)" no Admin Analytics

### Análise dos Dados Disponíveis

A tabela `progresso` tem 9 registros, com campos: `posicao_segundos`, `concluido`, `concluido_at`, `curso_id`, `aula_id`, `user_id`, `updated_at`. Combinando com `aulas` (duracao_segundos, titulo) e `cursos` (titulo), podemos computar a maioria dos KPIs solicitados.

**KPIs viáveis com dados existentes:** 1, 2, 3, 4, 5, 6, 7, 10 (parcial via timestamps), 11, 12, 14, 15.
**KPIs que requerem tracking adicional (sem dados hoje):** 8 (rewatch — sem contagem de plays), 9 (dispositivo — sem dados de device), 13 (sessões — sem session tracking). Estes serão exibidos como "Dados insuficientes" com nota explicativa.

### Arquitetura

Criar um componente separado `AdminConsumptionKPIs.tsx` para manter o arquivo atual limpo. Importá-lo no `AdminAnalytics.tsx` após a seção "Últimos Acessos".

### Componente: `src/components/admin/AdminConsumptionKPIs.tsx`

**Queries (todas client-side via React Query):**
1. Fetch `progresso` (all rows — admin RLS allows it)
2. Fetch `aulas` (with `curso_id`, `titulo`, `duracao_segundos`)
3. Fetch `cursos` (with `titulo`)
4. Reuse profiles data (passed as prop from parent)

**Computed KPIs:**

| KPI | Cálculo |
|---|---|
| Taxa de Conclusão dos Cursos | Para cada (user, curso): % aulas concluídas. Média global. |
| Conclusão por Aula | count(concluido=true) / count(total users who started) per aula. Top 5 piores. |
| Tempo Médio Assistido | avg(posicao_segundos) por aula |
| % Médio Assistido | avg(posicao_segundos / duracao_segundos) * 100 |
| Tempo Total Assistido | sum(posicao_segundos) de todo progresso |
| Drop-off Time | avg(posicao_segundos) where concluido=false |
| Aulas com Maior Abandono | Aulas com menor taxa de conclusão |
| Heatmap de Horários | Distribuição de updated_at por hora do dia (barras) |
| Aulas Mais Assistidas | Ranking por sum(posicao_segundos) |
| DAU/WAU/MAU | Distinct users em progresso.updated_at por dia/semana/mês |
| Course Pace Index | avg(diff entre concluido_at de aulas consecutivas por user) |
| Funil de Consumo | Por curso: acessou → iniciou aula 1 → concluiu aula 1 → ... |

**Layout (abaixo de "Últimos Acessos"):**

1. **Heading**: "Indicadores de Consumo (KPIs)"
2. **Cards grid** (6 cols): Taxa Conclusão, Tempo Total, % Médio Assistido, DAU, WAU, MAU
3. **Rankings grid**: Aulas menos concluídas (top 5), Aulas mais assistidas, Aulas com maior abandono
4. **Gráficos**: Heatmap de horários (bar chart via Recharts), Funil de consumo (horizontal bars)
5. **Tabela detalhada**: Aula | Curso | % conclusão | Tempo médio | Drop-off | Total minutos

### Alterações em `AdminAnalytics.tsx`

- Importar `AdminConsumptionKPIs`
- Passar `profileMap` e `adminUserIds` como props
- Renderizar após a seção "Últimos Acessos" (linha 395)

### Arquivos Modificados

1. **Novo**: `src/components/admin/AdminConsumptionKPIs.tsx` — componente completo com queries, cálculos e UI
2. **Editado**: `src/components/admin/AdminAnalytics.tsx` — importar e renderizar o novo componente

### Limitações Documentadas

KPIs 8 (Rewatch Rate), 9 (Engajamento por Dispositivo) e 13 (Sessões por Aluno) serão exibidos como cards cinza com mensagem "Requer tracking adicional" — sem dados de device/session/play-count no schema atual.

