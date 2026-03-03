

## Plano: Garantir contas admin com senha "Teste123"

### Problema
Três contas admin não conseguem logar. Preciso garantir que existam no sistema de autenticação com a senha correta e tenham role `admin` + membership ativa.

### Abordagem

Vou criar uma **edge function temporária** (`ensure-admins`) que, usando o service role:

1. Para cada um dos 3 emails (`dominique.biniou@`, `gabriel.duarte@`, `thomas@`):
   - Busca o usuário na autenticação
   - Se não existir, cria com email confirmado
   - Define a senha como `Teste123`
   - Garante que existe um registro em `profiles` com o nome correto
   - Garante que existe `user_roles` com role `admin`
   - Garante que existe `memberships` com status `active`

2. Retorna um relatório de quais contas foram criadas vs atualizadas

### Contas a garantir

| Email | Nome | Role | Senha |
|-------|------|------|-------|
| dominique.biniou@jovemdovinho.com.br | Dominique Biniou | admin | Teste123 |
| gabriel.duarte@jovemdovinho.com.br | Gabriel Duarte | admin | Teste123 |
| thomas@jovemdovinho.com.br | Thomas | admin | Teste123 |

### Detalhes técnicos

- A edge function `admin-members` já tem a action `set_password`, mas requer autenticação de admin. Vou criar uma função dedicada que roda com service role diretamente.
- Após execução e confirmação, a função temporária pode ser removida.
- Usa `adminClient.auth.admin.listUsers()` para encontrar usuários existentes e `updateUserById` para redefinir senhas.

### Arquivo modificado/criado
- `supabase/functions/ensure-admins/index.ts` (nova, temporária)

