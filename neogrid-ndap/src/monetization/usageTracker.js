const usageStore = new Map();

function ensure(apiKey) {
  if (!usageStore.has(apiKey)) {
    usageStore.set(apiKey, {
      requestCount: 0,
      endpoints: {},
      computeOperations: 0,
      storageUsage: 0,
      costUnits: 0,
      anonymous: false,
      updatedAt: null,
    });
  }
  return usageStore.get(apiKey);
}

function recordUsage(apiKey, endpoint, costUnits = 0) {
  const usage = ensure(apiKey);
  usage.requestCount += 1;
  usage.endpoints[endpoint] = (usage.endpoints[endpoint] || 0) + 1;
  usage.costUnits += Number(costUnits) || 0;
  usage.updatedAt = new Date().toISOString();
  return { ...usage };
}

function getUsage(apiKey) {
  return usageStore.get(apiKey) || null;
}

function resetUsage(apiKey) {
  usageStore.delete(apiKey);
  return true;
}

function addComputeOperation(apiKey, count = 1) {
  const usage = ensure(apiKey);
  usage.computeOperations += count;
  return { ...usage };
}

function addStorageUsage(apiKey, amount = 0) {
  const usage = ensure(apiKey);
  usage.storageUsage += amount;
  return { ...usage };
}

module.exports = { recordUsage, getUsage, resetUsage, addComputeOperation, addStorageUsage };