function adversaryModel() {
  return {
    allowed: ['delay', 'reorder', 'drop', 'equivocation_attempts', 'fake_injection'],
    forbidden: ['break_crypto', 'forge_valid_signatures'],
    scheduler: 'probabilistic',
  };
}

module.exports = { adversaryModel };