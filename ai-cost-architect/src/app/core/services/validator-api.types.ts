/**
 * Types mirroring api/app/schemas.py — the report contract the FastAPI
 * backend returns from POST /api/validate.
 */

export type ProviderName = 'openai' | 'anthropic' | 'groq' | 'ollama';
export type Verdict = 'SUPPORTED' | 'UNSUPPORTED' | 'CONTRADICTED' | 'UNABLE_TO_VERIFY';
export type ClaimType = 'fact' | 'opinion' | 'hedged';
export type ValidationStatus = 'pass' | 'warning' | 'fail';

export interface ValidateRequest {
  question: string;
  answer: string;
  source?: string | null;
  provider_hint?: ProviderName | null;
}

export interface ClaimReport {
  id: number;
  text: string;
  type: ClaimType;
  verdict: Verdict;
  confidence: number;
  evidence_quote: string | null;
  evidence_in_source: boolean;
}

export interface RelevanceReport {
  percent: number;
  level: string;
  confidence: number;
}

export interface GroundednessReport {
  na: boolean;
  percent: number | null;
  supported: number;
  unsupported: number;
  contradicted: number;
  unverifiable: number;
  total: number;
}

export interface ValidationReport {
  status: ValidationStatus;
  relevance: RelevanceReport;
  groundedness: GroundednessReport;
  claims: ClaimReport[];
  contradiction_presence: number | null;
  meta: {
    provider?: string;
    extraction_model?: string;
    jev_model?: string;
    duration_ms?: number;
    source_provided?: boolean;
  };
}

export interface ValidationErrorBody {
  error:
    | 'invalid_request'
    | 'extraction_failed'
    | 'jev_failed'
    | 'provider_timeout'
    | 'not_configured';
  detail: string;
}