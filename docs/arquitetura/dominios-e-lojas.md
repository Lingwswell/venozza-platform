# Rede pelo domínio, loja pela localização

## Como o app descobre a rede (tenant)

Cada requisição pública (`/api/catalog`, `/api/stores`, `/api/products`, `POST /api/orders`)
resolve a rede pelo domínio acessado (`src/lib/tenant/resolve.ts`), nesta ordem:

1. Domínio cadastrado na tabela `tenant_domains` (ex.: `pedidos.venozza.com.br`).
2. Subdomínio da plataforma: `<slug-da-rede>.<PLATFORM_ROOT_DOMAIN>`.
3. `DEFAULT_TENANT_SLUG` do `.env` (útil no laboratório, acessando por IP).
4. Se só existe uma rede ativa, ela.

Variáveis opcionais no `.env`:

```
PLATFORM_ROOT_DOMAIN=suaplataforma.com.br
DEFAULT_TENANT_SLUG=venozza
```

Cadastro de domínios (até existir a tela "Redes" do super_admin):

```
npx tsx scripts/tenant-domain.ts list
npx tsx scripts/tenant-domain.ts add venozza pedidos.venozza.com.br
npx tsx scripts/tenant-domain.ts remove pedidos.venozza.com.br
```

Uma loja de outra rede nunca é aceita: catálogo, produtos e pedido conferem que a loja
pertence à rede do domínio.

## Como o app escolhe a loja

- Primeira visita: `StorePicker` pede a localização do celular e escolhe a loja mais perto
  que entrega no local (`/api/stores?lat=&lng=`). Se a rede tem uma loja só, escolhe direto.
- Sem permissão de localização, ou sem HTTPS: o cliente escolhe na lista.
- A escolha fica salva no navegador; o cliente troca pelo nome da loja no topo.
- Páginas internas (produto, carrinho, checkout) sem loja escolhida voltam para `/m`.

**Navegadores só liberam a localização em HTTPS** (ou `localhost`). Acessando por
`http://192.168.x.x` a lista aparece, mas sem distância.

## Cadastro das lojas

Admin → Lojas: endereço, coordenadas (copiadas do Google Maps), raio de entrega e ativa/desativada.
Nova loja pode copiar o cardápio de outra loja da rede.

## Pendências conhecidas

- O raio de entrega só informa ("fora da área"); o checkout ainda não bloqueia por endereço,
  porque o endereço do pedido é texto livre (sem coordenadas).
- Tela "Redes" do super_admin para cadastrar redes e domínios.

## CEP automático

No cadastro da loja, ao digitar o CEP o admin chama `/api/admin/address-lookup`, que busca
rua/bairro/cidade/UF no ViaCEP e a localização no OpenStreetMap (Nominatim). Ao preencher o
número, a localização é refinada. O servidor precisa de acesso à internet para isso.

## Publicar uma versão

```
bash scripts/deploy.sh
```
Faz backup, migrations, prisma generate, build e reinicia o `venozza-web`.
