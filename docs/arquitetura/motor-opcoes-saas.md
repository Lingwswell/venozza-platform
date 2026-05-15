# VenoZza — Motor SaaS de Opções de Produto

## Objetivo

Transformar a montagem de produtos em um motor genérico, configurável pelo Admin, sem ficar preso apenas ao nicho de pizzaria.

O VenoZza deve ser um core SaaS multiempresa/multiloja para food/order management.

Pizza é o primeiro vertical de validação, mas o motor precisa servir para:

- Pizzaria
- Hamburgueria
- Açaí
- Cafeteria
- Marmitaria
- Mercado
- Restaurante
- Lanchonete
- Delivery personalizado

---

## Estado atual

Hoje o sistema já possui:

- Produto por loja via ProductStore
- Preço por loja
- Estoque por loja
- Disponibilidade por loja
- Categorias administráveis
- Upload de imagem no Admin Produtos
- Montagem de pizza no mobile
- Montagem de batata no mobile
- Bebidas agrupáveis
- Carrinho com addons
- Pedido salvando size, crust e addons_json
- Servidor recalculando preço com segurança

Hoje as opções estão centralizadas temporariamente em:

src/lib/product-customizations.ts

Isso é bom para reduzir duplicidade, mas ainda não é SaaS definitivo.

---

## Problema atual

As opções ainda estão em código.

Exemplos:

- Tamanho da pizza
- Borda
- Massa
- Bebida extra
- Recheio da batata

O dono da loja ainda não consegue criar/editar essas opções pelo painel.

---

## Princípio de segurança

O cliente nunca deve ser dono do preço.

O front pode exibir e enviar escolhas, mas o servidor deve recalcular o preço final usando dados confiáveis do banco.

Regra:

- Front envia produto e opções escolhidas
- Servidor consulta banco
- Servidor valida opções permitidas
- Servidor calcula preço final
- Pedido grava preço final seguro

---

## Modelagem SaaS proposta

### OptionGroup

Representa um grupo de escolha.

Exemplos:

- Tamanho
- Borda
- Massa
- Complementos
- Bebidas
- Coberturas
- Tipo de leite
- Molhos
- Proteína
- Guarnição

Campos sugeridos:

- id
- tenantId
- name
- slug
- description
- type
- required
- minSelect
- maxSelect
- sortOrder
- active
- createdAt
- updatedAt

Exemplo:

Grupo: Bordas
required: false
minSelect: 0
maxSelect: 1

Grupo: Complementos do açaí
required: false
minSelect: 0
maxSelect: 5

Grupo: Tamanho
required: true
minSelect: 1
maxSelect: 1

---

### OptionItem

Representa cada opção dentro de um grupo.

Exemplos:

- 40cm
- Borda Catupiry
- Massa Integral
- Bacon
- Banana
- Leite sem lactose
- Frango
- Arroz
- Feijão

Campos sugeridos:

- id
- tenantId
- optionGroupId
- name
- slug
- description
- price_cents
- active
- sortOrder
- createdAt
- updatedAt

---

### ProductOptionGroup

Vincula grupos de opções a produtos específicos.

Exemplo:

Produto: Pizza Calabresa
Grupos:
- Tamanho
- Borda
- Massa
- Bebidas extras

Produto: Hambúrguer X-Bacon
Grupos:
- Ponto da carne
- Queijo
- Molhos
- Adicionais

Campos sugeridos:

- id
- tenantId
- productId
- optionGroupId
- sortOrder
- active

---

### CategoryOptionGroup

Vincula grupos a categorias.

Exemplo:

Categoria: Pizza
Grupos padrão:
- Tamanho
- Borda
- Massa

Categoria: Açaí
Grupos padrão:
- Tamanho
- Frutas
- Coberturas

Isso evita ter que configurar produto por produto.

Campos sugeridos:

- id
- tenantId
- categorySlug
- optionGroupId
- sortOrder
- active

---

### StoreOptionAvailability

Controla disponibilidade de opções por loja.

Exemplo:

Loja Centro tem Borda Catupiry.
Loja Grajaú não tem Borda Catupiry.

Campos sugeridos:

- id
- tenantId
- storeId
- optionItemId
- available
- stock
- price_cents_override
- createdAt
- updatedAt

Isso permite:

- Estoque de adicional por loja
- Preço diferente por loja
- Desativar opção em uma loja específica

---

## Fluxo ideal no Mobile

1. Cliente abre produto
2. API retorna produto + grupos de opções
3. Front monta a tela dinamicamente
4. Cliente escolhe opções
5. Carrinho salva IDs das opções escolhidas
6. Checkout envia item com selectedOptions
7. Servidor recalcula preço pelo banco
8. Pedido salva snapshot legível das escolhas

---

## Formato futuro do item enviado ao pedido

Exemplo:

{
  "id": "produto_id",
  "quantity": 1,
  "selectedOptions": [
    {
      "optionGroupId": "grupo_tamanho",
      "optionItemId": "item_40cm"
    },
    {
      "optionGroupId": "grupo_borda",
      "optionItemId": "item_catupiry"
    }
  ],
  "note": "sem cebola"
}

---

## Formato futuro salvo no pedido

O pedido deve salvar snapshot, não depender de buscar a opção depois.

Exemplo:

addons_json:
[
  {
    "group": "Tamanho",
    "item": "Pizza Família - 40cm",
    "price_cents": 2000
  },
  {
    "group": "Borda",
    "item": "Borda Catupiry",
    "price_cents": 1590
  }
]

Motivo:

Mesmo que o admin altere o preço da borda depois, o pedido antigo continua mostrando o que foi vendido na época.

---

## Fases recomendadas

### Etapa 61.0
Criar documento técnico do motor SaaS.

Status: planejamento, sem alteração no banco.

### Etapa 61.1
Desenhar schema Prisma proposto, ainda sem aplicar migration.

### Etapa 61.2
Criar migration somente depois de revisar impacto.

### Etapa 61.3
Criar seed inicial de grupos/opções para pizzaria.

### Etapa 61.4
Criar API Admin de OptionGroups e OptionItems.

### Etapa 61.5
Criar página Admin Opções de Montagem.

### Etapa 61.6
Integrar Mobile para consumir opções da API.

### Etapa 61.7
Atualizar OrderService para calcular preço usando OptionItems do banco.

### Etapa 61.8
Migrar opções temporárias de product-customizations.ts para banco.

---

## Decisão importante

Não remover o motor temporário atual até o motor SaaS definitivo estar validado.

O arquivo src/lib/product-customizations.ts deve continuar como fallback até a nova estrutura estar estável.

