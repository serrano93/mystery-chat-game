export const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const now = (): number => Date.now();
