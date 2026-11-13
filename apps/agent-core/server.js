// backend/server.js
// Express API and WebSocket Streaming Server for ZeroDrain Trading Agent

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const marketEngine = require('./marketEngine');
const nearEngine = require('./nearEngine');
const agentBrain = require('./agentBrain');
const nearIntentsEngine = require('./nearIntentsEngine');
const dbEngine = require('./dbEngine');
const { validateTradePayload, validateExitPayload, globalAgentErrorHandler, ApiGuardError } = require('./apiGuard');
const { swaggerSpec, renderSwaggerHtml } = require('./swaggerDoc');

const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Initialize engines
nearEngine.init();

// --- REST Endpoints ---

// 1. Health check & Live NEAR status (Supported on both /health and /api/health for Render/Railway)
const handleHealth = async (req, res) => {
  const market = marketEngine.getMarketState();
  res.json({
    status: 'ONLINE',
    service: 'ZeroDrain Agent Core',
    network: 'near-testnet',
    nodeUrl: nearEngine.nodeUrl,
    latestPrice: market.price,
    agentStatus: agentBrain.status,
    timestamp: new Date().toISOString(),
  });
};
app.get('/health', handleHealth);
app.get('/api/health', handleHealth);
app.get('/v1/network', handleHealth); // Official NEAR Intents Agent API compatibility alias

// Interactive OpenAPI & Swagger 3.0 Documentation
app.get(['/docs', '/api/docs'], (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(renderSwaggerHtml());
});
app.get('/openapi.json', (req, res) => {
  res.json(swaggerSpec);
});

// 2. Real-Time Market Ticker & Indicators
app.get('/api/market/ticker', async (req, res) => {
  const state = await marketEngine.updateMarketPrice();
  res.json(state);
});

// 2.1 All tokens supported on NEAR Protocol (Native, Cross-Chain, Stablecoins, Ecosystem)
app.get(['/api/market/tokens', '/v1/tokens'], (req, res) => {
  res.json({
    success: true,
    tokens: marketEngine.getAllSupportedTokens(),
  });
});

// 2.15 Multi-timeframe market history (TICK, 1m, 5m, 15m)
app.get('/api/market/history', (req, res) => {
  const { symbol, timeframe } = req.query;
  const history = marketEngine.getTimeframeHistory(symbol || marketEngine.symbol, timeframe || '1m');
  res.json({
    success: true,
    symbol: symbol || marketEngine.symbol,
    timeframe: timeframe || '1m',
    history,
  });
});

// 2.2 Switch active chart tracking token
app.post('/api/market/switch-token', async (req, res) => {
  const { token, symbol } = req.body;
  const trackingSym = symbol || (token ? token.split('.')[0].toUpperCase() : 'NEAR');
  const targetContract = token || symbol || 'wrap.testnet';
  
  if (trackingSym) {
    marketEngine.setTrackingSymbol(trackingSym);
  }
  agentBrain.config.tokenPair = targetContract;
  
  const state = await marketEngine.updateMarketPrice();
  agentBrain.broadcast();
  res.json(state);
});

// 3. User NEAR Testnet Wallet details
app.get('/api/wallet/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const details = await nearEngine.getAccountDetails(accountId);
  res.json(details);
});

// 3.1 Create and fund real Testnet Account on NEAR
app.post('/api/wallet/create-testnet-account', async (req, res) => {
  const result = await nearEngine.createRealTestnetAccount();
  if (result.success) {
    agentBrain.updateConfig({ accountId: result.accountId });
  }
  res.json(result);
});

// 3.2 Import Testnet Key directly for testing & autonomous signing
app.post('/api/wallet/import-key', async (req, res) => {
  const { accountId, privateKey } = req.body;
  if (!accountId || !privateKey) {
    return res.status(400).json({ success: false, error: 'accountId and privateKey are required' });
  }
  const result = await nearEngine.importAccountPrivateKey(accountId, privateKey);
  if (result.success) {
    agentBrain.updateConfig({ accountId: result.accountId });
  }
  res.json(result);
});

// 3.5 Verify Token ID / NEP-141 contract on NEAR Testnet
app.get('/api/token/verify', async (req, res) => {
  const tokenId = req.query.tokenId || 'wrap.testnet';
  const verification = await nearEngine.verifyTokenContract(tokenId);
  res.json(verification);
});

// 3.6 NEAR Intents / 1-Click API (Defuse Protocol) Endpoints
app.get('/api/intents/tokens', async (req, res) => {
  const tokens = await nearIntentsEngine.getTokens();
  res.json({ success: true, count: tokens.length, tokens });
});

app.post('/api/intents/quote', async (req, res) => {
  try {
    const { originToken, destinationToken, amount, wallet, slippageToleranceBps } = req.body;
    const quote = await nearIntentsEngine.generateIntentQuote({
      originToken: originToken || 'wrap.near',
      destinationToken: destinationToken || '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
      amount: amount || 1.0,
      wallet: (wallet || agentBrain.config.wallet || '').trim(),
      slippageToleranceBps: slippageToleranceBps || 50,
    });
    res.json({ success: true, quote });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/intents/execute', async (req, res) => {
  try {
    const { quote } = req.body;
    const result = await nearIntentsEngine.executeIntentOrder(quote);
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- Core Agent-to-Agent Headless API ---
// Expected Payload: { sl, tp, token, amount, wallet, mode, executeImmediately }

// 4. Primary Agent API Trade Entry Endpoint (Guarded with Machine-Readable Validation)
app.post(['/api/agent/trade', '/api/v1/agent/execute', '/api/agent/payload'], async (req, res, next) => {
  try {
    const validated = validateTradePayload(req.body);
    const result = await agentBrain.handleAgentPayload({
      ...validated,
      executeImmediately: req.body.executeImmediately !== false, // default true
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 4.1 Agent API Exit / Close Position Endpoint (Supports Order-Specific Exit & Ownership Verification)
app.post(['/api/agent/exit', '/api/agent/close'], async (req, res, next) => {
  try {
    const validated = validateExitPayload(req.body);
    const { orderId, wallet, reason } = validated;

    // If orderId is provided, check if it belongs to wallet (if wallet is passed)
    if (orderId && wallet) {
      const existing = dbEngine.getOrder(orderId);
      if (existing && existing.callerWallet && existing.callerWallet.toLowerCase() !== wallet.toLowerCase()) {
        throw new ApiGuardError(
          403,
          'WALLET_MISMATCH',
          `Order ${orderId} does not belong to wallet "${wallet}". Capital can only be returned to original creator (${existing.callerWallet}).`,
          'wallet'
        );
      }
    }

    const receipt = await agentBrain.executeExit(orderId, 'AGENT_REQUESTED_CLOSE', reason);
    if (!receipt) {
      return res.status(404).json({
        success: false,
        code: 'POSITION_NOT_FOUND',
        error: orderId
          ? `No active in-position order found with ID '${orderId}'. It may have already exited or hit Stop-Loss.`
          : 'No active positions currently open to exit.',
        remediation: 'Call GET /api/agent/orders to verify active orders or GET /api/agent/settlements for exit receipts.',
        status: agentBrain.status,
      });
    }

    res.json({
      success: true,
      orderId: receipt.orderId,
      message: 'Position closed. Capital and PnL returned to caller wallet.',
      returnWallet: receipt.returnWallet,
      returnedNear: receipt.returnedNear,
      agentReasoning: receipt.agentReasoning,
      settlementReceipt: receipt,
    });
  } catch (err) {
    next(err);
  }
});

// 4.2 Query Specific Agent Order by Order ID (Persistent DB Lookup)
app.get('/api/agent/order/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = dbEngine.getOrder(orderId);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: `Order with ID '${orderId}' not found in persistent ledger.`,
      activeOrder: agentBrain.activeOrder?.orderId === orderId ? agentBrain.activeOrder : null,
    });
  }

  // If order is currently active in any concurrent position slot, enrich with live metrics
  let liveMetrics = null;
  const activePos = agentBrain.positions.get(orderId);
  if (activePos) {
    liveMetrics = {
      status: 'IN_POSITION',
      currentPrice: activePos.currentPrice,
      pnlPercent: activePos.pnlPercent,
      pnlUsd: activePos.pnlUsd,
      stopLossFloor: parseFloat((activePos.entryPrice * (1 + order.sl / 100)).toFixed(4)),
      takeProfitCeiling: parseFloat((activePos.entryPrice * (1 + order.tp / 100)).toFixed(4)),
    };
  }

  const settlement = dbEngine.getSettlementByOrder(orderId);

  res.json({
    success: true,
    order,
    liveMetrics,
    settlement,
  });
});

// 4.3 Query Orders by Wallet or Recent History
app.get('/api/agent/orders', (req, res) => {
  const { wallet, limit } = req.query;
  const max = Math.min(100, parseInt(limit) || 20);

  if (wallet) {
    const orders = dbEngine.getOrdersByWallet(wallet);
    return res.json({
      success: true,
      wallet: wallet.trim(),
      count: orders.length,
      orders: orders.slice(0, max),
    });
  }

  res.json({
    success: true,
    count: dbEngine.getAllOrders(max).length,
    orders: dbEngine.getAllOrders(max),
  });
});

// 4.4 Query Settlement Receipts (Proof of Same-Wallet Return)
app.get('/api/agent/settlements', (req, res) => {
  const { wallet, orderId } = req.query;

  if (orderId) {
    const settlement = dbEngine.getSettlementByOrder(orderId);
    return res.json({ success: true, settlement });
  }

  if (wallet) {
    const list = dbEngine.state.settlements.filter((s) => s.returnWallet === wallet.trim());
    return res.json({ success: true, count: list.length, settlements: list });
  }

  res.json({
    success: true,
    count: dbEngine.state.settlements.length,
    settlements: dbEngine.state.settlements.slice(0, 25),
  });
});

// 4.3 Schema documentation for external AI agents
app.get('/api/agent/schema', (req, res) => {
  res.json({
    endpoint: 'POST /api/agent/trade',
    method: 'POST',
    contentType: 'application/json',
    description: 'Autonomous non-custodial trading API powered by NEAR Intents & Defuse Protocol 1-Click Swap. Return funds sent to same wallet.',
    intentsProtocol: 'NEAR Intents (Defuse Protocol / 1click.chaindefuser.com)',
    solverBus: 'Defuse Omnichain Solver Network with Zero-MEV and Guaranteed Exact Quotes',
    payloadExample: {
      sl: 5.0,
      tp: 10.0,
      token: 'wrap.testnet',
      amount: 3.0,
      wallet: 'caller_agent.testnet',
      mode: 'TWO_WAY',
    },
    guarantee: 'On SL breach or exit, position is atomically resolved via Defuse Protocol Solvers and returned to `wallet` (same wallet guaranteed).',
  });
});

// 5. Update Agent Trading Config
app.post('/api/agent/config', (req, res) => {
  agentBrain.updateConfig(req.body);
  res.json({
    success: true,
    config: agentBrain.config,
  });
});

// 6. Start Autonomous Agent
app.post('/api/agent/start', async (req, res) => {
  const { sessionKey } = req.body;
  await agentBrain.start(sessionKey);
  res.json({
    success: true,
    status: agentBrain.status,
    message: 'Autonomous trading agent started successfully.',
  });
});

// 7. Stop Autonomous Agent
app.post('/api/agent/stop', (req, res) => {
  agentBrain.stop();
  res.json({
    success: true,
    status: agentBrain.status,
    message: 'Autonomous trading agent paused.',
  });
});

// 8. Emergency Kill Switch / Panic Liquidate
app.post('/api/agent/emergency-panic', async (req, res) => {
  await agentBrain.triggerEmergencyPanic();
  res.json({
    success: true,
    status: agentBrain.status,
    message: 'Emergency circuit breaker engaged. Positions liquidated to preserve capital.',
  });
});

// 9. Full Agent State (Compatible with /v1/status in NEAR Intents Agent API)
app.get(['/api/agent/state', '/v1/status'], (req, res) => {
  res.json(agentBrain.getFullState());
});

// 9.1 Smart Contract Vault Info & On-chain Queries
app.get('/api/vault/stats', async (req, res) => {
  try {
    const stats = await nearEngine.getVaultStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/vault/order/:orderId', async (req, res) => {
  try {
    const onChainOrder = await nearEngine.getVaultOrder(req.params.orderId);
    res.json({ success: true, orderId: req.params.orderId, onChainOrder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- HTTP & WebSocket Server Setup ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('🔌 Frontend client connected to WebSocket stream');

  // Send initial full state immediately
  ws.send(JSON.stringify({ type: 'STATE_UPDATE', data: agentBrain.getFullState() }));

  ws.on('close', () => {
    console.log('🔌 Frontend client disconnected');
  });
});

// Broadcast agent brain updates to all connected clients
agentBrain.onUpdate((state) => {
  const payload = JSON.stringify({ type: 'STATE_UPDATE', data: state });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
});

// Start continuous market polling ticker in background (every 3 seconds)
setInterval(async () => {
  await marketEngine.updateMarketPrice();
  if (agentBrain.status !== 'SCANNING' && agentBrain.status !== 'IN_POSITION') {
    agentBrain.broadcast();
  }
}, 3000);

// Serve static Trader UI files when deployed as a unified single-service container
const clientDistPath = path.join(__dirname, '../trader-ui/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/docs') || req.path === '/openapi.json') {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Express Error Handling Middleware for Autonomous AI Agents
app.use(globalAgentErrorHandler);

server.listen(PORT, () => {
  console.log(`🚀 ZeroDrain Backend Server running on http://localhost:${PORT}`);
  console.log(`⚡ WebSocket Stream active on ws://localhost:${PORT}`);
});
