import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, timeout, map, catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ValidateRequest,
  ValidationErrorBody,
  ValidationReport,
} from './validator-api.types';

/** Normalized error the page can render without knowing about HttpErrorResponse. */
export class ValidatorApiError extends Error {
  constructor(
    public kind: 'unreachable' | 'server' | 'unknown',
    public code: string,
    public detail: string,
  ) {
    super(detail);
  }
}

const REQUEST_TIMEOUT_MS = 90_000; // extraction can legitimately take tens of seconds

@Injectable({ providedIn: 'root' })
export class ValidatorApiService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  validate(req: ValidateRequest): Observable<ValidationReport> {
    return this.http
      .post<ValidationReport>(`${this.base}/api/validate`, req)
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        catchError((err: unknown) => throwError(() => this.normalize(err))),
      );
  }

  private normalize(err: unknown): ValidatorApiError {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return new ValidatorApiError(
          'unreachable',
          'unreachable',
          'The TokIQ validation API is not reachable. Is the local API server running? See api/README.md.',
        );
      }
      const body = err.error as ValidationErrorBody | null;
      return new ValidatorApiError(
        'server',
        body?.error ?? 'unknown',
        body?.detail ?? `The API returned ${err.status}.`,
      );
    }
    // rxjs timeout() throws an anonymous TimeoutError — treat it as unreachable.
    const name = (err as { name?: string })?.name ?? '';
    if (name === 'TimeoutError') {
      return new ValidatorApiError(
        'unreachable',
        'provider_timeout',
        'The validation request timed out — the extraction model took too long. Try a shorter answer.',
      );
    }
    return new ValidatorApiError('unknown', 'unknown', String(err));
  }
}