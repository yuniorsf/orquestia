/** HTTP 429 Too Many Requests — the universal rate-limit signal across REST/HTTP agent APIs. */
export function isRateLimitHttpStatus(status: number): boolean {
  return status === 429;
}
