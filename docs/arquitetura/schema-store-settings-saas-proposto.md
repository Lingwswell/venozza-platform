# VenoZza — Schema Proposto para StoreSettings

## Objetivo

Documentar o futuro módulo de configurações operacionais por loja, sem alterar banco, sem migration e sem db push nesta etapa.

## Decisão

Manter Store focado em identidade e localização da loja.

Criar futuramente StoreSettings para regras operacionais da loja.

## Store atual

O model Store já possui:

- name
- slug
- endereço separado
- city
- state
- zipCode
- latitude
- longitude
- deliveryRadiusKm
- deliveryBaseFeeCents
- deliveryKmFeeCents
- active

## O que falta para operação real

StoreSettings deverá controlar:

- loja aberta ou fechada
- fechamento manual
- mensagem de loja fechada
- aceitar entrega
- aceitar retirada
- tempo médio de preparo
- pedido mínimo
- frete padrão
- frete grátis acima de valor
- WhatsApp
- PIX ativo
- dinheiro ativo
- crédito ativo
- débito ativo
- horários de funcionamento

## Model Prisma proposto

model StoreSettings {
  id                     String   @id @default(cuid())
  storeId                String   @unique
  isOpen                 Boolean  @default(true)
  manualClosed           Boolean  @default(false)
  closedMessage          String?
  acceptDelivery         Boolean  @default(true)
  acceptPickup           Boolean  @default(true)
  preparationTimeMinutes Int      @default(35)
  minimumOrderCents      Int      @default(0)
  defaultFreightCents    Int      @default(500)
  freeDeliveryAboveCents Int?
  whatsapp               String?
  paymentPix             Boolean  @default(true)
  paymentCash            Boolean  @default(true)
  paymentCredit          Boolean  @default(false)
  paymentDebit           Boolean  @default(false)
  openingHoursJson       String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  store                  Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@map("store_settings")
}

## Relação futura em Store

settings StoreSettings?

## APIs futuras

- GET /api/admin/store-settings
- PATCH /api/admin/store-settings
- GET /api/store-settings?storeId=...

## Impacto futuro

O mobile e checkout deverão ler StoreSettings para:

- exibir aberta ou fechada
- bloquear pedido se loja fechada
- aplicar frete correto
- validar pedido mínimo
- mostrar pagamentos ativos
- permitir entrega ou retirada
- mostrar WhatsApp da loja

## Estratégia segura

1. Documentar o schema.
2. Aplicar schema somente depois de autorização.
3. Criar settings padrão para lojas existentes.
4. Criar API Admin.
5. Fazer /admin/configuracoes salvar dados reais.
6. Fazer /m e checkout consumirem as configurações.

## Fallbacks obrigatórios

Se StoreSettings não existir:

- considerar loja aberta
- permitir entrega
- permitir retirada
- usar frete 500 cents
- usar PIX como padrão
- não bloquear checkout
