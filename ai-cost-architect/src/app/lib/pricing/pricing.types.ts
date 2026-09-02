export type Provider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'deepseek' | 'meta' | 'cohere';

export type ModelCategory = 'llm' | 'embedding' | 'reranker';

export interface LlmModel {
  id: string;
  provider: Provider;
  name: string;
  category: 'llm';
  inputPricePer1M: number;
  outputPricePer1M: number;
  cachedInputPricePer1M?: number;
  batchInputPricePer1M?: number;
  batchOutputPricePer1M?: number;
  contextWindow: number;
  lastVerified: string;
  pricingUrl: string;
  notes?: string;
}

export interface EmbeddingModel {
  id: string;
  provider: Provider;
  name: string;
  category: 'embedding';
  pricePer1M: number;
  dimensions: number;
  lastVerified: string;
  pricingUrl: string;
}

export type AiModel = LlmModel | EmbeddingModel;

export interface VectorDbOption {
  id: string;
  name: string;
  storagePricePerGbMonth: number;
  queryPricePer1M: number;
  freeTierGb?: number;
  notes?: string;
}

export interface WorkloadPreset {
  id: string;
  label: string;
  inputTokens: number;
  outputTokens: number;
  requestsPerMonth: number;
  description: string;
}
