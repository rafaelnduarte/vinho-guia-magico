

## Plano: Fluxo de Onboarding Completo

### Resumo

Implementar um fluxo de onboarding em 4 etapas: (1) senha padrão = email, (2) troca obrigatória de senha no primeiro acesso, (3) popup de onboarding em 3 passos (boas-vindas/PWA, perfil, explicação curadoria vs acervo), (4) redirecionamento à Home.

---

### Detalhes Técnicos

#### 1. Banco de dados

Adicionar duas colunas à tabela `profiles`:
- `must_change_password` (boolean, default `true`) — força troca de senha no primeiro login
- `onboarding_completed` (boolean, default `false`) — controla exibição do popup de onboarding

#### 2. Senha padrão = email

Alterar os dois pontos de criação de usuário:
- **`hubla-webhook/index.ts`** (linha 263): trocar `crypto.randomUUID() + "Aa1!"` por `email.toLowerCase()`
- **`admin-members/index.ts`** (linha 154): trocar `crypto.randomUUID() + "Aa1!"` por `email.toLowerCase()` (quando `password` não é fornecido)

#### 3. Tela de troca obrigatória de senha

Criar **`src/pages/ForceChangePasswordPage.tsx`**:
- Tela simples: "Sua senha inicial é seu email. Crie uma nova senha para continuar."
- Campos: nova senha + confirmação (mín. 6 chars)
- Ao salvar: `supabase.auth.updateUser({ password })` + atualizar `profiles.must_change_password = false`
- Redireciona para `/` (onde o onboarding popup será exibido)

Alterar **`ProtectedRoute.tsx`**:
- Após verificar `user` e `membershipActive`, consultar `profiles.must_change_password`
- Se `true`, redirecionar para `/trocar-senha` em vez de renderizar children

Adicionar rota `/trocar-senha` no **`App.tsx`** (fora do `ProtectedRoute`, mas requer autenticação básica).

#### 4. Popup de Onboarding (3 passos)

Criar **`src/components/OnboardingDialog.tsx`**:
- Dialog/modal com stepper (1/3, 2/3, 3/3)
- **Passo 1 — Boas-vindas + PWA**: Texto de boas-vindas + instruções visuais para adicionar à tela inicial (iOS: Safari → Compartilhar → "Adicionar à Tela de Início"; Android: Chrome → menu → "Adicionar à tela inicial")
- **Passo 2 — Perfil**: Upload de avatar, campo de nome, campo de bio (140 chars) — reutilizando a mesma lógica do `MyAccountPage`
- **Passo 3 — Curadoria vs Acervo**: Explicação visual das duas seções. Curadoria = vinhos disponíveis para compra no Brasil hoje. Acervo = vinhos históricos, de viagens, safras antigas, não mais disponíveis.
- Botão final "Ir para a Home" → atualiza `profiles.onboarding_completed = true` e fecha o dialog

Integrar no **`HomePage.tsx`** (ou `AppLayout.tsx`):
- Ao montar, verificar `profiles.onboarding_completed`
- Se `false`, abrir `OnboardingDialog`

#### 5. Arquivos modificados/criados

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar `must_change_password` e `onboarding_completed` à `profiles` |
| `hubla-webhook/index.ts` | Senha = email |
| `admin-members/index.ts` | Senha = email (fallback) |
| `src/pages/ForceChangePasswordPage.tsx` | Criar |
| `src/components/OnboardingDialog.tsx` | Criar |
| `src/components/ProtectedRoute.tsx` | Adicionar check `must_change_password` |
| `src/contexts/AuthContext.tsx` | Adicionar `mustChangePassword` e `onboardingCompleted` ao contexto |
| `src/App.tsx` | Adicionar rota `/trocar-senha` |
| `src/pages/HomePage.tsx` ou `src/components/AppLayout.tsx` | Montar OnboardingDialog |

