import type { Boost } from '@/db/schema';

export type SitterTier = 'free' | 'perks' | 'paid';

export const TIER_ORDER: Record<SitterTier, number> = {
  free: 0,
  perks: 1,
  paid: 2,
};

export const TIER_LABELS: Record<SitterTier, string> = {
  free: 'Free',
  perks: 'Perks',
  paid: 'Premium',
};

export function getHighestTierOffered(boosts: Boost[]): SitterTier | null {
  const tierBoosts = boosts.filter(
    (b) => b.boostType === 'tier_upgrade' && b.isActive && b.tierOffered
  );
  if (tierBoosts.length === 0) return null;

  return tierBoosts.reduce<SitterTier>((highest, boost) => {
    const tier = boost.tierOffered as SitterTier;
    return TIER_ORDER[tier] > TIER_ORDER[highest] ? tier : highest;
  }, 'free');
}

export function getActiveBoostCount(boosts: Boost[]): number {
  return boosts.filter((b) => b.isActive === 1).length;
}

export function canSitterApply(sitterTier: SitterTier, requiredTier: SitterTier): boolean {
  return TIER_ORDER[sitterTier] >= TIER_ORDER[requiredTier];
}
