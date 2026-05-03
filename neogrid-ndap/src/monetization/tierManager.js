const tiers = {
  FREE: { name: 'FREE', requestLimit: 100, priority: 'low', sla: false },
  PRO: { name: 'PRO', requestLimit: 1000, priority: 'medium', sla: false },
  ENTERPRISE: { name: 'ENTERPRISE', requestLimit: Infinity, priority: 'high', sla: true },
};

function getTier(apiKeyRecord) {
  return (apiKeyRecord && apiKeyRecord.tier && tiers[apiKeyRecord.tier]) ? apiKeyRecord.tier : 'FREE';
}

function upgradeTier(apiKeyRecord, newTier) {
  if (!tiers[newTier]) return null;
  if (apiKeyRecord) apiKeyRecord.tier = newTier;
  return tiers[newTier];
}

function getTierConfig(tier = 'FREE') {
  return tiers[tier] || tiers.FREE;
}

module.exports = { tiers, getTier, upgradeTier, getTierConfig };