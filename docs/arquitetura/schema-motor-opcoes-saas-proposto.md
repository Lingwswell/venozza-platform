# VenoZza — Schema Prisma Proposto para Motor SaaS de Opções

## Objetivo

Documentar o desenho futuro do motor genérico de opções de produto, sem aplicar migration, sem db push e sem alterar schema.prisma neste momento.

## Princípio

O VenoZza é um core SaaS multiempresa/multiloja. Pizza é o primeiro vertical, mas o motor deve servir para pizzaria, hamburgueria, açaí, cafeteria, marmitaria, mercado e outros negócios de alimentação.

## Modelos propostos

### OptionGroup
Grupo de opções: Tamanho, Borda, Massa, Complementos, Molhos, Tipo de leite, Frutas, Coberturas, Proteína, Guarnição.
Campos sugeridos: id, tenantId, name, slug, description, type, required, minSelect, maxSelect, sortOrder, active, createdAt, updatedAt.

### OptionItem
Item dentro de um grupo: 40cm, Borda Catupiry, Massa Integral, Bacon, Banana, Leite sem lactose, Frango, Arroz, Feijão.
Campos sugeridos: id, tenantId, optionGroupId, name, slug, description, price_cents, sortOrder, active, createdAt, updatedAt.

### ProductOptionGroup
Vincula grupos de opções a produtos específicos.
Exemplo: Pizza Calabresa usa Tamanho, Borda, Massa e Bebidas extras.

### CategoryOptionGroup
Vincula grupos de opções a categorias.
Exemplo: categoria pizza usa Tamanho, Borda e Massa. Categoria açaí usa Tamanho, Frutas e Coberturas.

### StoreOptionAvailability
Controla disponibilidade, estoque e possível preço por loja para cada opção.
Exemplo: Loja Centro tem Borda Catupiry disponível; Loja Grajaú pode não ter.

## Segurança de preço

O cliente nunca deve ser dono do preço. O front envia produto e opções escolhidas. O servidor consulta ProductStore, OptionItem e disponibilidade por loja, calcula o preço e grava o pedido.

## Estratégia segura

1. Manter src/lib/product-customizations.ts como fallback temporário.
2. Criar tabelas novas sem remover nada existente.
3. Popular seed inicial para pizzaria.
4. Criar API admin de grupos/opções.
5. Criar tela Admin Opções de Montagem.
6. Mobile tenta API primeiro e fallback depois.
7. OrderService calcula pelo banco quando houver selectedOptions e mantém compatibilidade com addons antigos.

## Decisão

Não aplicar migration agora. Este documento é apenas planejamento técnico.
