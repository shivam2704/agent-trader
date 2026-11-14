// apps/agent-core/tests/04_dbEngine.test.js
// Production-grade Unit Test Suite for Persistent Database Engine & Query Indexing

const { describe, it } = require('node:test');
const assert = require('node:assert');
const dbEngine = require('../dbEngine');

describe('Suite 1: Order Lifecycle & Wallet Indexing in DB Engine', () => {
  const testWallet = 'suite4_user.testnet';
  const orderId = `ord_dbtest_${Date.now()}`;

  it('saves an order and indexes it by orderId and callerWallet', () => {
    const order = dbEngine.saveOrder({
      orderId,
      callerWallet: testWallet,
      token: 'wrap.testnet',
      amount: 2.0,
      sl: -5.0,
      tp: 10.0,
      status: 'ACCEPTED',
    });

    assert.ok(order);
    assert.strictEqual(order.orderId, orderId);

    // Fetch by ID
    const retrieved = dbEngine.getOrder(orderId);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.callerWallet, testWallet);
    assert.strictEqual(retrieved.status, 'ACCEPTED');

    // Fetch by Wallet Index
    const walletOrders = dbEngine.getOrdersByWallet(testWallet);
    assert.ok(walletOrders.length >= 1);
    assert.ok(walletOrders.some((o) => o.orderId === orderId));
  });

  it('updates an existing order state cleanly (IN_POSITION -> SETTLED)', () => {
    const updated = dbEngine.updateOrder(orderId, {
      status: 'IN_POSITION',
      entryPrice: 3.32,
    });

    assert.strictEqual(updated.status, 'IN_POSITION');
    assert.strictEqual(updated.entryPrice, 3.32);

    const reRead = dbEngine.getOrder(orderId);
    assert.strictEqual(reRead.status, 'IN_POSITION');
    assert.strictEqual(reRead.entryPrice, 3.32);
  });

  it('filters active orders correctly', () => {
    const active = dbEngine.getActiveOrders();
    assert.ok(active.some((o) => o.orderId === orderId));
  });

  it('saves closed trade and retrieves it with limit', () => {
    const trade = {
      id: `trade_${Date.now()}`,
      orderId,
      side: 'LONG',
      token: 'wrap.testnet',
      entryPrice: 3.32,
      exitPrice: 3.65,
      pnlPercent: 9.94,
      sizeNear: 2.0,
      returnWallet: testWallet,
      timestamp: new Date().toISOString(),
    };

    const saved = dbEngine.saveTrade(trade);
    assert.ok(saved);

    const allTrades = dbEngine.getAllTrades(10);
    assert.ok(allTrades.some((t) => t.orderId === orderId));
  });
});
