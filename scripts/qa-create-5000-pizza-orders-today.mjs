/**
 * QA - Criar pedidos de pizza para teste no VenoZza
 *
 * Segurança:
 * - Por padrão roda em DRY RUN e NÃO cria pedido.
 * - Só cria pedidos se RUN_INSERT=SIM.
 *
 * Exemplos:
 *   node scripts/qa-create-5000-pizza-orders-today.mjs
 *
 *   RUN_INSERT=SIM TOTAL=10 node scripts/qa-create-5000-pizza-orders-today.mjs
 *
 *   RUN_INSERT=SIM TOTAL=5000 CONCURRENCY=5 node scripts/qa-create-5000-pizza-orders-today.mjs
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const STORE_ID = process.env.STORE_ID || "cmnqqxng8000192oz4bt0wo3u";
const TOTAL = Number(process.env.TOTAL || 5000);
const CONCURRENCY = Number(process.env.CONCURRENCY || 5);
const RUN_INSERT = process.env.RUN_INSERT === "SIM";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isPizza(product) {
  const name = normalizeText(product.name);
  const category = normalizeText(product.category);
  const customizationType = normalizeText(product.customizationType);

  return (
    category.includes("pizza") ||
    customizationType === "pizza" ||
    name.includes("pizza") ||
    name.includes("calabresa") ||
    name.includes("mussarela") ||
    name.includes("margherita") ||
    name.includes("portuguesa") ||
    name.includes("frango")
  );
}

function getPriceCents(product) {
  if (typeof product.price_cents === "number") return product.price_cents;
  if (typeof product.priceCents === "number") return product.priceCents;

  if (typeof product.price === "number") {
    return Math.round(product.price * 100);
  }

  if (typeof product.price === "string") {
    return Math.round(Number(product.price.replace(",", ".")) * 100);
  }

  return 0;
}

async function loadProducts() {
  const url = `${BASE_URL}/api/products?storeId=${encodeURIComponent(STORE_ID)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-store-id": STORE_ID,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(
      `Erro ao carregar produtos. HTTP ${response.status} - ${data.error || data.message || "sem mensagem"}`
    );
  }

  const items = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.products)
      ? data.products
      : Array.isArray(data.data)
        ? data.data
        : [];

  return items;
}

async function createOrder(index, pizzas) {
  const pizza = pickRandom(pizzas);
  const priceCents = getPriceCents(pizza);

  const payload = {
    customer: {
      name: `Cliente QA Pizza ${String(index).padStart(5, "0")}`,
      phone: "11999999999",
      address: `Rua QA Automatizado, ${index}`,
    },
    items: [
      {
        id: String(pizza.id),
        name: pizza.name,
        quantity: 1,
        price_cents: priceCents,
      },
    ],
    paymentMethod: "dinheiro",
    note: `Pedido QA automático ${index} - criado em ${new Date().toISOString()}`,
  };

  const response = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-store-id": STORE_ID,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(
      `Pedido ${index} falhou. HTTP ${response.status} - ${data.error || data.message || JSON.stringify(data)}`
    );
  }

  return {
    index,
    orderCode: data?.order?.orderCode || data?.order?.id || null,
    pizza: pizza.name,
    price_cents: priceCents,
  };
}

async function worker(workerId, queue, pizzas, results, errors) {
  while (queue.length > 0) {
    const index = queue.shift();

    try {
      const result = await createOrder(index, pizzas);
      results.push(result);

      if (results.length % 50 === 0) {
        console.log(
          `[OK] ${results.length}/${TOTAL} pedidos criados. Último: ${result.orderCode} - ${result.pizza}`
        );
      }

      await sleep(50);
    } catch (error) {
      errors.push({
        workerId,
        index,
        message: error instanceof Error ? error.message : String(error),
      });

      console.error(`[ERRO] worker=${workerId} pedido=${index}:`, error.message || error);
      await sleep(300);
    }
  }
}

async function main() {
  console.log("=== QA 5000 PIZZAS - VENOZZA ===");
  console.log("BASE_URL:", BASE_URL);
  console.log("STORE_ID:", STORE_ID);
  console.log("TOTAL:", TOTAL);
  console.log("CONCURRENCY:", CONCURRENCY);
  console.log("RUN_INSERT:", RUN_INSERT ? "SIM" : "NAO - DRY RUN");

  const products = await loadProducts();

  const pizzas = products
    .filter((product) => product.active !== false)
    .filter((product) => product.available !== false)
    .filter((product) => getPriceCents(product) > 0)
    .filter(isPizza);

  console.log("");
  console.log("Produtos carregados:", products.length);
  console.log("Pizzas disponíveis encontradas:", pizzas.length);

  if (pizzas.length === 0) {
    throw new Error("Nenhuma pizza disponível encontrada na loja informada.");
  }

  console.log("");
  console.log("Sabores que serão usados:");
  for (const pizza of pizzas) {
    console.log(
      `- ${pizza.name} | categoria=${pizza.category} | customizationType=${pizza.customizationType} | preço=${getPriceCents(pizza)} cents`
    );
  }

  console.log("");

  if (!RUN_INSERT) {
    console.log("DRY RUN ativo. Nenhum pedido foi criado.");
    console.log("Para criar pedidos de verdade, rode:");
    console.log("");
    console.log(`RUN_INSERT=SIM TOTAL=${TOTAL} CONCURRENCY=${CONCURRENCY} node scripts/qa-create-5000-pizza-orders-today.mjs`);
    console.log("");
    console.log("Recomendado testar primeiro com TOTAL=10:");
    console.log("");
    console.log("RUN_INSERT=SIM TOTAL=10 CONCURRENCY=2 node scripts/qa-create-5000-pizza-orders-today.mjs");
    return;
  }

  console.log("ATENÇÃO: criação real de pedidos iniciada.");
  console.log("");

  const queue = Array.from({ length: TOTAL }, (_, i) => i + 1);
  const results = [];
  const errors = [];

  const workers = Array.from({ length: CONCURRENCY }, (_, i) =>
    worker(i + 1, queue, pizzas, results, errors)
  );

  await Promise.all(workers);

  console.log("");
  console.log("=== RESULTADO FINAL ===");
  console.log("Pedidos solicitados:", TOTAL);
  console.log("Pedidos criados:", results.length);
  console.log("Erros:", errors.length);

  if (results.length > 0) {
    console.log("");
    console.log("Primeiros pedidos criados:");
    for (const item of results.slice(0, 10)) {
      console.log(`- ${item.orderCode} | ${item.pizza} | ${item.price_cents} cents`);
    }
  }

  if (errors.length > 0) {
    console.log("");
    console.log("Primeiros erros:");
    for (const error of errors.slice(0, 10)) {
      console.log(`- pedido=${error.index} worker=${error.workerId} erro=${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error("");
  console.error("ERRO GERAL:");
  console.error(error);
  process.exit(1);
});
