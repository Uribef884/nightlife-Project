/**
 * Safe getter for nested properties using dot-notation paths.
 * Example: getValueByPath(obj, "transaction.id")
 */
export function getValueByPath(source: unknown, path: string): unknown {
  if (source == null || typeof path !== "string" || path.length === 0) {
    return undefined;
  }

  const segments = path.split(".");
  let current: any = source as any;

  for (const segment of segments) {
    if (current == null) return undefined;
    current = current[segment];
  }

  return current;
}

// Note: Keep a single implementation to avoid duplicate export errors
