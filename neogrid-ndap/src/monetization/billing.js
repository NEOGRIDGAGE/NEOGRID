const invoices = new Map();
const { getUsage } = require('./usageTracker');
const { calculateCost } = require('./pricing');

function calculateBill(apiKey, tier = 'FREE') {
  const usage = getUsage(apiKey);
  if (!usage) return 0;
  let total = 0;
  for (const [endpoint, count] of Object.entries(usage.endpoints || {})) {
    total += calculateCost(endpoint, tier) * count;
  }
  return total + (usage.computeOperations || 0) * 0 + (usage.storageUsage || 0) * 0;
}

function generateInvoice(apiKey, tier = 'FREE') {
  const usage = getUsage(apiKey) || { requestCount: 0, endpoints: {} };
  const amount = calculateBill(apiKey, tier);
  const invoice = {
    apiKey,
    tier,
    issuedAt: new Date().toISOString(),
    usage,
    amount,
    currency: 'USD',
    status: 'pending',
  };
  invoices.set(apiKey, invoice);
  return invoice;
}

function exportStripePayload(invoice) {
  return {
    customer: invoice.apiKey,
    currency: invoice.currency,
    amount: Math.round(invoice.amount * 100),
    metadata: {
      tier: invoice.tier,
      issuedAt: invoice.issuedAt,
      requestCount: invoice.usage.requestCount,
    },
  };
}

module.exports = { generateInvoice, calculateBill, exportStripePayload };