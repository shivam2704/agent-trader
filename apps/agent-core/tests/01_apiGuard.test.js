// apps/agent-core/tests/01_apiGuard.test.js
// Production-grade Unit Test Suite for API Guard & Machine-Readable Validation

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  validateTradePayload,
  validateExitPayload,
  validateQuotePayload,
  isValidNearAccountId,
  ApiGuardError,
} = require('../apiGuard');

describe('Suite 1: NEAR Account Format & Cryptographic ID Validation', () => {
  it('should accept canonical testnet accounts (.testnet)', () => {
    assert.strictEqual(isValidNearAccountId('zerodrain-relayer-vault.testnet'), true);
    assert.strictEqual(isValidNearAccountId('agent_alpha.testnet'), true);
    assert.strictEqual(isValidNearAccountId('bot-123.testnet'), true);
  });

  it('should accept canonical mainnet accounts (.near)', () => {
    assert.strictEqual(isValidNearAccountId('alice.near'), true);
    assert.strictEqual(isValidNearAccountId('trader.near'), true);
  });

  it('should accept 64-character hex public keys', () => {
    const hexKey = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
    assert.strictEqual(isValidNearAccountId(hexKey), true);
  });

  it('should strictly reject Ethereum 0x addresses', () => {
    assert.strictEqual(isValidNearAccountId('0x71C8418c204d23791f6920f08f8b9a2c'), false);
    assert.strictEqual(isValidNearAccountId('0x0000000000000000000000000000000000000000'), false);
  });

  it('should reject invalid characters, spaces, and malformed strings', () => {
    assert.strictEqual(isValidNearAccountId('user name.testnet'), false);
    assert.strictEqual(isValidNearAccountId('user@near'), false);
    assert.strictEqual(isValidNearAccountId('bad_char$$.testnet'), false);
    assert.strictEqual(isValidNearAccountId(''), false);
    assert.strictEqual(isValidNearAccountId(null), false);
    assert.strictEqual(isValidNearAccountId(undefined), false);
  });
});

describe('Suite 2: Trade Order Payload Validation (POST /api/agent/trade)', () => {
  const baseValid = {
    token: 'wrap.testnet',
    amount: 1.0,
    sl: 5.0,
    tp: 10.0,
    wallet: 'agent.testnet',
  };

  it('should validate and normalize standard trade payload', () => {
    const res = validateTradePayload(baseValid);
    assert.strictEqual(res.wallet, 'agent.testnet');
    assert.strictEqual(res.token, 'wrap.testnet');
    assert.strictEqual(res.amount, 1.0);
    assert.strictEqual(res.sl, -5.0); // Drawdown normalized to negative
    assert.strictEqual(res.tp, 10.0);
    assert.strictEqual(res.mode, 'TWO_WAY');
    assert.strictEqual(res.trailingStop, false);
    assert.strictEqual(res.maxTrades, 1);
  });

  it('should accept minimum boundary amount (0.001 NEAR)', () => {
    const res = validateTradePayload({ ...baseValid, amount: 0.001 });
    assert.strictEqual(res.amount, 0.001);
  });

  it('should accept maximum boundary amount (10,000 NEAR)', () => {
    const res = validateTradePayload({ ...baseValid, amount: 10000 });
    assert.strictEqual(res.amount, 10000);
  });

  it('should accept tight SL boundary (0.1%) and wide SL boundary (50.0%)', () => {
    const tight = validateTradePayload({ ...baseValid, sl: 0.1 });
    assert.strictEqual(tight.sl, -0.1);

    const wide = validateTradePayload({ ...baseValid, sl: 50.0 });
    assert.strictEqual(wide.sl, -50.0);
  });

  it('should reject SL out of bounds (< 0.1% or > 50%)', () => {
    assert.throws(
      () => validateTradePayload({ ...baseValid, sl: 0.05 }),
      (err) => err instanceof ApiGuardError && err.code === 'SL_OUT_OF_BOUNDS'
    );
    assert.throws(
      () => validateTradePayload({ ...baseValid, sl: 55.0 }),
      (err) => err instanceof ApiGuardError && err.code === 'SL_OUT_OF_BOUNDS'
    );
  });

  it('should reject TP out of bounds (< 0.5% or > 500%)', () => {
    assert.throws(
      () => validateTradePayload({ ...baseValid, tp: 0.2 }),
      (err) => err instanceof ApiGuardError && err.code === 'TP_OUT_OF_BOUNDS'
    );
    assert.throws(
      () => validateTradePayload({ ...baseValid, tp: 550.0 }),
      (err) => err instanceof ApiGuardError && err.code === 'TP_OUT_OF_BOUNDS'
    );
  });

  it('should throw 400 MISSING_WALLET when wallet is missing', () => {
    const payload = { token: 'wrap.testnet', amount: 1.0, sl: 5.0, tp: 10.0 };
    assert.throws(
      () => validateTradePayload(payload),
      (err) => err instanceof ApiGuardError && err.code === 'MISSING_WALLET' && err.statusCode === 400
    );
  });

  it('should throw 400 MISSING_TOKEN when token is missing', () => {
    const payload = { wallet: 'agent.testnet', amount: 1.0, sl: 5.0, tp: 10.0 };
    assert.throws(
      () => validateTradePayload(payload),
      (err) => err instanceof ApiGuardError && err.code === 'MISSING_TOKEN' && err.statusCode === 400
    );
  });

  it('should throw 400 AMOUNT_TOO_LOW when amount < 0.001 NEAR', () => {
    assert.throws(
      () => validateTradePayload({ ...baseValid, amount: 0.0005 }),
      (err) => err instanceof ApiGuardError && err.code === 'AMOUNT_TOO_LOW'
    );
  });

  it('should throw 400 AMOUNT_EXCEEDS_MAX when amount > 10,000 NEAR', () => {
    assert.throws(
      () => validateTradePayload({ ...baseValid, amount: 15000 }),
      (err) => err instanceof ApiGuardError && err.code === 'AMOUNT_EXCEEDS_MAX'
    );
  });

  it('should validate advanced features: trailingStop and maxTrades campaign', () => {
    const res = validateTradePayload({
      ...baseValid,
      trailingStop: true,
      maxTrades: 3,
      webhookUrl: 'https://my-agent.ai/webhook',
    });
    assert.strictEqual(res.trailingStop, true);
    assert.strictEqual(res.maxTrades, 3);
    assert.strictEqual(res.webhookUrl, 'https://my-agent.ai/webhook');
  });

  it('should reject invalid webhook URL scheme', () => {
    assert.throws(
      () => validateTradePayload({ ...baseValid, webhookUrl: 'ftp://bad-url' }),
      (err) => err instanceof ApiGuardError && err.code === 'INVALID_WEBHOOK_URL'
    );
  });
});

describe('Suite 3: Position Exit Payload Validation (POST /api/agent/exit)', () => {
  it('should accept valid orderId exit', () => {
    const res = validateExitPayload({ orderId: 'ord_12345_abc' });
    assert.strictEqual(res.orderId, 'ord_12345_abc');
  });

  it('should accept valid wallet exit', () => {
    const res = validateExitPayload({ wallet: 'agent.testnet' });
    assert.strictEqual(res.wallet, 'agent.testnet');
  });

  it('should throw MISSING_EXIT_TARGET when neither orderId nor wallet is given', () => {
    assert.throws(
      () => validateExitPayload({}),
      (err) => err instanceof ApiGuardError && err.code === 'MISSING_EXIT_TARGET' && err.statusCode === 400
    );
  });
});

describe('Suite 4: Intent Quote Payload Validation (POST /api/intents/quote)', () => {
  it('should strictly require destinationToken without silent guessing', () => {
    assert.throws(
      () => validateQuotePayload({ amount: 1.0, wallet: 'agent.testnet' }),
      (err) => err instanceof ApiGuardError && err.code === 'MISSING_DESTINATION_TOKEN' && err.statusCode === 400
    );
  });

  it('should strictly require caller wallet', () => {
    assert.throws(
      () => validateQuotePayload({ destinationToken: 'USDC', amount: 1.0 }),
      (err) => err instanceof ApiGuardError && err.code === 'MISSING_WALLET' && err.statusCode === 400
    );
  });

  it('should accept valid quote payload with defaults for origin and slippage', () => {
    const res = validateQuotePayload({
      destinationToken: 'sol.omft.near',
      amount: 2.5,
      wallet: 'client.testnet',
    });
    assert.strictEqual(res.destinationToken, 'sol.omft.near');
    assert.strictEqual(res.amount, 2.5);
    assert.strictEqual(res.wallet, 'client.testnet');
    assert.strictEqual(res.originToken, 'wrap.testnet');
    assert.strictEqual(res.slippageToleranceBps, 50);
  });
});
