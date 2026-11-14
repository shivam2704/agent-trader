// apps/agent-core/tests/05_nearIntents.test.js
// Production-grade Unit Test Suite for NEAR Intents & Defuse 1-Click Protocol

const { describe, it } = require('node:test');
const assert = require('node:assert');
const nearIntentsEngine = require('../nearIntentsEngine');

describe('Suite 1: NEAR Intents Token Catalog & Asset Resolution', () => {
  it('discovers and loads token catalog across omnichain assets', async () => {
    const tokens = await nearIntentsEngine.getTokens();
    assert.ok(tokens.length >= 5);

    const symbols = tokens.map((t) => t.symbol);
    assert.ok(symbols.includes('NEAR'));
    assert.ok(symbols.includes('BTC'));
    assert.ok(symbols.includes('ETH'));
    assert.ok(symbols.includes('USDC'));
  });

  it('resolves asset by symbol (case-insensitive)', async () => {
    const btc = await nearIntentsEngine.resolveAsset('btc');
    assert.ok(btc);
    assert.strictEqual(btc.symbol, 'BTC');
    assert.ok(btc.price > 10000);
  });

  it('resolves asset by contract address', async () => {
    const wnear = await nearIntentsEngine.resolveAsset('wrap.near');
    assert.ok(wnear);
    assert.ok(wnear.symbol.toUpperCase().includes('NEAR'));
  });
});

describe('Suite 2: Defuse Solver Auction Quote & Execution', () => {
  it('generates exact Zero-MEV intent quote with atomic solver routing', async () => {
    const quote = await nearIntentsEngine.generateIntentQuote({
      originToken: 'wrap.testnet',
      destinationToken: 'USDC',
      amount: 10.0,
      wallet: 'caller_agent.testnet',
      slippageToleranceBps: 50, // 0.5%
    });

    assert.ok(quote.quoteId.startsWith('defuse-intent-'));
    assert.strictEqual(quote.protocol, 'NEAR Intents (Defuse Protocol 1-Click API)');
    assert.strictEqual(quote.solverBus, 'Defuse Omnichain Solver Network');
    assert.strictEqual(quote.mevProtected, true);
    assert.strictEqual(quote.origin.amountIn, 10.0);

    // Verify mathematical bounds on solver fee & minAmountOut
    assert.ok(quote.destination.estimatedAmountOut > 0);
    assert.ok(quote.destination.minAmountOut < quote.destination.estimatedAmountOut);
    // Min out must be roughly 99.5% of estimated out (0.5% slippage tolerance)
    const expectedRatio = quote.destination.minAmountOut / quote.destination.estimatedAmountOut;
    assert.ok(expectedRatio >= 0.994 && expectedRatio <= 0.996);
  });

  it('executes intent quote and returns settlement receipt', async () => {
    const quote = await nearIntentsEngine.generateIntentQuote({
      originToken: 'wrap.testnet',
      destinationToken: 'USDC',
      amount: 1.0,
      wallet: 'caller_agent.testnet',
    });

    const receipt = await nearIntentsEngine.executeIntentOrder(quote);
    assert.strictEqual(receipt.success, true);
    assert.strictEqual(receipt.quoteId, quote.quoteId);
    assert.strictEqual(receipt.status, 'FILLED_ON_CHAIN');
    assert.ok(receipt.txHash);
    assert.ok(receipt.receiptUrl);
  });
});
