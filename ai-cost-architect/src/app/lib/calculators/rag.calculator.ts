import { EmbeddingModel, LlmModel, VectorDbOption } from '../pricing/pricing.types';
import { round } from '../utils/number.utils';

export interface RagInput {
  // Corpus
  documentCount: number;
  avgDocumentTokens: number;
  corpusGrowthPct: number;          // monthly % growth

  // Chunking
  chunkSize: number;                // tokens per chunk
  chunkOverlapPct: number;          // overlap as % of chunk size

  // Embedding
  embeddingModel: EmbeddingModel;

  // Retrieval
  queriesPerDay: number;
  topK: number;
  vectorDb: VectorDbOption;
  useReranker: boolean;
  rerankerCostPer1MTokens: number;  // approximate

  // Generation
  llm: LlmModel;
  outputTokensPerQuery: number;
  cachingEnabled: boolean;

  // Optimizations
  cacheHitRate: number;             // 0-1
}

export interface RagCostBreakdown {
  initialEmbeddingCost: number;
  monthlyEmbeddingCost: number;
  vectorDbStorageCost: number;
  vectorDbQueryCost: number;
  generationCost: number;
  totalMonthlyCost: number;
  totalTokensIndexed: number;
  chunksTotal: number;

  whatIf: WhatIfScenario[];
  math: MathLine[];
}

export interface MathLine {
  section: string;
  label: string;
  expression: string;
  result: string;
}

export interface WhatIfScenario {
  label: string;
  saving: number;
  savingPct: number;
  description: string;
}

export function calculateRagCost(input: RagInput): RagCostBreakdown {
  const {
    documentCount,
    avgDocumentTokens,
    corpusGrowthPct,
    chunkSize,
    chunkOverlapPct,
    embeddingModel,
    queriesPerDay,
    topK,
    vectorDb,
    useReranker,
    rerankerCostPer1MTokens,
    llm,
    outputTokensPerQuery,
    cachingEnabled,
    cacheHitRate,
  } = input;

  const overlapTokens   = Math.floor(chunkSize * (chunkOverlapPct / 100));
  const stride          = chunkSize - overlapTokens;
  const chunksPerDoc    = Math.ceil(avgDocumentTokens / stride);
  const chunksTotal     = documentCount * chunksPerDoc;
  const totalTokensIndexed = chunksTotal * chunkSize;

  const initialEmbeddingCost = round((totalTokensIndexed / 1_000_000) * embeddingModel.pricePer1M, 4);

  const newTokensPerMonth = round(totalTokensIndexed * (corpusGrowthPct / 100), 0);
  const monthlyEmbeddingCost = round((newTokensPerMonth / 1_000_000) * embeddingModel.pricePer1M, 4);

  // Vector DB storage: assume 4 bytes per dimension × chunks
  const storageGb = round((chunksTotal * embeddingModel.dimensions * 4) / (1024 ** 3), 4);
  const vectorDbStorageCost = round(storageGb * vectorDb.storagePricePerGbMonth, 4);

  const queriesPerMonth = queriesPerDay * 30;
  const vectorDbQueryCost = round((queriesPerMonth / 1_000_000) * vectorDb.queryPricePer1M, 4);

  const effectiveInputPrice = cachingEnabled && llm.cachedInputPricePer1M
    ? llm.cachedInputPricePer1M * cacheHitRate + llm.inputPricePer1M * (1 - cacheHitRate)
    : llm.inputPricePer1M;

  const contextTokensPerQuery = topK * chunkSize;
  const inputCostPerQuery  = (contextTokensPerQuery / 1_000_000) * effectiveInputPrice;
  const outputCostPerQuery = (outputTokensPerQuery  / 1_000_000) * llm.outputPricePer1M;
  const generationCost = round((inputCostPerQuery + outputCostPerQuery) * queriesPerMonth, 4);

  let rerankerCost = 0;
  if (useReranker) {
    const rerankerTokensPerQuery = topK * chunkSize;
    rerankerCost = round((rerankerTokensPerQuery / 1_000_000) * rerankerCostPer1MTokens * queriesPerMonth, 4);
  }

  const totalMonthlyCost = round(
    monthlyEmbeddingCost + vectorDbStorageCost + vectorDbQueryCost + generationCost + rerankerCost, 2
  );

  // ── What-If scenarios ───────────────────────────────────────────────────────
  const whatIf: WhatIfScenario[] = [];

  // Smaller top-K
  if (topK > 3) {
    const reducedTopK = Math.max(3, Math.floor(topK / 2));
    const reducedCtxTokens = reducedTopK * chunkSize;
    const reducedGenCost = round(
      ((reducedCtxTokens / 1_000_000) * effectiveInputPrice +
       (outputTokensPerQuery / 1_000_000) * llm.outputPricePer1M) * queriesPerMonth, 4
    );
    const saving = round(generationCost - reducedGenCost, 2);
    if (saving > 0) {
      whatIf.push({
        label: `Reduce top-K from ${topK} → ${reducedTopK}`,
        saving,
        savingPct: round((saving / totalMonthlyCost) * 100, 1),
        description: 'Fewer retrieved chunks reduces context size and LLM input cost. Validate retrieval quality.',
      });
    }
  }

  // Enable caching
  if (!cachingEnabled && llm.cachedInputPricePer1M) {
    const cachedInputCost = (contextTokensPerQuery / 1_000_000) * llm.cachedInputPricePer1M * 0.5; // assume 50% hit
    const cachedGenCost = round(
      (cachedInputCost + (outputTokensPerQuery / 1_000_000) * llm.outputPricePer1M) * queriesPerMonth, 4
    );
    const saving = round(generationCost - cachedGenCost, 2);
    if (saving > 0) {
      whatIf.push({
        label: 'Enable prompt caching (50% hit rate)',
        saving,
        savingPct: round((saving / totalMonthlyCost) * 100, 1),
        description: `${llm.name} supports cached input at $${llm.cachedInputPricePer1M}/1M vs $${llm.inputPricePer1M}/1M.`,
      });
    }
  }

  // Cheaper embedding model
  if (embeddingModel.pricePer1M > 0.02) {
    const cheaperEmbedPrice = 0.02;
    const saving = round((newTokensPerMonth / 1_000_000) * (embeddingModel.pricePer1M - cheaperEmbedPrice), 4);
    if (saving > 0) {
      whatIf.push({
        label: 'Switch to text-embedding-3-small ($0.02/1M)',
        saving,
        savingPct: round((saving / totalMonthlyCost) * 100, 1),
        description: 'Cheaper embedding reduces monthly re-indexing cost. Validate retrieval quality impact.',
      });
    }
  }

  const math: MathLine[] = [
    {
      section: 'Corpus',
      label: 'Chunks per document',
      expression: `ceil(${avgDocumentTokens} tokens / ${stride} stride)`,
      result: `${chunksPerDoc}`,
    },
    {
      section: 'Corpus',
      label: 'Total chunks',
      expression: `${documentCount.toLocaleString()} docs × ${chunksPerDoc}`,
      result: `${chunksTotal.toLocaleString()}`,
    },
    {
      section: 'Embedding',
      label: 'Initial indexing cost',
      expression: `${totalTokensIndexed.toLocaleString()} tokens × $${embeddingModel.pricePer1M}/1M`,
      result: `$${initialEmbeddingCost}`,
    },
    {
      section: 'Embedding',
      label: 'Monthly re-indexing',
      expression: `${newTokensPerMonth.toLocaleString()} new tokens × $${embeddingModel.pricePer1M}/1M`,
      result: `$${monthlyEmbeddingCost}/mo`,
    },
    {
      section: 'Generation',
      label: 'Context tokens / query',
      expression: `${topK} chunks × ${chunkSize} tokens`,
      result: `${contextTokensPerQuery.toLocaleString()}`,
    },
    {
      section: 'Generation',
      label: 'Monthly generation cost',
      expression: `(${contextTokensPerQuery} in + ${outputTokensPerQuery} out) × $price × ${queriesPerMonth.toLocaleString()} queries`,
      result: `$${generationCost}/mo`,
    },
  ];

  return {
    initialEmbeddingCost,
    monthlyEmbeddingCost,
    vectorDbStorageCost,
    vectorDbQueryCost,
    generationCost,
    totalMonthlyCost,
    totalTokensIndexed,
    chunksTotal,
    whatIf,
    math,
  };
}
