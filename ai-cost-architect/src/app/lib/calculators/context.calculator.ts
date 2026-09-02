import { LlmModel } from '../pricing/pricing.types';
import { round } from '../utils/number.utils';

export interface ContextResult {
  usedTokens: number;
  remainingTokens: number;
  usedPercent: number;
  costIfFilled: number;
  costForUsed: number;
  isNearLimit: boolean;
  math: Array<{ label: string; expression: string; result: string }>;
}

export function calculateContext(
  model: LlmModel,
  usedTokens: number,
): ContextResult {
  const contextWindow = model.contextWindow;
  const remainingTokens = Math.max(0, contextWindow - usedTokens);
  const usedPercent = round((usedTokens / contextWindow) * 100, 1);

  const costForUsed   = round((usedTokens   / 1_000_000) * model.inputPricePer1M, 6);
  const costIfFilled  = round((contextWindow / 1_000_000) * model.inputPricePer1M, 6);

  return {
    usedTokens,
    remainingTokens,
    usedPercent,
    costForUsed,
    costIfFilled,
    isNearLimit: usedPercent >= 80,
    math: [
      {
        label: 'Context usage',
        expression: `${usedTokens.toLocaleString()} / ${contextWindow.toLocaleString()}`,
        result: `${usedPercent}%`,
      },
      {
        label: 'Cost for current context (input)',
        expression: `${usedTokens.toLocaleString()} tokens × $${model.inputPricePer1M}/1M`,
        result: `$${costForUsed}`,
      },
      {
        label: 'Cost if context filled',
        expression: `${contextWindow.toLocaleString()} tokens × $${model.inputPricePer1M}/1M`,
        result: `$${costIfFilled}`,
      },
    ],
  };
}
