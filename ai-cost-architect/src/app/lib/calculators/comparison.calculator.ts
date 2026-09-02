import { LlmModel } from '../pricing/pricing.types';
import { calculateCost } from './cost.calculator';
import { round } from '../utils/number.utils';

export interface ComparisonRow {
  model: LlmModel;
  monthlyCost: number;
  yearlyCost: number;
  costPerRequest: number;
  savingsVsCheapest?: number;
  savingsPctVsCheapest?: number;
  rank: number;
}

export interface ComparisonResult {
  rows: ComparisonRow[];
  cheapestModel: LlmModel;
  mostExpensiveModel: LlmModel;
  maxSavings: number;
}

export function compareModels(
  models: LlmModel[],
  inputTokensPerRequest: number,
  outputTokensPerRequest: number,
  requestsPerMonth: number,
): ComparisonResult {
  const rows: ComparisonRow[] = models.map(model => {
    const cost = calculateCost({ model, inputTokensPerRequest, outputTokensPerRequest, requestsPerMonth });
    return {
      model,
      monthlyCost: cost.monthlyCost,
      yearlyCost: cost.yearlyCost,
      costPerRequest: cost.totalCostPerRequest,
      rank: 0,
    };
  });

  rows.sort((a, b) => a.monthlyCost - b.monthlyCost);

  const cheapest = rows[0].monthlyCost;
  rows.forEach((row, i) => {
    row.rank = i + 1;
    row.savingsVsCheapest = round(row.monthlyCost - cheapest, 2);
    row.savingsPctVsCheapest = cheapest > 0
      ? round(((row.monthlyCost - cheapest) / row.monthlyCost) * 100, 1)
      : 0;
  });

  return {
    rows,
    cheapestModel: rows[0].model,
    mostExpensiveModel: rows[rows.length - 1].model,
    maxSavings: round(rows[rows.length - 1].monthlyCost - cheapest, 2),
  };
}
