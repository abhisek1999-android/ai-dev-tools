import { encode, decode } from 'gpt-tokenizer';

export interface TokenSegment {
  text: string;
  index: number;
}

export interface TokenResult {
  tokenCount: number;
  charCount: number;
  charCountNoSpaces: number;
  wordCount: number;
  lineCount: number;
  sentenceCount: number;
  /** Approximation for non-GPT models based on char ratio */
  isApproximate: boolean;
  modelId: string;
  /** Populated only for GPT models (exact tiktoken encoding) */
  segments: TokenSegment[];
}

const GPT_MODELS = new Set([
  'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'o3-mini',
]);

export function countTokens(text: string, modelId: string): TokenResult {
  if (text.trim() === '') {
    return {
      tokenCount: 0, charCount: 0, charCountNoSpaces: 0,
      wordCount: 0, lineCount: 0, sentenceCount: 0,
      isApproximate: false, modelId, segments: [],
    };
  }

  const charCount = text.length;
  const charCountNoSpaces = text.replace(/\s/g, '').length;
  const wordCount = text.trim().split(/\s+/).length;
  const lineCount = text.split('\n').length;
  const sentenceCount = (text.match(/[.!?]+/g) ?? []).length || 1;

  let tokenCount: number;
  let isApproximate = false;
  let segments: TokenSegment[] = [];

  if (GPT_MODELS.has(modelId)) {
    try {
      const tokenIds = encode(text);
      tokenCount = tokenIds.length;
      segments = tokenIds.map((id, i) => ({ text: decode([id]), index: i }));
    } catch {
      tokenCount = approximateTokens(charCount);
      isApproximate = true;
    }
  } else {
    tokenCount = approximateTokens(charCount);
    isApproximate = true;
  }

  return {
    tokenCount, charCount, charCountNoSpaces,
    wordCount, lineCount, sentenceCount,
    isApproximate, modelId, segments,
  };
}

/** ~4 chars per token is a standard approximation for English text */
function approximateTokens(charCount: number): number {
  return Math.ceil(charCount / 4);
}
