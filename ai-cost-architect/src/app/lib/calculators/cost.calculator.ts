import { LlmModel } from '../pricing/pricing.types';
import { round } from '../utils/number.utils';

export interface CostInput {
  model: LlmModel;
  inputTokensPerRequest: number;
  outputTokensPerRequest: number;
  requestsPerMonth: number;
  useCaching?: boolean;
  useBatch?: boolean;
}

export interface CostBreakdown {
  inputCostPerRequest: number;
  outputCostPerRequest: number;
  totalCostPerRequest: number;
  dailyCost: number;
  monthlyCost: number;
  yearlyCost: number;
  math: MathStep[];
}

export interface MathStep {
  label: string;
  expression: string;
  result: number;
  unit?: string;
}

export function calculateCost(input: CostInput): CostBreakdown {
  const {
    model,
    inputTokensPerRequest,
    outputTokensPerRequest,
    requestsPerMonth,
    useCaching = false,
    useBatch = false,
  } = input;

  const effectiveInputPrice = useBatch && model.batchInputPricePer1M
    ? model.batchInputPricePer1M
    : useCaching && model.cachedInputPricePer1M
    ? model.cachedInputPricePer1M
    : model.inputPricePer1M;

  const effectiveOutputPrice = useBatch && model.batchOutputPricePer1M
    ? model.batchOutputPricePer1M
    : model.outputPricePer1M;

  const inputCostPerRequest  = round((inputTokensPerRequest  / 1_000_000) * effectiveInputPrice,  8);
  const outputCostPerRequest = round((outputTokensPerRequest / 1_000_000) * effectiveOutputPrice, 8);
  const totalCostPerRequest  = round(inputCostPerRequest + outputCostPerRequest, 8);

  const monthlyCost = round(totalCostPerRequest * requestsPerMonth, 4);
  const dailyCost   = round(monthlyCost / 30, 4);
  const yearlyCost  = round(monthlyCost * 12, 2);

  const math: MathStep[] = [
    {
      label: 'Input cost / request',
      expression: `${inputTokensPerRequest.toLocaleString()} tokens × $${effectiveInputPrice}/1M`,
      result: inputCostPerRequest,
      unit: '$/request',
    },
    {
      label: 'Output cost / request',
      expression: `${outputTokensPerRequest.toLocaleString()} tokens × $${effectiveOutputPrice}/1M`,
      result: outputCostPerRequest,
      unit: '$/request',
    },
    {
      label: 'Total cost / request',
      expression: `$${inputCostPerRequest} + $${outputCostPerRequest}`,
      result: totalCostPerRequest,
      unit: '$/request',
    },
    {
      label: 'Monthly cost',
      expression: `$${totalCostPerRequest} × ${requestsPerMonth.toLocaleString()} requests`,
      result: monthlyCost,
      unit: '$/month',
    },
  ];

  return { inputCostPerRequest, outputCostPerRequest, totalCostPerRequest, dailyCost, monthlyCost, yearlyCost, math };
}
