// apps/agent-core/dbEngine.js
// Production-grade persistent embedded database for autonomous AI agent orders and settlements.
// Features atomic flush, zero-native-compilation overhead, and instant query indexing.

const fs = require('fs');
const path = require('path');

class DBEngine {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.dbFile = path.join(this.dataDir, 'agent_ledger.json');
    this.tmpFile = path.join(this.dataDir, 'agent_ledger.json.tmp');

    // In-memory data store
    this.state = {
      orders: [],
      settlements: [],
      trades: [],
      metadata: {
        version: '1.0.0',
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      },
    };

    // Fast indexed caches
    this.ordersById = new Map();
    this.ordersByWallet = new Map();
    this.settlementsByOrder = new Map();
    this.settlementsByWallet = new Map();

    this.initialized = false;
    this.init();
  }

  init() {
    if (this.initialized) return;

    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dbFile)) {
        const raw = fs.readFileSync(this.dbFile, 'utf8');
        if (raw && raw.trim()) {
          this.state = JSON.parse(raw);
          console.log(`🗄️ Loaded persistent DB: ${this.state.orders.length} orders, ${this.state.trades.length} trades.`);
        }
      } else {
        this.flush();
        console.log('🗄️ Initialized new persistent DB ledger at apps/agent-core/data/agent_ledger.json');
      }

      this.rebuildIndexes();
      this.initialized = true;
    } catch (err) {
      console.error('❌ Failed to initialize DB engine:', err.message);
      // Fallback with clean state
      this.rebuildIndexes();
    }
  }

  rebuildIndexes() {
    this.ordersById.clear();
    this.ordersByWallet.clear();
    this.settlementsByOrder.clear();
    this.settlementsByWallet.clear();

    for (const order of this.state.orders || []) {
      this.ordersById.set(order.orderId, order);
      const w = order.wallet || order.callerWallet;
      if (w) {
        if (!this.ordersByWallet.has(w)) this.ordersByWallet.set(w, []);
        this.ordersByWallet.get(w).push(order);
      }
    }

    for (const s of this.state.settlements || []) {
      if (s.orderId) this.settlementsByOrder.set(s.orderId, s);
      const w = s.returnWallet || s.toWallet;
      if (w) {
        if (!this.settlementsByWallet.has(w)) this.settlementsByWallet.set(w, []);
        this.settlementsByWallet.get(w).push(s);
      }
    }
  }

  // Atomic write to prevent file corruption during server restarts
  flush() {
    try {
      this.state.metadata.lastUpdated = new Date().toISOString();
      const serialized = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(this.tmpFile, serialized, 'utf8');
      fs.renameSync(this.tmpFile, this.dbFile);
    } catch (err) {
      console.error('❌ Error saving to persistent DB:', err.message);
    }
  }

  // --- Order Operations ---

  saveOrder(order) {
    if (!order || !order.orderId) return null;
    const now = new Date().toISOString();

    const record = {
      orderId: order.orderId,
      callerWallet: order.wallet || order.callerWallet,
      token: order.token,
      amount: order.amount,
      sl: order.sl,
      tp: order.tp,
      mode: order.mode || 'TWO_WAY',
      status: order.status || 'ACCEPTED',
      entryPrice: order.entryPrice || null,
      intentQuote: order.intentQuote || null,
      webhookUrl: order.webhookUrl || null,
      agentReasoning: order.agentReasoning || null,
      createdAt: order.createdAt || now,
      updatedAt: now,
    };

    const existingIdx = (this.state.orders || []).findIndex((o) => o.orderId === record.orderId);
    if (existingIdx >= 0) {
      this.state.orders[existingIdx] = { ...this.state.orders[existingIdx], ...record };
    } else {
      this.state.orders.unshift(record);
    }

    this.ordersById.set(record.orderId, record);
    const w = record.callerWallet;
    if (w) {
      if (!this.ordersByWallet.has(w)) this.ordersByWallet.set(w, []);
      this.ordersByWallet.get(w).unshift(record);
    }

    this.flush();
    return record;
  }

  updateOrder(orderId, patch) {
    const existing = this.ordersById.get(orderId);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    const idx = this.state.orders.findIndex((o) => o.orderId === orderId);
    if (idx >= 0) {
      this.state.orders[idx] = updated;
    }

    this.ordersById.set(orderId, updated);
    this.flush();
    return updated;
  }

  getOrder(orderId) {
    return this.ordersById.get(orderId) || null;
  }

  getOrdersByWallet(wallet) {
    if (!wallet) return [];
    return this.ordersByWallet.get(wallet.trim()) || [];
  }

  getActiveOrder() {
    return (this.state.orders || []).find((o) => o.status === 'ACCEPTED' || o.status === 'IN_POSITION') || null;
  }

  getActiveOrders() {
    return (this.state.orders || []).filter((o) => o.status === 'ACCEPTED' || o.status === 'IN_POSITION');
  }

  // --- Settlement & Trade Records ---

  saveSettlement(settlement) {
    if (!settlement) return null;
    const now = new Date().toISOString();

    const record = {
      settlementId: settlement.settlementId || `stl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderId: settlement.orderId,
      returnWallet: settlement.returnWallet || settlement.toWallet,
      returnedNear: settlement.returnedNear || settlement.amountNear,
      exitReason: settlement.txReason || settlement.reason || 'MANUAL_CLOSE',
      returnTxHash: settlement.txHash || settlement.returnTxHash,
      explorerUrl: settlement.explorerUrl || settlement.returnExplorerUrl,
      pnlPercent: settlement.pnlPercent || 0,
      agentReasoning: settlement.agentReasoning || null,
      webhookDelivered: settlement.webhookDelivered || false,
      settledAt: now,
    };

    this.state.settlements.unshift(record);
    if (record.orderId) this.settlementsByOrder.set(record.orderId, record);

    const w = record.returnWallet;
    if (w) {
      if (!this.settlementsByWallet.has(w)) this.settlementsByWallet.set(w, []);
      this.settlementsByWallet.get(w).unshift(record);
    }

    // Update corresponding order status to SETTLED
    if (record.orderId) {
      this.updateOrder(record.orderId, {
        status: record.exitReason === 'EMERGENCY_SL' ? 'LIQUIDATED_SL' : 'SETTLED',
        settlementId: record.settlementId,
        returnTxHash: record.returnTxHash,
        explorerUrl: record.explorerUrl,
      });
    }

    this.flush();
    return record;
  }

  getSettlementByOrder(orderId) {
    return this.settlementsByOrder.get(orderId) || null;
  }

  saveTrade(trade) {
    if (!trade) return null;
    this.state.trades.unshift(trade);
    if (this.state.trades.length > 500) {
      this.state.trades.pop();
    }
    this.flush();
    return trade;
  }

  getAllTrades(limit = 50) {
    return (this.state.trades || []).slice(0, limit);
  }

  getAllOrders(limit = 50) {
    return (this.state.orders || []).slice(0, limit);
  }
}

const dbEngine = new DBEngine();
module.exports = dbEngine;
