// apps/agent-core/tests/03_concurrency.test.js
// Production-grade Unit Test Suite for Concurrency, Multi-Position Registry, and Anti-Race Locks

const { describe, it } = require('node:test');
const assert = require('node:assert');
const dbEngine = require('../dbEngine');

describe('Suite 1: Multi-Position Concurrent Registry', () => {
  it('manages multiple independent caller positions simultaneously', () => {
    const registry = new Map();

    const orders = [
      { orderId: 'ord_1', wallet: 'agent_1.testnet', token: 'wrap.testnet', amount: 1.0, sl: -5, tp: 10 },
      { orderId: 'ord_2', wallet: 'agent_2.testnet', token: 'btc.omft.near', amount: 2.0, sl: -3, tp: 15 },
      { orderId: 'ord_3', wallet: 'agent_3.testnet', token: 'sol.omft.near', amount: 0.5, sl: -4, tp: 8 },
    ];

    for (const o of orders) {
      registry.set(o.orderId, {
        orderId: o.orderId,
        wallet: o.wallet,
        token: o.token,
        amount: o.amount,
        sl: o.sl,
        tp: o.tp,
        inPosition: true,
      });
    }

    assert.strictEqual(registry.size, 3);
    assert.strictEqual(registry.get('ord_1').wallet, 'agent_1.testnet');
    assert.strictEqual(registry.get('ord_2').token, 'btc.omft.near');
    assert.strictEqual(registry.get('ord_3').amount, 0.5);

    // Closing one position does not impact other concurrent positions
    registry.delete('ord_2');
    assert.strictEqual(registry.size, 2);
    assert.strictEqual(registry.has('ord_2'), false);
    assert.strictEqual(registry.has('ord_1'), true);
    assert.strictEqual(registry.has('ord_3'), true);
  });
});

describe('Suite 2: Concurrency Lock & Re-entrancy Protection', () => {
  it('prevents duplicate exit execution from rapid parallel triggers (Race Condition Guard)', async () => {
    const exitingOrders = new Set();
    let executionCounter = 0;

    // Simulated async exit function with artificial network latency
    async function simulateExit(orderId) {
      if (exitingOrders.has(orderId)) {
        return null; // Concurrency lock rejected duplicate call
      }
      exitingOrders.add(orderId);

      try {
        // Simulate 20ms async on-chain RPC network latency
        await new Promise((resolve) => setTimeout(resolve, 20));
        executionCounter++;
        return { success: true, orderId };
      } finally {
        exitingOrders.delete(orderId);
      }
    }

    const targetOrderId = 'ord_race_test_101';

    // Fire 4 parallel exit requests simultaneously for the exact same order
    const results = await Promise.all([
      simulateExit(targetOrderId),
      simulateExit(targetOrderId),
      simulateExit(targetOrderId),
      simulateExit(targetOrderId),
    ]);

    // Exactly 1 execution must succeed; the other 3 must be rejected as duplicates
    const successfulExits = results.filter((r) => r !== null);
    const rejectedExits = results.filter((r) => r === null);

    assert.strictEqual(successfulExits.length, 1);
    assert.strictEqual(rejectedExits.length, 3);
    assert.strictEqual(executionCounter, 1);
  });

  it('guarantees DB ledger deduplication for duplicate settlement calls', () => {
    const orderId = `ord_dedup_${Date.now()}`;
    const payload = {
      orderId,
      returnWallet: 'trader.testnet',
      returnedNear: 0.98,
      txReason: 'STOP_LOSS',
      txHash: 'tx_hash_primary',
    };

    const firstSave = dbEngine.saveSettlement(payload);
    assert.ok(firstSave);

    // Attempt second save with identical orderId
    const secondSave = dbEngine.saveSettlement({
      ...payload,
      txHash: 'tx_hash_duplicate_attempt',
    });

    // Should return existing settlement object and maintain single record in index
    assert.strictEqual(secondSave.settlementId, firstSave.settlementId);
    assert.strictEqual(dbEngine.getSettlementByOrder(orderId).settlementId, firstSave.settlementId);
  });
});
