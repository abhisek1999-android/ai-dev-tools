export function formatCurrency(value: number, decimals = 4): string {
  if (value === 0) return '$0.00';
  if (value < 0.001) return `$${value.toFixed(6)}`;
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1_000_000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

export function formatNumber(n: number): string {
  if (n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function round(value: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function tokensToK(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return `${tokens}`;
}

export function bytesToMb(bytes: number): number {
  return bytes / (1024 * 1024);
}
