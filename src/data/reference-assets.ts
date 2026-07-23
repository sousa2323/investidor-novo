/**
 * Sugestões de categorias do planejador financeiro.
 *
 * Os ativos deixaram de morar aqui: ações e FIIs vêm do banco, alimentados pela
 * lista pública do brapi e pelos informes da CVM. Ver `src/lib/dal/assets.ts`.
 */
export const plannerCategoryExamples = {
  income: ["Salário", "Vale", "Renda extra", "Benefícios"],
  monthlyExpenses: [
    "Moradia",
    "Transporte",
    "Combustível",
    "Cartão",
    "Internet",
    "Academia",
    "Energia",
    "Água",
    "Alimentação",
    "Pets",
  ],
  annualExpenses: [
    "IPTU",
    "Licenciamento e IPVA",
    "Conselho profissional",
    "Imposto de renda",
    "Seguros",
  ],
  plannedInvestments: [
    "Reserva de emergência",
    "Objetivos de curto prazo",
    "Carteira de investimentos",
  ],
} as const;
