export function logSecurityEvent(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ type: 'security', ...event, timestamp: new Date().toISOString() }));
}
