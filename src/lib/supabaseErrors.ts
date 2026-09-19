export function isSchemaMismatchError(err: unknown): boolean {
  if (!err) return false;
  
  let code = '';
  let message = '';

  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    code = typeof obj.code === 'string' ? obj.code : '';
    // Let object properties take precedence if both exist, though err.message handles Error instances
    message = typeof obj.message === 'string' ? obj.message : '';
  }

  if (err instanceof Error && !message) {
    message = err.message;
  }

  const schemaCodes = ['PGRST204', 'PGRST205', '42703', '42P01'];
  if (code && schemaCodes.includes(code.toUpperCase())) {
    return true;
  }

  const lowerMsg = message.toLowerCase();
  if (
    lowerMsg.includes('schema cache') ||
    lowerMsg.includes('does not exist') ||
    lowerMsg.includes('could not find the')
  ) {
    return true;
  }

  return false;
}
