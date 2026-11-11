# Papéis e acessos

Fonte única: `src/lib/auth/roles.ts` (papéis e permissões) e `src/lib/auth/scope.ts`
(escopo calculado no servidor a partir do token + banco).

| Papel | Lojas | Pode |
|---|---|---|
| `super_admin` | todas da rede | tudo; futuro painel global de redes |
| `owner` (dono da rede / franqueadora) | todas da rede | cardápio, lojas, usuários, monitor, relatórios, configurações |
| `franchisee` (franqueado) | as dele (`user_stores`) | monitor, relatórios, equipe (gerente/operador), configurações e disponibilidade das lojas dele |
| `manager` (gerente) | as dele | KDS, pedidos, disponibilidade/estoque, configurações, operadores |
| `operator` | as dele | KDS e pedidos; abrir/fechar a loja |
| `kitchen_operator` | cozinha central | KDS da cozinha central (entrega 2) |

Regras:
- Nunca usar cabeçalhos do navegador (`x-user-role`, `x-tenant-id`, `x-store-id`) para dar permissão.
- Usuário ou rede desativados perdem o acesso na hora (o token é conferido no banco a cada requisição).
- A rede precisa manter pelo menos um dono ativo.
- Ninguém altera o próprio papel, lojas ou status.
- Produto pertence à rede (`Product.tenantId`); preço, estoque, disponibilidade e destaque são por loja (`ProductStore`).
- Usuário de loja edita só a parte da loja de um produto; o cadastro central é do dono da rede.

Rotas novas: `/api/admin/users`, `/api/admin/users/[id]`, `/api/admin/monitor`.
Telas novas: Admin → Usuários, Admin → Monitor.
