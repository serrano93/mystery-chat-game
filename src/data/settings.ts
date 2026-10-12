import type { ModelTier } from '../types';

export interface TierConfig {
  id: string;
  label: string;
  description: string;
  maxTokens: number;
  timeoutMs: number;
  historyMessages: number;
}

export const MODEL_TIERS: Record<ModelTier, TierConfig> = {
  fast: {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    label: 'Rápido',
    description: 'Móviles modestos. Menos matiz, más velocidad.',
    maxTokens: 120,
    timeoutMs: 14000,
    historyMessages: 6
  },
  balanced: {
    id: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
    label: 'Equilibrado',
    description: 'Recomendado. Buen equilibrio entre naturalidad y rendimiento.',
    maxTokens: 180,
    timeoutMs: 20000,
    historyMessages: 10
  },
  premium: {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    label: 'Premium',
    description: 'PC o tablet potente. Más fluidez y mejor memoria conversacional.',
    maxTokens: 240,
    timeoutMs: 30000,
    historyMessages: 14
  }
};

const STORAGE_KEY = 'mystery-model-tier';

export function detectTier(): ModelTier {
  if (typeof navigator === 'undefined') return 'balanced';

  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as any).deviceMemory ?? 4;

  if (!isMobile && cores >= 8 && memory >= 8) return 'premium';
  if (!isMobile && cores >= 4 && memory >= 4) return 'balanced';
  if (isMobile && cores >= 6 && memory >= 4) return 'balanced';
  return 'fast';
}

export function getStoredTier(): ModelTier | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'fast' || value === 'balanced' || value === 'premium') {
      return value;
    }
  } catch {
    // localStorage puede no existir (SSR, modo privado): se ignora.
  }

  return null;
}

export function setStoredTier(tier: ModelTier): void {
  try {
    localStorage.setItem(STORAGE_KEY, tier);
  } catch {
    // ignore
  }
}

export function resolveTier(): ModelTier {
  return getStoredTier() ?? detectTier();
}
