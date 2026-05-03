const basePricing = {
  '/data': 1,
  '/transfer': 3,
  '/verify': 0.5,
  '/log': 0.2,
};

const tierMultipliers = {
  FREE: 1.5,
  PRO: 1,
  ENTERPRISE: 0.8,
};

function getTierPricing(tier = 'FREE') {
  return { multiplier: tierMultipliers[tier] || tierMultipliers.FREE, basePricing: { ...basePricing } };
}

function calculateCost(endpoint, tier = 'FREE') {
  const base = basePricing[endpoint] ?? 1;
  const multiplier = tierMultipliers[tier] || tierMultipliers.FREE;
  return base * multiplier;
}

module.exports = { calculateCost, getTierPricing, basePricing, tierMultipliers };