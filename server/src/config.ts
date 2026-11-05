/** Only enable proxy trust when the number of controlled upstream hops is known. */
export function parseTrustProxyHops(value: string | undefined): number {
  if (value === undefined) return 0;
  if (!/^[0-3]$/.test(value)) {
    throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 3.");
  }
  return Number(value);
}
