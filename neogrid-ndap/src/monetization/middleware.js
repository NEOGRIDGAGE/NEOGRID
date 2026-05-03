const { validateApiKey } = require('./apiKey');
const { checkLimit } = require('./rateLimiter');
const { recordUsage } = require('./usageTracker');
const { calculateCost } = require('./pricing');
const { getTier } = require('./tierManager');
const { generateInvoice } = require('./billing');

function withMonetization(handler) {
  return async (req, res) => {
    const endpoint = req.path;
    const apiKey = req.header('x-api-key') || req.header('authorization') || '';
    const validation = validateApiKey(apiKey);
    const tier = validation.valid ? validation.tier : 'FREE';
    const key = validation.valid ? apiKey : 'anonymous';

    const limit = checkLimit(key, endpoint, tier);
    if (!limit.allowed) {
      return res.status(429).json({ error: 'rate limit exceeded' });
    }

    recordUsage(key, endpoint, 0);
    try {
      const result = await handler(req, res);
      recordUsage(key, endpoint, calculateCost(endpoint, tier));
      generateInvoice(key, getTier(validation.metadata || { tier }));
      return result;
    } catch (err) {
      recordUsage(key, endpoint, calculateCost(endpoint, tier));
      throw err;
    }
  };
}

module.exports = { withMonetization };