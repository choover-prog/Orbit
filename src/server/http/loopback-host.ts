const EXACT_LOOPBACK_HOST = /^127\.0\.0\.1:(\d{1,5})$/u;

export function isTrustedOrbitLoopbackHost(host: string | null): boolean {
  const match = host?.match(EXACT_LOOPBACK_HOST);
  if (!match) return false;
  const port = Number(match[1]);
  return (
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65_535 &&
    String(port) === match[1]
  );
}
