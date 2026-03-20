
## Plano: identificar exatamente a causa do “recarregamento”, corrigir de forma robusta e validar sem brechas

### O que já encontrei no código
- Não existe `window.location.reload`, service worker, PWA worker ou lógica explícita de recarga global.
- O ponto mais suspeito hoje é o fluxo global de autenticação em `src/contexts/AuthContext.tsx` + bloqueio em `src/components/ProtectedRoute.tsx`.
- Os logs de rede mostram consultas repetidas a `profiles`, `memberships` e `user_roles` ao voltar/alternar contexto. Isso é compatível com:
  1. remontagem do `AuthProvider`, ou
  2. rebootstrap completo da sessão, ou
  3. falso “reload” causado por retorno ao spinner da rota protegida.
- Há lógica de `visibilitychange`/`focus` em `src/pages/SommelierPage.tsx`, mas ela é localizada e não explica sozinha um problema global em todo o app.
- O `AdminPage` mantém só a aba `chat` montada com `forceMount`; as demais abas podem remontar ao trocar internamente, mas isso não deveria causar recarga total da aplicação.

### Objetivo
Eliminar definitivamente qualquer comportamento de:
- recarga real da página,
- remontagem global indevida da aplicação,
- retorno ao spinner de autenticação ao trocar de aba,
- perda de estado/posição/rota ao voltar do background.

### Estratégia de implementação

#### 1. Medição exata da causa antes da correção
Vou instrumentar o app para distinguir com prova objetiva estes cenários:
- **hard reload do documento**
- **remount do React root**
- **remount do AuthProvider**
- **apenas re-render**
- **troca para spinner da ProtectedRoute**
- **evento de auth/token refresh**
- **evento de visibilidade/foco do navegador**

Arquivos principais:
- `src/main.tsx`
- `src/App.tsx`
- `src/contexts/AuthContext.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/components/AppLayout.tsx`

Instrumentação prevista:
- `appBootId` persistido em `sessionStorage`
- contador de mounts do root/provider
- logs com timestamp para:
  - `pageshow`, `pagehide`, `visibilitychange`, `focus`
  - `getSession`
  - `onAuthStateChange`
  - entrada/saída de `loading` e `membershipLoading`
  - renderização do `ProtectedRoute`
- marcação se houve:
  - nova navegação do documento
  - mesmo documento com remount de componentes
  - apenas fallback visual

Resultado esperado desta etapa:
- saber **exatamente** se o problema é “reload real” ou “reset interno mascarado de reload”.

#### 2. Blindagem do bootstrap global de autenticação
Se o problema vier do pipeline global de auth, vou reestruturar o fluxo para separar:
- **bootstrap inicial** da aplicação
- **refresh silencioso de token**
- **revalidação de perfil/permissão**
- **sign-out real**

Correções previstas:
- impedir que eventos como `TOKEN_REFRESHED`, `SIGNED_IN` repetido ou re-hidratação de sessão reativem estados globais de loading
- deduplicar chamadas simultâneas de `getSession` + `onAuthStateChange`
- impedir que `ProtectedRoute` desmonte o app depois que a sessão já foi estabelecida
- manter os dados de acesso/perfil estáveis enquanto atualizações silenciosas acontecem em background

Arquivos:
- `src/contexts/AuthContext.tsx`
- `src/components/ProtectedRoute.tsx`

#### 3. Revisão sistemática de páginas que podem “parecer reload”
Vou auditar páginas e containers com maior chance de reset visual ao voltar da aba:
- `src/components/AppLayout.tsx`
- `src/pages/AdminPage.tsx`
- `src/pages/SommelierPage.tsx`
- `src/pages/HomePage.tsx`
- `src/pages/CursosPage.tsx`
- `src/pages/AulaPage.tsx`

Foco da revisão:
- efeitos que disparam `setLoading(true)` em toda remontagem
- listeners de `focus`/`visibilitychange`
- fetches que limpam estado antes de repopular
- componentes que desmontam conteúdo inteiro em vez de preservar último estado válido
- tabs e seções administrativas que podem recriar subárvores desnecessariamente

#### 4. Correção estrutural do comportamento em background
Depois de isolar a causa exata, a correção vai seguir este princípio:
- **o shell da aplicação nunca pode desmontar ao voltar da aba**
- **o usuário nunca deve perder rota nem contexto visual**
- **refresh silencioso deve ser invisível**
- **dados podem revalidar sem apagar a UI atual**

Isso pode incluir, conforme o diagnóstico final:
- travar fallback global apenas no primeiro bootstrap real
- manter último estado autenticado válido em memória enquanto a revalidação ocorre
- preservar subárvores críticas montadas
- trocar “loading destrutivo” por “refresh não bloqueante”
- endurecer páginas administrativas para não recriarem conteúdo ao recuperar foco

#### 5. Testes obrigatórios e evidência de correção
Vou validar em matriz completa, não só em um caso isolado.

Cenários:
- rota `/home`
- rota `/admin` em múltiplas abas internas
- rota `/sommelier`
- rota `/cursos`
- rota `/cursos/:cursoId/aula/:aulaId`

Sequência de testes:
1. abrir página
2. trocar de aba por 5s, 30s e 2min
3. voltar e confirmar:
   - mesma rota
   - mesma UI
   - sem spinner global
   - sem reset visual
   - sem perda de scroll/contexto
4. repetir com o navegador minimizado
5. repetir com foco alternando várias vezes
6. repetir em preview e versão publicada

Critérios de aceite:
- nenhum hard reload
- nenhum remount global indevido
- nenhum retorno ao loading screen após bootstrap inicial
- nenhuma perda de estado visível ao usuário
- logs mostrando somente refresh silencioso esperado, sem reinicialização completa

### Entrega esperada
Ao final, a correção não será “tentativa”; ela virá com:
- causa raiz identificada com evidência objetiva
- ajuste estrutural no fluxo global
- revisão dos pontos sensíveis
- validação prática em todas as telas críticas

### Detalhes técnicos
Arquivos mais prováveis de mudança:
- `src/contexts/AuthContext.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/components/AppLayout.tsx`
- `src/pages/AdminPage.tsx`
- `src/pages/SommelierPage.tsx`
- possivelmente páginas com loaders destrutivos (`HomePage`, `CursosPage`, `AulaPage`)

Sinais técnicos que sustentam o plano:
- consultas repetidas de auth/profile nos logs
- ausência de código explícito de reload
- problema aparentemente transversal, compatível com reset do gate global de autenticação
- existência de handlers de foco/visibilidade em áreas específicas, que precisam ser auditados mas não explicam sozinhos o sintoma global
