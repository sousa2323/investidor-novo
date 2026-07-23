import { syncBrapiUniverse } from "../src/lib/market-data/refresh";

async function seedDatabase() {
  const { assets, quotes } = await syncBrapiUniverse();
  console.log(`${assets} ativos sincronizados da B3 (${quotes} com cotação).`);
  console.log(
    "Fundamentos são carregados ao abrir cada ativo e pelo cron /api/cron/refresh-fundamentals.",
  );
}

seedDatabase().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
