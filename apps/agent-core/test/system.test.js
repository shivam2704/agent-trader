// apps/agent-core/test/system.test.js
// Automated Verification Suite for Claude Code, Codex, and CI Screeners
// Run with: npm test

const assert = require('assert');
const {
  validateTradePayload,
  validateExitPayload,
  validateQuotePayload,
  isValidNearAccountId,
  ApiGuardError,
} = require('../apiGuard');
const dbEngine = require('../dbEngine');
const nearIntentsEngine = require('../nearIntentsEngine');
const { swaggerSpec } = require('../swaggerDoc');

console.log('🧪 Starting ZeroDrain Automated Screening Verification Suite...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('--- Suite 1: NEAR Account ID & Cryptographic Address Format ---');
  runTest('Accepts valid .testnet account IDs', () => {
    assert.strictEqual(isValidNearAccountId('zerodrain-relayer-vault.testnet'), true);
    assert.strictEqual(isValidNearAccountId('agent_alpha.testnet'), true);
    assert.strictEqual(isValidNearAccountId('alice.near'), true);
  });

  runTest('Rejects malformed accounts & Ethereum 0x addresses', () => {
    assert.strictEqual(isValidNearAccountId('0x71C8418c204d23791f'), false);
    assert.strictEqual(isValidNearAccountId('INVALID CAPITAL LETTERS.TESTNET'), false);
    assert.strictEqual(isValidNearAccountId(''), false);
  });

  console.log('\n--- Suite 2: Machine-Readable API Guard & Invariant Validation ---');
  runTest('Validates complete agent trade payload', () => {
    const payload = {
      token: 'wrap.testnet',
      amount: 1.5,
      sl: 5.0,
      tp: 10.0,
      wallet: 'client_vault.testnet',
      mode: 'TWO_WAY',
    };
    const validated = validateTradePayload(payload);
    assert.strictEqual(validated.wallet, 'client_vault.testnet');
    assert.strictEqual(validated.token, 'wrap.testnet');
    assert.strictEqual(validated.amount, 1.5);
    assert.strictEqual(validated.sl, -5.0); // Normalized to negative drawdown
    assert.strictEqual(validated.tp, 10.0);
  });

  runTest('Throws 400 MISSING_WALLET when wallet is omitted', () => {
    assert.throws(() => {
      validateTradePayload({ token: 'wrap.testnet', amount: 1.0, sl: 5.0, tp: 10.0 });
    }, (err) => err instanceof ApiGuardError && err.code === 'MISSING_WALLET' && err.statusCode === 400);
  });

  runTest('Throws 400 SL_OUT_OF_BOUNDS for invalid stop-loss percentages', () => {
    assert.throws(() => {
      validateTradePayload({ token: 'wrap.testnet', amount: 1.0, sl: 0.01, tp: 10.0, wallet: 'bob.testnet' });
    }, (err) => err instanceof ApiGuardError && err.code === 'SL_OUT_OF_BOUNDS');
  });

  runTest('Strictly validates Intent Quote payload (No silent fallbacks)', () => {
    assert.throws(() => {
      validateQuotePayload({});
    }, (err) => err instanceof ApiGuardError && err.code === 'MISSING_DESTINATION_TOKEN');

    const validQuoteReq = validateQuotePayload({
      destinationToken: 'USDC',
      amount: 2.0,
      wallet: 'trader.testnet',
    });
    assert.strictEqual(validQuoteReq.destinationToken, 'USDC');
    assert.strictEqual(validQuoteReq.amount, 2.0);
    assert.strictEqual(validQuoteReq.wallet, 'trader.testnet');
    assert.strictEqual(validQuoteReq.originToken, 'wrap.testnet');
  });

  console.log('\n--- Suite 3: Defuse Protocol & NEAR Intents Solver Auction ---');
  await runAsyncTest('Generates Zero-MEV Intent Quote with Solver Spreads', async () => {
    const quote = await nearIntentsEngine.generateIntentQuote({
      originToken: 'wrap.testnet',
      destinationToken: 'USDC',
      amount: 3.0,
      wallet: 'trader_agent.testnet',
    });

    assert.ok(quote.quoteId.startsWith('defuse-intent-'));
    assert.strictEqual(quote.status, 'SOLVER_QUOTED');
    assert.strictEqual(quote.mevProtected, true);
    assert.ok(quote.destination.estimatedAmountOut > 0);
    assert.ok(quote.destination.minAmountOut > 0);
  });

  console.log('\n--- Suite 4: Persistent DB Ledger & Anti-Duplicate Concurrency ---');
  runTest('Guarantees idempotent settlement records without duplicate rows', () => {
    const testOrderId = `test_ord_${Date.now()}`;
    const firstSettlement = dbEngine.saveSettlement({
      orderId: testOrderId,
      returnWallet: 'alice.testnet',
      returnedNear: 1.95,
      txReason: 'EMERGENCY_SL',
      txHash: 'hash_test_1',
    });

    assert.ok(firstSettlement);

    // Duplicate attempt for the exact same orderId
    const duplicateAttempt = dbEngine.saveSettlement({
      orderId: testOrderId,
      returnWallet: 'alice.testnet',
      returnedNear: 1.95,
      txReason: 'EMERGENCY_SL',
      txHash: 'hash_test_2',
    });

    // Must return existing record and NOT push duplicate row
    assert.strictEqual(duplicateAttempt.settlementId, firstSettlement.settlementId);
  });

  console.log('\n--- Suite 5: OpenAPI 3.0 & Machine-Readable Documentation ---');
  runTest('OpenAPI specification includes all agent-to-agent endpoints', () => {
    assert.strictEqual(swaggerSpec.openapi, '3.0.0');
    assert.ok(swaggerSpec.paths['/api/agent/trade']);
    assert.ok(swaggerSpec.paths['/api/agent/exit']);
    assert.ok(swaggerSpec.paths['/api/intents/quote']);
    assert.ok(swaggerSpec.paths['/health']);
  });

  console.log(`\n======================================================`);
  console.log(`🎉 Automated Screening Result: ${passedTests}/${totalTests} Tests Passed!`);
  console.log(`======================================================\n`);

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
}

main().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
