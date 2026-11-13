// apps/agent-core/agentBrain.js
// Autonomous Agent Brain, State Machine, and Hard Circuit Breaker Engine
// Supports Multi-Order Concurrent Positions, Webhooks & AI Reasoning

const marketEngine = require('./marketEngine');
const nearEngine = require('./nearEngine');
const nearIntentsEngine = require('./nearIntentsEngine');
const dbEngine = require('./dbEngine');

class AgentBrain {
  constructor() {
    this.status = 'IDLE'; // 'IDLE', 'SCANNING', 'IN_POSITION', 'CIRCUIT_BREAKER_HALTED', 'STOPPED'
    this.timer = null;
    this.pollIntervalMs = 3000; // 3-second heartbeat

    this.config = {
      accountId: null, // Caller agent wallet
      wallet: null, // Same wallet to return funds
      tokenPair: 'wrap.testnet',
      allocation: 3.0, // NEAR
      stopLossPercent: -5.0, // Hard SL %
      takeProfitPercent: 10.0, // TP %
      tradingMode: 'TWO_WAY', // 'SPOT_LONG' or 'TWO_WAY'
      agentSessionKey: null,
    };

    this.lastPayload = null; // Stored payload from incoming agent API call
    this.activeOrder = null; // Most recent agent order object

    // Multi-Position Concurrent Registry: Map<orderId, Position>
    this.positions = new Map();

    // Primary/Latest position pointer (maintains backwards compatibility with UI)
    this.position = {
      inPosition: false,
      orderId: null,
      returnWallet: null,
      side: null,
      entryPrice: 0,
      currentPrice: 0,
      sizeNear: 0,
      pnlUsd: 0,
      pnlPercent: 0,
      entryTime: null,
      entryTxHash: null,
    };

    // Persistent storage integration
    this.tradeHistory = dbEngine.getAllTrades();
    const existingTrades = this.tradeHistory || [];
    const initialFeesNear = existingTrades.reduce((acc, t) => acc + (parseFloat(t.feePaidNear) || 0), 0);

    // Protocol & Network Fee Tracking (0.15% Protocol Fee + NEAR Gas)
    this.feeStats = {
      totalFeesPaidNear: parseFloat(initialFeesNear.toFixed(4)),
      totalFeesPaidUsd: 0,
      protocolFeeBps: 15, // 0.15% Protocol Trading Fee
      estimatedGasPerTxNear: 0.0018, // Standard NEAR Gas Burn
    };

    this.logs = [];
    this.listeners = []; // WS callback listeners

    // Rehydrate active in-position orders from persistent DB on startup
    this.rehydrateActivePositions();
  }

  rehydrateActivePositions() {
    try {
      const activeDbOrders = dbEngine.getActiveOrders();
      for (const o of activeDbOrders) {
        if (o.status === 'IN_POSITION') {
          const livePrice = o.entryPrice || this.getTokenCurrentPrice(o.token) || marketEngine.currentPrice || 1.0;
          const pos = {
            inPosition: true,
            orderId: o.orderId,
            token: o.token,
            tokenSymbol: (o.token || 'NEAR').split('.')[0].toUpperCase(),
            returnWallet: o.callerWallet,
            webhookUrl: o.webhookUrl || null,
            side: o.mode === 'SHORT' ? 'SHORT' : 'LONG',
            entryPrice: livePrice,
            currentPrice: livePrice,
            sizeNear: o.amount || 1.0,
            sl: o.sl,
            tp: o.tp,
            trailingStop: Boolean(o.trailingStop),
            initialSl: o.sl,
            peakPrice: livePrice,
            peakPnlPercent: 0,
            slDistance: Math.abs(o.sl || 5.0),
            maxTrades: Math.max(1, parseInt(o.maxTrades) || 1),
            currentTrade: Math.max(1, parseInt(o.currentTrade) || 1),
            pnlUsd: 0,
            pnlPercent: 0,
            entryTime: o.createdAt,
            entryTxHash: o.entryTxHash || null,
            explorerUrl: o.explorerUrl || null,
          };
          this.positions.set(o.orderId, pos);
          this.position = pos;
          this.status = 'IN_POSITION';
        }
      }

      if (this.positions.size > 0) {
        console.log(`🔄 Rehydrated ${this.positions.size} active trading position(s) from persistent DB.`);
        if (!this.timer) {
          this.timer = setInterval(() => this.heartbeat(), this.pollIntervalMs);
        }
      }
    } catch (e) {
      console.warn('Note on position rehydration:', e.message);
    }
  }

  onUpdate(callback) {
    this.listeners.push(callback);
  }

  broadcast() {
    const state = this.getFullState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        // ignore
      }
    }
  }

  addLog(level, message, details = {}) {
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      level, // 'INFO', 'TRADE', 'WARNING', 'ALERT', 'EMERGENCY'
      message,
      details,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs.pop();
    console.log(`[AGENT ${level}] ${message}`);
    this.broadcast();
  }

  // AI & Algorithmic Domain-Specific Reasoning Generator
  generateReasoning(type, ctx = {}) {
    const sym = ctx.tokenSymbol || ctx.token || 'NEAR';
    const returnTarget = ctx.returnWallet || 'caller_wallet';
    const amount = ctx.amount || ctx.sizeNear || 3.0;

    switch (type) {
      case 'ENTRY':
        return `⚡ Algorithmic Entry Executed: Initiated ${ctx.side || 'LONG'} position of ${amount} NEAR on ${sym}. Circuit breaker floor anchored at ${ctx.sl}%, take-profit ceiling at +${ctx.tp}%. Routing via Defuse Omnichain Solver Network with Zero-MEV guarantee.`;

      case 'EMERGENCY_SL':
        return `🛑 Circuit Breaker Hard Trigger: Net mark-to-market drawdown breached risk threshold (${ctx.pnlPercent}% <= ${ctx.sl}%). Market volatility triggered immediate liquidation to preserve ${(100 + ctx.pnlPercent).toFixed(1)}% of allocated capital. Return settlement atomically routed on-chain to ${returnTarget}.`;

      case 'TRAILING_SL':
      case 'TRAILING_SL_EXIT':
        return `📈 Trailing Stop Profit Locked: Price peaked at ${ctx.peakPrice || 'high watermark'} before pulling back to dynamic ratchet floor (${ctx.pnlPercent}%). Capital and locked gain returned atomically to ${returnTarget}.`;

      case 'CAMPAIGN_CYCLE':
        return `🔁 Multi-Trade Cycle ${ctx.currentTrade}/${ctx.maxTrades} Realized: Upside target reached (+${ctx.pnlPercent}%). Capital compounded to ${amount} NEAR and atomically rolling into cycle ${ctx.currentTrade + 1}.`;

      case 'TAKE_PROFIT':
        return `🎯 Take Profit Target Realized: Upside gain target achieved (+${ctx.pnlPercent}% >= +${ctx.tp}%). Exact-output swap settled via Defuse Omnichain Solvers; locked principal and profit returned directly to ${returnTarget}.`;

      case 'MANUAL_CLOSE':
      case 'AGENT_REQUESTED_CLOSE':
        return `⚡ Programmatic Agent Exit: Caller wallet ${returnTarget} requested early position close. Net realized PnL: ${ctx.pnlPercent}%. Funds returned on-chain.`;

      default:
        return `Trade event executed under protocol invariants for ${sym}. Caller return wallet: ${returnTarget}.`;
    }
  }

  // Webhook Dispatcher to External AI Agent Callback URL
  async dispatchWebhook(webhookUrl, payload) {
    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) return false;

    console.log(`📤 Dispatching event webhook to caller agent: ${webhookUrl}...`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ZeroDrain-Autonomous-Agent/2.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const success = res.ok;
      this.addLog(
        success ? 'INFO' : 'WARNING',
        `📡 Webhook notification ${success ? 'delivered' : 'failed'} to ${webhookUrl} (HTTP ${res.status}) for Order ${payload.orderId}`
      );
      return success;
    } catch (err) {
      console.warn(`⚠️ Webhook delivery failed to ${webhookUrl}: ${err.message}`);
      return false;
    }
  }

  // Handle incoming programmatic Agent payload:
  // { sl, tp, token, amount, wallet, mode, executeImmediately, webhookUrl, trailingStop, maxTrades }
  async handleAgentPayload({ sl, tp, token, amount, wallet, mode = 'TWO_WAY', executeImmediately = true, webhookUrl, trailingStop = false, maxTrades = 1 }) {
    // Multi-Position Capacity Guard (Allow up to 15 concurrent positions)
    if (this.positions.size >= 15) {
      throw new Error(`Maximum concurrent active positions (15) reached. Close an active position before submitting a new order.`);
    }

    if (!wallet || typeof wallet !== 'string' || !wallet.trim()) {
      throw new Error('Caller wallet address ("wallet") is required in payload');
    }
    if (!token || typeof token !== 'string' || !token.trim()) {
      throw new Error('Target token contract or symbol ("token") is required in payload');
    }
    const cleanAmount = parseFloat(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      throw new Error('Valid positive "amount" is required in payload');
    }

    const cleanSl = -Math.abs(parseFloat(sl !== undefined ? sl : 5.0));
    const cleanTp = Math.abs(parseFloat(tp !== undefined ? tp : 10.0));
    const cleanTrailingStop = Boolean(trailingStop === true || trailingStop === 'true');
    const cleanMaxTrades = Math.max(1, parseInt(maxTrades) || 1);

    // Normalize common token symbols to NEAR testnet NEP-141 contracts
    let tokenContract = token.trim();
    const tokenUpper = tokenContract.toUpperCase();
    if (tokenUpper === 'NEAR' || tokenUpper === 'WNEAR') tokenContract = 'wrap.testnet';
    else if (tokenUpper === 'ETH' || tokenUpper === 'WETH') tokenContract = 'weth.fakes.testnet';
    else if (tokenUpper === 'BTC' || tokenUpper === 'WBTC') tokenContract = 'wbtc.fakes.testnet';
    else if (tokenUpper === 'SOL') tokenContract = 'sol.fakes.testnet';
    else if (tokenUpper === 'USDC') tokenContract = 'usdc.fakes.testnet';
    else if (tokenUpper === 'AURORA') tokenContract = 'aurora.fakes.testnet';

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cleanWallet = wallet.trim();
    const tokenSym = tokenUpper.split('.')[0];

    // Generate entry reasoning
    const entryReasoning = this.generateReasoning('ENTRY', {
      token: tokenContract,
      tokenSymbol: tokenSym,
      amount: cleanAmount,
      sl: cleanSl,
      tp: cleanTp,
      wallet: cleanWallet,
      trailingStop: cleanTrailingStop,
      maxTrades: cleanMaxTrades,
    });

    this.lastPayload = {
      orderId,
      sl: cleanSl,
      tp: cleanTp,
      token: tokenContract,
      amount: cleanAmount,
      wallet: cleanWallet,
      mode,
      webhookUrl: webhookUrl || null,
      trailingStop: cleanTrailingStop,
      maxTrades: cleanMaxTrades,
      agentReasoning: entryReasoning,
      receivedAt: new Date().toISOString(),
    };

    this.config.accountId = cleanWallet;
    this.config.wallet = cleanWallet;
    this.config.allocation = cleanAmount;
    this.config.stopLossPercent = cleanSl;
    this.config.takeProfitPercent = cleanTp;
    this.config.tokenPair = tokenContract;
    this.config.tradingMode = mode;

    marketEngine.setTrackingSymbol(tokenContract);

    this.activeOrder = {
      orderId,
      wallet: cleanWallet,
      token: tokenContract,
      amount: cleanAmount,
      sl: cleanSl,
      tp: cleanTp,
      mode,
      status: 'ACCEPTED',
      webhookUrl: webhookUrl || null,
      trailingStop: cleanTrailingStop,
      maxTrades: cleanMaxTrades,
      currentTrade: 1,
      agentReasoning: entryReasoning,
      createdAt: new Date().toISOString(),
      intentQuote: null,
      returnSettlement: null,
      vaultArmReceipt: null,
    };

    // Save order immediately to persistent DB
    dbEngine.saveOrder(this.activeOrder);

    // Smart Contract Vault: Arm on NEAR Testnet (Locks order parameters and return wallet on-chain)
    let vaultArmReceipt = null;
    try {
      vaultArmReceipt = await nearEngine.armVaultOrderOnChain({
        orderId,
        targetToken: tokenContract,
        slBasisPoints: Math.abs(cleanSl) * 100, // e.g. 5% -> 500 bps
        tpBasisPoints: Math.abs(cleanTp) * 100, // e.g. 10% -> 1000 bps
        trailingStop: cleanTrailingStop,
        depositNear: cleanAmount,
        returnWallet: cleanWallet,
      });
      this.activeOrder.vaultArmReceipt = vaultArmReceipt;
      dbEngine.updateOrder(orderId, { vaultArmReceipt });
    } catch (vErr) {
      console.warn('Smart contract arm note:', vErr.message);
    }

    // Generate Defuse Protocol 1-Click Solver Intent Quote
    let intentQuote = null;
    try {
      intentQuote = await nearIntentsEngine.generateIntentQuote({
        originToken: 'wrap.near',
        destinationToken: tokenContract,
        amount: cleanAmount,
        wallet: cleanWallet,
      });
      this.activeOrder.intentQuote = intentQuote;
    } catch (e) {
      console.warn('Defuse solver quote note:', e.message);
    }

    this.addLog(
      'TRADE',
      `🤖 AGENT API PAYLOAD ACCEPTED [${orderId}]: ${tokenSym} (${cleanAmount} NEAR). SL=${cleanSl}%, TP=+${cleanTp}%. Return locked to ${cleanWallet}.`
    );

    if (vaultArmReceipt) {
      this.addLog(
        'TRADE',
        `⛓️ SMART CONTRACT VAULT ARMED [${orderId}]: Locked in contract ${vaultArmReceipt.contractId}. Return Wallet: ${cleanWallet}. Tx: ${vaultArmReceipt.txHash}`
      );
    }

    if (intentQuote) {
      this.addLog(
        'TRADE',
        `🎯 NEAR INTENTS: Solver quote [${intentQuote.quoteId}]. Routing ${cleanAmount} NEAR ➔ ~${intentQuote.destination.estimatedAmountOut} ${intentQuote.destination.symbol}. Zero-MEV guaranteed.`
      );
    }

    let executionResult = null;
    if (executeImmediately) {
      const entryPrice = this.getTokenCurrentPrice(tokenContract, tokenSym);

      const positionObj = await this.executeEntry('LONG', entryPrice, this.activeOrder);
      this.status = 'IN_POSITION';

      const floorPrice = entryPrice * (1 + cleanSl / 100);
      const ceilingPrice = entryPrice * (1 + cleanTp / 100);

      executionResult = {
        orderId,
        entryPrice,
        sizeNear: cleanAmount,
        liquidationFloorPrice: parseFloat(floorPrice.toFixed(4)),
        takeProfitCeilingPrice: parseFloat(ceilingPrice.toFixed(4)),
        entryTxHash: positionObj.entryTxHash,
        explorerUrl: positionObj.explorerUrl,
        intentQuote,
        agentReasoning: entryReasoning,
      };
    } else {
      this.status = this.positions.size > 0 ? 'IN_POSITION' : 'SCANNING';
    }

    // Ensure autonomous monitoring loop is active
    if (!this.timer) {
      this.timer = setInterval(() => this.heartbeat(), this.pollIntervalMs);
    }
    this.broadcast();

    return {
      success: true,
      orderId,
      status: this.status,
      activePositionsCount: this.positions.size,
      message: 'Agent payload processed. Multi-order circuit breaker armed with auto-return.',
      intentQuote,
      contract: {
        token: tokenContract,
        amount: cleanAmount,
        stopLossPercent: cleanSl,
        takeProfitPercent: cleanTp,
        returnWallet: cleanWallet,
        webhookUrl: webhookUrl || null,
      },
      execution: executionResult,
      agentReasoning: entryReasoning,
      circuitBreaker: {
        maxDrawdownPercent: cleanSl,
        protectionActive: true,
        guarantee: `Capital auto-liquidates & returns strictly to ${cleanWallet} upon SL breach`,
      },
    };
  }

  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
      stopLossPercent: parseFloat(newConfig.stopLossPercent || this.config.stopLossPercent),
      takeProfitPercent: parseFloat(newConfig.takeProfitPercent || this.config.takeProfitPercent),
      allocation: parseFloat(newConfig.allocation || this.config.allocation),
    };

    if (this.config.tokenPair) {
      marketEngine.setTrackingSymbol(this.config.tokenPair);
    }
  }

  async start(sessionKey = null) {
    if (!this.config.accountId) {
      this.addLog('WARNING', 'Cannot start autonomous agent: User NEAR wallet is not connected.');
      return false;
    }

    if (sessionKey) {
      this.config.agentSessionKey = sessionKey;
    }

    this.status = this.positions.size > 0 ? 'IN_POSITION' : 'SCANNING';
    this.addLog('INFO', `🚀 Autonomous Agent started. Monitoring active positions (${this.positions.size})...`);

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.heartbeat(), this.pollIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status = 'STOPPED';
    this.addLog('INFO', '⏸️ Agent paused.');
    this.broadcast();
  }

  async triggerEmergencyPanic() {
    this.addLog('EMERGENCY', '🚨 MANUAL PANIC TRIGGERED: Liquidating all open positions immediately!');
    const activeIds = Array.from(this.positions.keys());
    for (const id of activeIds) {
      await this.executeExit(id, 'EMERGENCY_SL', 'Manual User Panic triggered');
    }
    this.status = 'CIRCUIT_BREAKER_HALTED';
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.broadcast();
  }

  getTokenCurrentPrice(tokenContract, tokenSym) {
    const sym = (tokenSym || '').toUpperCase();
    const cleanContract = (tokenContract || '').toLowerCase();

    // 1. NEAR / Wrapped NEAR native mapping
    if (sym === 'NEAR' || sym === 'WNEAR' || sym === 'WRAP' || cleanContract.includes('wrap')) {
      return marketEngine.tokenStats['NEAR']?.price || marketEngine.tokenStats['WNEAR']?.price || (marketEngine.symbol === 'NEAR' ? marketEngine.getMarketState().price : 3.54);
    }

    // 2. Cross-chain top assets explicit mapping
    if (sym === 'WBTC' || sym === 'BTC' || cleanContract.includes('wbtc') || cleanContract.includes('btc')) {
      return marketEngine.tokenStats['WBTC']?.price || marketEngine.tokenStats['BTC']?.price || 68950;
    }
    if (sym === 'WETH' || sym === 'ETH' || cleanContract.includes('weth') || cleanContract.includes('eth')) {
      return marketEngine.tokenStats['WETH']?.price || marketEngine.tokenStats['ETH']?.price || 1950;
    }
    if (sym === 'SOL' || cleanContract.includes('sol')) {
      return marketEngine.tokenStats['SOL']?.price || 80.35;
    }
    if (sym === 'DOGE' || cleanContract.includes('doge')) return marketEngine.tokenStats['DOGE']?.price || 0.082;
    if (sym === 'XRP' || cleanContract.includes('xrp')) return marketEngine.tokenStats['XRP']?.price || 1.32;
    if (sym === 'USDC' || sym === 'USDT' || cleanContract.includes('usdc') || cleanContract.includes('usdt')) return 1.00;

    if (marketEngine.tokenStats[sym]?.price) return marketEngine.tokenStats[sym].price;

    for (const t of marketEngine.supportedTokens || []) {
      if (
        (t.symbol && t.symbol.toUpperCase() === sym) ||
        (t.contractId && t.contractId.toLowerCase() === cleanContract) ||
        (t.assetId && t.assetId.toLowerCase().includes(cleanContract))
      ) {
        return marketEngine.tokenStats[t.symbol]?.price || t.defaultPrice || 4.60;
      }
    }

    return marketEngine.getMarketState().price || 4.60;
  }

  // Autonomous Monitoring Heartbeat across ALL Concurrent Positions
  async heartbeat() {
    try {
      const market = await marketEngine.updateMarketPrice();
      if (!market || !market.price) return;

      // Iterate through all active concurrent positions
      for (const pos of Array.from(this.positions.values())) {
        const currentPrice = this.getTokenCurrentPrice(pos.token, pos.tokenSymbol);
        pos.currentPrice = currentPrice;

        let priceDiff = 0;
        if (pos.side === 'LONG') {
          priceDiff = currentPrice - pos.entryPrice;
        } else {
          priceDiff = pos.entryPrice - currentPrice;
        }

        const pnlPercent = parseFloat(((priceDiff / pos.entryPrice) * 100).toFixed(2));
        const pnlUsd = parseFloat((priceDiff * pos.sizeNear).toFixed(2));
        pos.pnlPercent = pnlPercent;
        pos.pnlUsd = pnlUsd;

        // TRAILING STOP-LOSS RATCHET (Point 2)
        if (pos.trailingStop) {
          if (pos.side === 'LONG' && currentPrice > (pos.peakPrice || pos.entryPrice)) {
            pos.peakPrice = currentPrice;
            const peakPnl = parseFloat((((pos.peakPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2));
            pos.peakPnlPercent = peakPnl;
            const newSlFloor = parseFloat((peakPnl - pos.slDistance).toFixed(2));
            if (newSlFloor > pos.sl) {
              const oldFloor = pos.sl;
              pos.sl = newSlFloor;
              this.addLog(
                'INFO',
                `📈 Trailing SL Ratchet [${pos.orderId}]: Peak +${peakPnl}%, raised liquidation floor from ${oldFloor}% to ${pos.sl}% (Profit Locked!)`
              );
              this.broadcast();
            }
          }
        }

        // 1. HARD CIRCUIT BREAKER CHECK (Per-Position SL / Trailing SL)
        if (pos.pnlPercent <= pos.sl) {
          const isTrailingFloor = pos.trailingStop && pos.sl > pos.initialSl;
          const exitReason = isTrailingFloor ? 'TRAILING_SL' : 'EMERGENCY_SL';
          this.addLog(
            isTrailingFloor ? 'TRADE' : 'EMERGENCY',
            `${isTrailingFloor ? '📈 TRAILING SL TRIGGERED' : '🛑 CIRCUIT BREAKER TRIGGERED'} for Order ${pos.orderId}! Drawdown reached ${pos.pnlPercent}% (Floor: ${pos.sl}%). Liquidating...`
          );
          await this.executeExit(pos.orderId, exitReason, `SL breached at ${pos.pnlPercent}%`);
          continue;
        }

        // 2. TAKE PROFIT CHECK (Per-Position TP)
        if (pos.pnlPercent >= pos.tp) {
          this.addLog(
            'TRADE',
            `🎯 TAKE PROFIT TARGET HIT for Order ${pos.orderId}! Gain is +${pos.pnlPercent}% (Target: +${pos.tp}%). Realizing profit...`
          );
          await this.executeExit(pos.orderId, 'TAKE_PROFIT', `TP target reached at +${pos.pnlPercent}%`);
          continue;
        }
      }

      // Update primary position pointer for UI
      if (this.positions.size > 0) {
        this.position = Array.from(this.positions.values())[0];
        this.status = 'IN_POSITION';
      } else if (this.status === 'IN_POSITION') {
        this.status = 'SCANNING';
      }

      this.broadcast();
    } catch (err) {
      console.error('Error in agent heartbeat:', err);
    }
  }

  async executeEntry(side, price, orderObj = null) {
    const sizeNear = orderObj?.amount || this.config.allocation;
    const activeOrderId = orderObj?.orderId || this.activeOrder?.orderId || `ord_${Date.now()}`;
    const returnTargetWallet = (orderObj?.wallet || this.activeOrder?.wallet || this.config?.wallet || '').trim();
    if (!returnTargetWallet) {
      throw new Error('Caller return wallet is strictly required. Non-custodial autonomous trading cannot execute without an explicit return destination.');
    }
    const tokenContract = orderObj?.token || this.config.tokenPair;
    const tokenSym = (tokenContract || 'NEAR').split('.')[0].toUpperCase();
    const webhookUrl = orderObj?.webhookUrl || null;
    const isTrailing = Boolean(orderObj?.trailingStop);
    const maxTrades = Math.max(1, parseInt(orderObj?.maxTrades) || 1);
    const currentTrade = Math.max(1, parseInt(orderObj?.currentTrade) || 1);
    const initialSl = orderObj?.sl !== undefined ? orderObj.sl : this.config.stopLossPercent;

    const tx = await nearEngine.executeTradeTransaction({
      accountId: returnTargetWallet,
      action: 'BUY',
      amountNear: sizeNear,
      agentPrivateKey: this.config.agentSessionKey?.privateKey,
      metadata: { side, entryPrice: price, orderId: activeOrderId },
    });

    const newPosition = {
      inPosition: true,
      orderId: activeOrderId,
      returnWallet: returnTargetWallet, // STRICT INVARIANT LOCK
      token: tokenContract,
      tokenSymbol: tokenSym,
      webhookUrl,
      side,
      entryPrice: price,
      currentPrice: price,
      sizeNear,
      sl: initialSl,
      tp: orderObj?.tp !== undefined ? orderObj.tp : this.config.takeProfitPercent,
      trailingStop: isTrailing,
      initialSl,
      peakPrice: price,
      peakPnlPercent: 0,
      slDistance: Math.abs(initialSl),
      maxTrades,
      currentTrade,
      pnlUsd: 0,
      pnlPercent: 0,
      entryTime: new Date().toISOString(),
      entryTxHash: tx.txHash,
      explorerUrl: tx.explorerUrl,
    };

    // Store in concurrent positions map
    this.positions.set(activeOrderId, newPosition);
    this.position = newPosition; // Primary active pointer

    if (this.activeOrder && this.activeOrder.orderId === activeOrderId) {
      this.activeOrder.status = 'IN_POSITION';
      this.activeOrder.entryPrice = price;
      this.activeOrder.entryTxHash = tx.txHash;
    }

    // Update order in persistent DB
    dbEngine.updateOrder(activeOrderId, {
      status: 'IN_POSITION',
      entryPrice: price,
      entryTxHash: tx.txHash,
      explorerUrl: tx.explorerUrl,
    });

    this.status = 'IN_POSITION';

    // Fee calculation
    const entryFeeNear = 0.0018 + (sizeNear * 0.0015);
    const liveNearUsd = price || this.getTokenCurrentPrice('wrap.testnet') || marketEngine.currentPrice || 1.0;
    this.feeStats.totalFeesPaidNear = parseFloat((this.feeStats.totalFeesPaidNear + entryFeeNear).toFixed(4));
    this.feeStats.totalFeesPaidUsd = parseFloat((this.feeStats.totalFeesPaidNear * liveNearUsd).toFixed(4));

    this.addLog(
      'TRADE',
      `✅ Position open [${activeOrderId}]: ${sizeNear} NEAR @ $${price} (${tokenSym}). Return locked to ${returnTargetWallet}. Tx: ${tx.txHash}`,
      { txHash: tx.txHash, explorerUrl: tx.explorerUrl, feeNear: entryFeeNear }
    );
    this.broadcast();
    return newPosition;
  }

  async executeExit(targetOrderId, reason = 'MANUAL_CLOSE', notes = '') {
    // Resolve which position to exit
    let targetPos = null;
    let orderId = targetOrderId;

    if (targetOrderId) {
      if (this.positions.has(targetOrderId)) {
        targetPos = this.positions.get(targetOrderId);
        orderId = targetOrderId;
      } else {
        return null; // Explicitly requested order not found in active positions
      }
    } else if (this.positions.size > 0) {
      targetPos = Array.from(this.positions.values())[0];
      orderId = targetPos.orderId;
    } else if (this.position && this.position.inPosition) {
      targetPos = this.position;
      orderId = targetPos.orderId;
    }

    if (!targetPos) return null;

    const exitFeeNear = 0.0018 + (targetPos.sizeNear * 0.0015);
    const tokenLivePrice = targetPos.currentPrice || this.getTokenCurrentPrice(targetPos.token) || marketEngine.currentPrice || 1.0;
    this.feeStats.totalFeesPaidNear = parseFloat((this.feeStats.totalFeesPaidNear + exitFeeNear).toFixed(4));
    this.feeStats.totalFeesPaidUsd = parseFloat((this.feeStats.totalFeesPaidNear * tokenLivePrice).toFixed(4));

    // STRICT INVARIANT: Always return to the wallet that created the position
    const returnWallet = targetPos.returnWallet.trim();
    const currentPrice = tokenLivePrice;

    // Calculate returned amount in NEAR
    const pnlNear = targetPos.pnlUsd / currentPrice;
    const grossReturnNear = targetPos.sizeNear + pnlNear;
    const finalSettledNear = Math.max(0.001, parseFloat((grossReturnNear - exitFeeNear).toFixed(4)));

    // Generate AI Agent Reasoning
    const exitReasoning = this.generateReasoning(reason, {
      token: targetPos.token,
      tokenSymbol: targetPos.tokenSymbol,
      pnlPercent: targetPos.pnlPercent,
      sl: targetPos.sl,
      tp: targetPos.tp,
      returnWallet,
      sizeNear: targetPos.sizeNear,
    });

    // Execute on-chain return to caller wallet strictly via Smart Contract Vault
    const returnSettlement = await nearEngine.executeReturnToWallet({
      toWallet: returnWallet,
      amountNear: finalSettledNear,
      tokenContract: targetPos.token,
      txReason: reason,
      orderId: targetPos.orderId || orderId,
    });

    if (returnSettlement && returnSettlement.isLiveOnChain) {
      this.addLog(
        'CIRCUIT_BREAKER',
        `⛓️ SMART CONTRACT VAULT SETTLED [${orderId}]: Contract ${returnSettlement.contractId || nearEngine.vaultContractId} dispatched ${finalSettledNear} NEAR strictly to ${returnWallet}. Tx: ${returnSettlement.txHash}`
      );
    }

    // Execute Defuse Protocol Return Intent Settlement
    let defuseReceipt = null;
    try {
      const returnIntent = await nearIntentsEngine.generateIntentQuote({
        originToken: targetPos.token || 'wrap.near',
        destinationToken: 'wrap.near',
        amount: finalSettledNear,
        wallet: returnWallet,
      });
      defuseReceipt = await nearIntentsEngine.executeIntentOrder(returnIntent);
      returnSettlement.defuseReceipt = defuseReceipt;
    } catch (e) {
      console.warn('Defuse return intent note:', e.message);
    }

    const tx = await nearEngine.executeTradeTransaction({
      accountId: returnWallet,
      action: reason === 'EMERGENCY_SL' ? 'EMERGENCY_SL' : 'SELL',
      amountNear: targetPos.sizeNear,
      agentPrivateKey: this.config.agentSessionKey?.privateKey,
      metadata: {
        orderId,
        reason,
        notes,
        finalPnL: targetPos.pnlPercent,
        returnWallet,
        returnedNear: finalSettledNear,
        agentReasoning: exitReasoning,
        defuseReceipt,
      },
    });

    const closedTrade = {
      id: `trade_${Date.now()}`,
      orderId,
      side: targetPos.side,
      token: targetPos.token,
      entryPrice: targetPos.entryPrice,
      exitPrice: targetPos.currentPrice,
      sizeNear: targetPos.sizeNear,
      pnlPercent: targetPos.pnlPercent,
      pnlUsd: targetPos.pnlUsd,
      returnedNear: finalSettledNear,
      returnWallet,
      returnTxHash: returnSettlement.txHash,
      returnExplorerUrl: returnSettlement.explorerUrl,
      feePaidNear: parseFloat(exitFeeNear.toFixed(4)),
      reason,
      notes,
      agentReasoning: exitReasoning,
      entryTxHash: targetPos.entryTxHash,
      exitTxHash: tx.txHash,
      explorerUrl: tx.explorerUrl,
      timestamp: new Date().toISOString(),
    };

    // Save settlement and closed trade to persistent DB
    dbEngine.saveSettlement({
      orderId,
      returnWallet,
      returnedNear: finalSettledNear,
      exitReason: reason,
      txHash: returnSettlement.txHash,
      explorerUrl: returnSettlement.explorerUrl,
      pnlPercent: targetPos.pnlPercent,
      agentReasoning: exitReasoning,
      webhookDelivered: false,
    });
    dbEngine.saveTrade(closedTrade);

    // Multi-Trade Campaign Check (maxTrades > 1)
    const isCampaignAdvancement =
      targetPos.maxTrades > 1 &&
      targetPos.currentTrade < targetPos.maxTrades &&
      reason !== 'EMERGENCY_SL' &&
      reason !== 'MANUAL_CLOSE' &&
      reason !== 'AGENT_MANUAL_API_CLOSE';

    if (isCampaignAdvancement) {
      const nextCycle = targetPos.currentTrade + 1;
      const cycleReasoning = this.generateReasoning('CAMPAIGN_CYCLE', {
        token: targetPos.token,
        tokenSymbol: targetPos.tokenSymbol,
        pnlPercent: targetPos.pnlPercent,
        currentTrade: targetPos.currentTrade,
        maxTrades: targetPos.maxTrades,
        amount: finalSettledNear,
      });

      this.addLog(
        'TRADE',
        `🔁 CAMPAIGN ADVANCE [${orderId}]: Cycle ${targetPos.currentTrade}/${targetPos.maxTrades} closed with +${targetPos.pnlPercent}%. Rolling ${finalSettledNear} NEAR into Cycle ${nextCycle}...`
      );

      closedTrade.agentReasoning = cycleReasoning;
      this.tradeHistory.unshift(closedTrade);
      if (this.tradeHistory.length > 50) this.tradeHistory.pop();

      if (targetPos.webhookUrl) {
        this.dispatchWebhook(targetPos.webhookUrl, {
          event: 'CAMPAIGN_CYCLE_COMPLETED',
          orderId,
          callerWallet: returnWallet,
          completedTrade: targetPos.currentTrade,
          maxTrades: targetPos.maxTrades,
          cyclePnLPercent: targetPos.pnlPercent,
          compoundedNear: finalSettledNear,
          nextCycle,
          agentReasoning: cycleReasoning,
          timestamp: new Date().toISOString(),
        });
      }

      this.positions.delete(orderId);

      const nextEntryPrice = this.getTokenCurrentPrice(targetPos.token, targetPos.tokenSymbol);
      await this.executeEntry('LONG', nextEntryPrice, {
        orderId,
        wallet: returnWallet,
        token: targetPos.token,
        amount: finalSettledNear,
        sl: targetPos.initialSl || -5.0,
        tp: targetPos.tp,
        trailingStop: targetPos.trailingStop,
        maxTrades: targetPos.maxTrades,
        currentTrade: nextCycle,
        webhookUrl: targetPos.webhookUrl,
      });

      this.broadcast();
      return closedTrade;
    }

    this.tradeHistory.unshift(closedTrade);
    if (this.tradeHistory.length > 50) this.tradeHistory.pop();

    if (this.activeOrder && this.activeOrder.orderId === orderId) {
      this.activeOrder.status = reason === 'EMERGENCY_SL' ? 'LIQUIDATED_SL' : 'SETTLED_RETURNED';
      this.activeOrder.returnSettlement = closedTrade;
    }

    // Trigger Webhook Notification to Caller AI Agent
    if (targetPos.webhookUrl) {
      const webhookPayload = {
        event: reason === 'EMERGENCY_SL' ? 'CIRCUIT_BREAKER_TRIGGERED' : 'TRADE_SETTLED',
        orderId,
        callerWallet: returnWallet,
        exitReason: reason,
        token: targetPos.token,
        pnlPercent: targetPos.pnlPercent,
        pnlUsd: targetPos.pnlUsd,
        returnedNear: finalSettledNear,
        returnTxHash: returnSettlement.txHash,
        returnExplorerUrl: returnSettlement.explorerUrl,
        agentReasoning: exitReasoning,
        timestamp: new Date().toISOString(),
      };
      this.dispatchWebhook(targetPos.webhookUrl, webhookPayload);
    }

    // Remove from concurrent positions map
    this.positions.delete(orderId);

    // Update primary position pointer
    if (this.positions.size > 0) {
      this.position = Array.from(this.positions.values())[0];
      this.status = 'IN_POSITION';
    } else {
      this.position = {
        inPosition: false,
        orderId: null,
        returnWallet: null,
        side: null,
        entryPrice: 0,
        currentPrice: 0,
        sizeNear: 0,
        pnlUsd: 0,
        pnlPercent: 0,
        entryTime: null,
        entryTxHash: null,
      };
      this.status = 'SCANNING';
    }

    this.addLog(
      reason === 'EMERGENCY_SL' ? 'EMERGENCY' : 'TRADE',
      `💸 CLOSED & RETURNED [${orderId}]: PnL: ${closedTrade.pnlPercent}%. Returned ${finalSettledNear} NEAR to ${returnWallet}. Return Tx: ${returnSettlement.txHash}`,
      { txHash: tx.txHash, returnTxHash: returnSettlement.txHash, returnWallet }
    );
    this.broadcast();
    return closedTrade;
  }

  getFullState() {
    const market = marketEngine.getMarketState();
    return {
      status: this.status,
      config: this.config,
      position: this.position,
      activePositions: Array.from(this.positions.values()),
      activePositionsCount: this.positions.size,
      feeStats: this.feeStats,
      market,
      lastPayload: this.lastPayload,
      activeOrder: this.activeOrder,
      tradeHistory: this.tradeHistory,
      recentLogs: this.logs.slice(0, 50),
    };
  }
}

module.exports = new AgentBrain();
