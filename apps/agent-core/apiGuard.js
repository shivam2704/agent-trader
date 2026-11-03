// backend/apiGuard.js
// Enterprise-Grade Validation & Exception Handling Middleware
// Designed specifically for autonomous AI Agent callers & Tool-Calling LLMs

class ApiGuardError extends Error {
  constructor(statusCode, code, message, field = null, remediation = null, details = {}) {
    super(message);
    this.name = 'ApiGuardError';
    this.statusCode = statusCode;
    this.code = code;
    this.field = field;
    this.remediation = remediation;
    this.details = details;
  }
}

function isValidNearAccountId(accountId) {
  if (!accountId || typeof accountId !== 'string') return false;
  const clean = accountId.trim().toLowerCase();
  if (clean.length < 2 || clean.length > 64) return false;
  // 64-char implicit ed25519 hex account
  if (clean.length === 64 && /^[0-9a-f]{64}$/.test(clean)) return true;
  // Named NEAR accounts (must have at least one separator dot, e.g. .testnet or .near)
  const nearRegex = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
  if (!nearRegex.test(clean)) return false;
  return clean.endsWith('.testnet') || clean.endsWith('.near') || clean.includes('.');
}

/**
 * 1. Validate Trade Order Payload (POST /api/agent/trade)
 */
function validateTradePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiGuardError(
      400,
      'INVALID_PAYLOAD_BODY',
      'Request body must be a valid JSON object.',
      null,
      'Send a JSON object with { sl, tp, token, amount, wallet }'
    );
  }

  const { sl, tp, token, amount, wallet, mode, webhookUrl, trailingStop, maxTrades } = body;

  // A. Caller Wallet Validation (Strict Invariant: Return Destination)
  if (!wallet || typeof wallet !== 'string' || !wallet.trim()) {
    throw new ApiGuardError(
      400,
      'MISSING_WALLET',
      'Caller wallet address ("wallet") is required. The vault must know where to refund your capital and profits.',
      'wallet',
      'Pass a valid NEAR account ID, e.g. "my_agent.testnet" or "trading_bot.near"'
    );
  }

  const cleanWallet = wallet.trim().toLowerCase();
  if (!isValidNearAccountId(cleanWallet)) {
    throw new ApiGuardError(
      400,
      'INVALID_WALLET_FORMAT',
      `"${wallet}" is not a valid NEAR Protocol account ID.`,
      'wallet',
      'Account IDs must be lowercase alphanumeric (2-64 chars) ending in .testnet or .near, or a 64-char hex key.',
      { provided: wallet }
    );
  }

  // B. Target Token Validation
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new ApiGuardError(
      400,
      'MISSING_TOKEN',
      'Target token identifier ("token") is required.',
      'token',
      'Specify token symbol or contract address (e.g. "wrap.testnet", "NEAR", "BTC", "ETH", "USDC")'
    );
  }

  // C. Allocation Amount Validation
  if (amount === undefined || amount === null) {
    throw new ApiGuardError(
      400,
      'MISSING_AMOUNT',
      'Allocation amount ("amount") in NEAR is required.',
      'amount',
      'Provide a numeric amount in NEAR, e.g. 1.0 or 0.05'
    );
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
    throw new ApiGuardError(
      400,
      'INVALID_AMOUNT',
      `Amount must be a positive finite number. Provided: ${amount}`,
      'amount',
      'Specify positive float e.g. 0.05, 1.0, 5.0'
    );
  }

  if (numAmount < 0.001) {
    throw new ApiGuardError(
      400,
      'AMOUNT_TOO_LOW',
      'Allocation amount must be at least 0.001 NEAR to cover storage and gas fees.',
      'amount',
      'Increase amount to at least 0.001 NEAR'
    );
  }

  if (numAmount > 10000) {
    throw new ApiGuardError(
      400,
      'AMOUNT_EXCEEDS_MAX',
      'Single trade allocation exceeds maximum safe testnet limit (10,000 NEAR).',
      'amount',
      'Reduce amount below 10,000 NEAR'
    );
  }

  // D. Stop-Loss Validation
  if (sl === undefined || sl === null) {
    throw new ApiGuardError(
      400,
      'MISSING_STOP_LOSS',
      'Stop-loss percentage ("sl") is strictly required for circuit breaker protection.',
      'sl',
      'Provide a percentage value between 0.1% and 50.0% (e.g. 5.0 for 5% Stop-Loss)'
    );
  }

  const numSl = Math.abs(parseFloat(sl));
  if (isNaN(numSl) || !isFinite(numSl)) {
    throw new ApiGuardError(
      400,
      'INVALID_STOP_LOSS',
      `Stop-loss must be a valid number. Provided: ${sl}`,
      'sl',
      'Provide numeric float e.g. 5.0'
    );
  }

  if (numSl < 0.1 || numSl > 50.0) {
    throw new ApiGuardError(
      400,
      'SL_OUT_OF_BOUNDS',
      `Stop-Loss of ${numSl}% is out of bounds. Must be between 0.1% and 50.0% to guarantee mathematical capital preservation.`,
      'sl',
      'Set stop-loss between 0.1 and 50.0 percent'
    );
  }

  // E. Take-Profit Validation
  if (tp === undefined || tp === null) {
    throw new ApiGuardError(
      400,
      'MISSING_TAKE_PROFIT',
      'Take-profit percentage ("tp") is required.',
      'tp',
      'Provide a target profit percentage between 0.5% and 500.0% (e.g. 10.0 for 10% TP)'
    );
  }

  const numTp = parseFloat(tp);
  if (isNaN(numTp) || !isFinite(numTp) || numTp <= 0) {
    throw new ApiGuardError(
      400,
      'INVALID_TAKE_PROFIT',
      `Take-profit must be a positive number. Provided: ${tp}`,
      'tp',
      'Provide positive numeric float e.g. 10.0'
    );
  }

  if (numTp < 0.5 || numTp > 500.0) {
    throw new ApiGuardError(
      400,
      'TP_OUT_OF_BOUNDS',
      `Take-Profit target of ${numTp}% is out of bounds. Must be between 0.5% and 500.0%.`,
      'tp',
      'Set take-profit between 0.5 and 500.0 percent'
    );
  }

  // F. Optional Webhook URL Validation
  if (webhookUrl) {
    if (typeof webhookUrl !== 'string' || (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://'))) {
      throw new ApiGuardError(
        400,
        'INVALID_WEBHOOK_URL',
        'Webhook callback URL must be a valid HTTP or HTTPS endpoint.',
        'webhookUrl',
        'Provide full URL e.g. "https://my-agent.ai/callback"'
      );
    }
  }

  // G. Optional Max Trades Validation
  if (maxTrades !== undefined) {
    const numTrades = parseInt(maxTrades);
    if (isNaN(numTrades) || numTrades < 1 || numTrades > 20) {
      throw new ApiGuardError(
        400,
        'INVALID_MAX_TRADES',
        'maxTrades must be an integer between 1 and 20.',
        'maxTrades',
        'Specify integer from 1 to 20'
      );
    }
  }

  return {
    wallet: cleanWallet,
    token: token.trim(),
    amount: numAmount,
    sl: -numSl, // normalize to negative drawdown
    tp: numTp,
    mode: mode === 'SHORT' ? 'SHORT' : 'TWO_WAY',
    webhookUrl: webhookUrl ? webhookUrl.trim() : null,
    trailingStop: Boolean(trailingStop === true || trailingStop === 'true'),
    maxTrades: maxTrades ? parseInt(maxTrades) : 1,
  };
}

/**
 * 2. Validate Position Exit Payload (POST /api/agent/exit)
 */
function validateExitPayload(body) {
  if (!body || typeof body !== 'object') {
    throw new ApiGuardError(
      400,
      'INVALID_EXIT_PAYLOAD',
      'Request body must be a JSON object.',
      null,
      'Send { orderId?: string, wallet?: string, reason?: string }'
    );
  }

  const { orderId, wallet, reason } = body;
  if (!orderId && !wallet) {
    throw new ApiGuardError(
      400,
      'MISSING_EXIT_TARGET',
      'Must provide either "orderId" or "wallet" to specify which position to exit.',
      'orderId',
      'Pass orderId (e.g. "ord_12345...") or caller wallet'
    );
  }

  if (wallet && !isValidNearAccountId(wallet)) {
    throw new ApiGuardError(
      400,
      'INVALID_WALLET_FORMAT',
      `"${wallet}" is not a valid NEAR Protocol account ID.`,
      'wallet',
      'Ensure account ID is valid testnet account'
    );
  }

  return {
    orderId: orderId ? String(orderId).trim() : null,
    wallet: wallet ? String(wallet).trim().toLowerCase() : null,
    reason: reason ? String(reason).trim() : 'Caller agent requested position close',
  };
}

/**
 * 3. Express Error Handling Middleware for Agent APIs
 * Formats all exceptions into structured, actionable JSON that AI Agents can parse
 */
function globalAgentErrorHandler(err, req, res, next) {
  // Catch JSON parsing errors from bad agent strings
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      code: 'MALFORMED_JSON',
      error: 'Invalid JSON payload. Check syntax, quotes, and commas.',
      remediation: 'Ensure payload is valid stringified JSON matching { sl, tp, token, amount, wallet }',
    });
  }

  // Catch ApiGuard Validation Errors
  if (err instanceof ApiGuardError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      error: err.message,
      field: err.field,
      remediation: err.remediation,
      details: err.details,
      timestamp: new Date().toISOString(),
    });
  }

  // General server/runtime unexpected exception
  console.error('💥 Unhandled Exception in Agent API:', err);
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_AGENT_ERROR',
    error: err.message || 'An unexpected error occurred while processing agent request.',
    remediation: 'Verify parameters and retry. If issue persists, check /health endpoint.',
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  ApiGuardError,
  isValidNearAccountId,
  validateTradePayload,
  validateExitPayload,
  globalAgentErrorHandler,
};
