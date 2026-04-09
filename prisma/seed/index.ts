import { seedStores } from "./stores";
import { seedUsers } from "./users";
// import { seedProducts } from "./products";
// import { seedIngredients } from "./ingredients";
// import { seedCategories } from "./categories";
// import { seedCoupons } from "./coupons";

async function main() {
  console.log("🌱 Iniciando seed do core SaaS...");

  await seedStores();
  await seedUsers();

  console.log("✅ Seed do core SaaS finalizado");
}

main()
  .catch((error) => {
    console.error("❌ Erro no seed:", error);
    process.exit(1);
  });
