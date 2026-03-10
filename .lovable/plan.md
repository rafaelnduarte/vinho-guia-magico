

## Plano: White Label Panda Video Player

### Resumo

Criar sistema completo de visualização de cursos/aulas para membros, com player Panda Video embarcado via iframe (abordagem real do Panda), tracking de progresso e navegação entre aulas.

**NÃO altere nenhuma outra tela ou componente** além dos listados abaixo.

---

### Arquitetura de Rotas

```text
/cursos                           → Grid de cursos publicados
/cursos/:cursoId                  → Lista de aulas do curso
/cursos/:cursoId/aula/:aulaId     → Player + navegação
```

### Mudanças

#### 1. Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/components/cursos/PandaPlayer.tsx` | Wrapper de iframe Panda 16:9 responsivo. Constrói URL com `panda_video_id` e query params. Escuta `postMessage` do iframe para progresso. |
| `src/pages/CursosPage.tsx` | Grid de cursos com `is_published = true`. Cards com título, contagem de aulas, progresso do usuário. |
| `src/pages/CursoDetailPage.tsx` | Lista de aulas publicadas do curso, ordenadas por `sort_order`. Mostra duração, status de conclusão. |
| `src/pages/AulaPage.tsx` | Player Panda + barra de progresso + info da aula + botões Anterior/Próxima. Upsert de progresso na tabela `progresso` a cada 30s. Marca `concluido` quando >90%. |

#### 2. Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Adicionar 3 rotas protegidas: `/cursos`, `/cursos/:cursoId`, `/cursos/:cursoId/aula/:aulaId` |
| `src/components/AppLayout.tsx` | Adicionar link "Cursos" no `memberLinks` (ícone `GraduationCap`, entre Curadoria e Ranking) |

#### 3. Sem Mudanças no Banco

Tabelas existentes (`cursos`, `aulas`, `progresso`) já possuem os campos necessários. RLS existente cobre acesso de membros a conteúdo publicado.

### Detalhes do Player

- Iframe apontando para `https://player-vz-*.pandavideo.com.br/embed/?v={panda_video_id}`
- Query params: `autoplay=false`, `loop=false`, `playsinline=true`
- Container responsivo 16:9 com fundo escuro e bordas arredondadas
- Escuta eventos `postMessage` do iframe para capturar progresso

### Tracking de Progresso

- No mount: busca última posição do `progresso`, passa como `start` param
- A cada 30s: upsert `posicao_segundos` e `percentual`
- Ao atingir >90%: `concluido = true`, toast de parabéns, habilita botão "Próxima Aula"

