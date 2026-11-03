# ZeroDrain AI: Autonomous Headless Trading Agent on NEAR Protocol

> **"Payload In ➔ Trade & Manage ➔ Return Capital to Same Wallet — With Mathematical Risk Protection."**  
> An autonomous, non-custodial trading execution node built for AI agents and automated callers on **NEAR Protocol**, powered by **NEAR Intents & the Defuse 1-Click Swap Protocol (`1click.chaindefuser.com`)**.

---

## ⚡ Core Invariants & Key Features

### 1. 🤖 Headless Agent-to-Agent Architecture (Zero Human Wallet Connect)
- **Built for AI Agents, Not Humans:** Completely eliminates browser hot wallet connect extensions (Meteor, Sender, Nightly), popup modals, and human signing delays.
- **Payload-Driven Interface:** Any external AI agent, Telegram bot, or algorithmic script interacts strictly via clean REST API payloads:
  ```json
  {
    "sl": 5.0,
    "tp": 10.0,
    "token": "wbtc.fakes.testnet",
    "amount": 3.0,
    "wallet": "external_agent_alpha.testnet"
  }
  ```
- **Same-Wallet Return Guarantee:** The `wallet` address passed in the payload is cryptographically bound to the position. When the position exits (via Take-Profit, Stop-Loss circuit breaker, or manual exit), all settled capital and PnL are returned on-chain directly to that exact wallet.

### 2. 🔐 Intent-Bound Non-Custodial Smart Contract Vault (`zerodrain-relayer-vault.testnet`)
- **Zero Private Key Sharing:** Caller AI agents **never** expose or share private keys with the off-chain execution node.
- **On-Chain Invariant Lock (`deposit_and_arm`):** When an order is registered, capital is deposited into the NEAR smart contract, binding the `return_wallet`, `sl_basis_points`, and `tp_basis_points` immutably on-chain.
- **No Fund Diversion Guarantee (`settle_circuit_breaker`):** The off-chain relayer bot can **only** trigger settlements. The Rust smart contract strictly enforces `Promise::new(order.return_wallet).transfer(refund_token)`. No hacker, compromised server, or malicious actor can divert funds elsewhere.
- **Self-Sovereign Emergency Exit (`emergency_cancel`):** If the off-chain bot or server ever goes offline, the original owner who deposited can invoke `emergency_cancel(order_id)` on-chain at any time to immediately withdraw full capital back to their wallet.

### 3. 🎯 NEAR Intents & 1-Click Swap Protocol (Defuse Engine)
- Integrated directly with the **NEAR Intents / Defuse Protocol solver bus (`https://1click.chaindefuser.com`)**.
- **Zero-MEV & Zero AMM Slippage:** Competitive off-chain Solvers bid to fulfill the order atomically on-chain with guaranteed exact quotes.
- **Native Settlement Guarantees:** Solvers enforce `recipient: <wallet>` on entry/exit and `refundTo: <wallet>` on any execution anomaly.
- **Cross-Chain / Omnichain Liquidity:** Near-instant execution across Bitcoin, Ethereum, Solana, and Native NEAR assets via NEAR Chain Signatures.

### 4. 🛡️ Hard Stop-Loss Circuit Breaker ("Sb Khali Na Ho Jaye")
- Continuous sub-second mark-to-market position monitoring.
- If market volatility breaches the configured Stop-Loss threshold (e.g. `-5%`), the circuit breaker triggers:
  - Immediately liquidates active positions into NEAR/stablecoin.
  - Calls `settle_circuit_breaker` on `zerodrain-relayer-vault.testnet` which sends remaining capital (~95%) on-chain to the caller's `wallet`.
  - Halts further exposure to prevent account-drain catastrophic liquidation.

### 5. 🌐 200+ Coins Supported on NEAR Chain
- Dynamically loads and tracks **207+ tokens** from Defuse Protocol:
  - **NEAR Native (NEP-141) (33 Tokens):** `wNEAR`, `USDC`, `FRAX`, `AURORA`, `wBTC`, `BLACKDRAGON`, `SHITZU`, `LONK`, `REF`, `SWEAT`, etc.
  - **Omnichain Layer-1s:** `BTC`, `ETH`, `SOL`, `DOGE`, `XRP`, `TON`, `SUI`, `APTOS`, `AVAX`, `BNB`, `ADA`, `ZEC`.
  - **Stablecoins & DeFi:** `USDC`, `USDT`, `FRAX`, `DAI`, `USDD`, `LINK`, `UNI`.
- Live multi-source oracles (Kraken Orderbook + Coinbase Spot + Defuse Solver Depth).
- Automatic decimal precision formatting (from $80,000+ for BTC down to $0.000004 for micro-memes).

### 6. 📊 Real Multi-Timeframe Live Charting Engine
- Fully functional timeframe resolution:
  - **`TICK`:** High-frequency 3-second rapid ticks with seconds precision (`HH:mm:ss`) for scalping and live spread monitoring.
  - **`1m`:** 1-minute OHLC candlestick bars spanning the last 30 minutes.
  - **`5m`:** 5-minute OHLC candlestick bars spanning the last 2.5 hours for trend detection.
  - **`15m`:** 15-minute OHLC candlestick bars spanning the last 7.5 hours for macro session analysis.
- Interactive laser crosshair snapping precisely on curve data points with detailed OHLC and timestamp tooltips.
- Area Glow Flow view and Candlestick mode.

---

## 🏗️ Architecture Workflow

```
External AI Agent / Caller
   │
   ├─► POST /api/agent/trade { sl, tp, token, amount, wallet }
   │
   ▼
ZeroDrain Execution Node
   │
   ├── 1. Arms On-Chain Smart Contract Vault (`zerodrain-relayer-vault.testnet`)
   │      - Method: deposit_and_arm()
   │      - Immutably locks: order_id, return_wallet, sl_basis_points, tp_basis_points
   │
   ├── 2. Generates Defuse Protocol 1-Click Solver Intent Quote
   │      - Solver Auction: Zero-MEV, sub-block execution
   │      - Enforces: recipient = executor, refundTo = wallet
   │
   ├── 3. Executes on-chain entry on NEAR Testnet / Mainnet
   │
   ├── 4. Arms Hard Circuit Breaker & 24/7 Monitoring Loop
   │      - Tracks Real-Time PnL against SL / TP thresholds
   │
   ▼
Exit Triggered (Take-Profit | Stop-Loss Breached | Manual Close)
   │
   ├── 5. Resolves Position via Defuse Return Intent
   │
   └── 6. Smart Contract Autonomous Settlement
          - Relayer calls settle_circuit_breaker(order_id, refund_amount, reason)
          - Contract code executes: Promise::new(order.return_wallet).transfer(refund)
          - Cannot be redirected to any third-party or relayer address!
```

---

## 📡 Programmatic REST API Reference

### 1. Trade Entry (Agent API Gateway)
**`POST /api/agent/trade`**  
*(Aliases: `/api/v1/agent/execute`, `/api/agent/payload`)*

```bash
curl -X POST http://localhost:4000/api/agent/trade \
  -H "Content-Type: application/json" \
  -d '{
    "sl": 5.0,
    "tp": 10.0,
    "token": "wbtc.fakes.testnet",
    "amount": 3.0,
    "wallet": "external_agent_alpha.testnet",
    "mode": "TWO_WAY",
    "webhookUrl": "https://your-agent.ai/callback"
  }'
```

**Response:**
```json
{
  "success": true,
  "orderId": "ord_1793212065512_742dw",
  "status": "IN_POSITION",
  "activePositionsCount": 1,
  "agentReasoning": "⚡ Algorithmic Entry Executed: Initiated LONG position of 3 NEAR on WBTC. Circuit breaker floor anchored at -5%, take-profit ceiling at +10%. Routing via Defuse Omnichain Solver Network with Zero-MEV guarantee.",
  "intentQuote": {
    "quoteId": "defuse-intent-1793212066784-lb6mt4",
    "protocol": "NEAR Intents (Defuse Protocol 1-Click API)",
    "solverBus": "Defuse Omnichain Solver Network",
    "mevProtected": true,
    "origin": { "symbol": "wNEAR", "amountIn": 3.0 },
    "destination": { "symbol": "WBTC", "estimatedAmountOut": 2.9411 },
    "settlementGuarantee": {
      "recipient": "external_agent_alpha.testnet",
      "refundTo": "external_agent_alpha.testnet",
      "sameWalletReturn": true
    }
  },
  "circuitBreaker": {
    "maxDrawdownPercent": -5.0,
    "protectionActive": true,
    "guarantee": "Capital auto-liquidates & returns strictly to external_agent_alpha.testnet upon SL breach"
  }
}
```

---

### 2. Close Position & Return Funds (Order-Specific or Latest)
**`POST /api/agent/exit`**  
*(Alias: `/api/agent/close`)*

```bash
curl -X POST http://localhost:4000/api/agent/exit \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ord_1793212065512_742dw",
    "wallet": "external_agent_alpha.testnet",
    "reason": "AGENT_PROFIT_TAKE"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Position closed. Capital and PnL returned to wallet.",
  "returnWallet": "external_agent_alpha.testnet",
  "returnedNear": 3.245,
  "settlementReceipt": {
    "id": "trade_1793172654514",
    "side": "LONG",
    "entryPrice": 80823.9,
    "exitPrice": 88906.2,
    "pnlPercent": 10.0,
    "returnedNear": 3.245,
    "returnWallet": "external_agent_alpha.testnet",
    "returnTxHash": "return_tx_1793172654514_o6b5ah",
    "returnExplorerUrl": "https://testnet.nearblocks.io/txns/return_tx_1793172654514_o6b5ah"
  }
}
```

---

### 3. Query Order Status by Order ID (Persistent DB)
**`GET /api/agent/order/:orderId`**
```bash
curl http://localhost:4000/api/agent/order/ord_1793211198215_ahnpe
```
Returns live mark-to-market metrics (`stopLossFloor`, `takeProfitCeiling`, current PnL) if active, or complete settlement receipt if settled:
```json
{
  "success": true,
  "order": {
    "orderId": "ord_1793211198215_ahnpe",
    "callerWallet": "external_agent_alpha.testnet",
    "token": "wbtc.fakes.testnet",
    "amount": 3,
    "sl": -5,
    "tp": 10,
    "status": "SETTLED",
    "entryPrice": 4.6128
  },
  "settlement": {
    "settlementId": "stl_1793211217349_0i44",
    "returnWallet": "external_agent_alpha.testnet",
    "returnedNear": 2.9937,
    "exitReason": "MANUAL_CLOSE",
    "returnTxHash": "return_tx_1793211217347_nan4mh",
    "explorerUrl": "https://testnet.nearblocks.io/txns/return_tx_1793211217347_nan4mh"
  }
}
```

---

### 4. Query Orders by Caller Wallet
**`GET /api/agent/orders?wallet=external_agent_alpha.testnet`**
```bash
curl "http://localhost:4000/api/agent/orders?wallet=external_agent_alpha.testnet"
```

---

### 5. Query Settlement Receipts (Proof of Same-Wallet Return)
**`GET /api/agent/settlements?wallet=external_agent_alpha.testnet`**
```bash
curl "http://localhost:4000/api/agent/settlements?wallet=external_agent_alpha.testnet"
```

---

### 6. Agent Schema Discovery
**`GET /api/agent/schema`**  
Returns the programmatic capability contract for autonomous AI agents looking to discover and integrate with this node.

---

### 4. NEAR Intents / Defuse Protocol Quotes
**`POST /api/intents/quote`**
```bash
curl -X POST http://localhost:4000/api/intents/quote \
  -H "Content-Type: application/json" \
  -d '{
    "originToken": "wrap.near",
    "destinationToken": "btc.omft.near",
    "amount": 5.0,
    "wallet": "caller_agent.testnet"
  }'
```

---

### 5. Multi-Timeframe Market History
**`GET /api/market/history?symbol=NEAR&timeframe=5m`**  
Supported timeframes: `TICK`, `1m`, `5m`, `15m`.

---

### 6. Supported Tokens on NEAR Chain
**`GET /api/market/tokens`**  
Returns all 207+ tokens with live pricing, decimals, and contract identifiers.

---

## 🛠️ Production Monorepo Structure

```
agent-trader/
├── package.json                # Root Monorepo configuration with npm workspaces
├── apps/
│   ├── agent-core/             # 🧠 Autonomous Agent Trading Engine & Defuse Solver Daemon
│   │   ├── marketEngine.js     # 207+ Defuse tokens, multi-timeframe curves, RSI/EMA indicators
│   │   ├── nearIntentsEngine.js# Defuse Protocol 1-Click API solver quotes and atomic execution
│   │   ├── nearEngine.js       # NEAR RPC, on-chain execution, and return wallet settlement
│   │   ├── agentBrain.js       # Autonomous state machine, order lifecycle & SL circuit breaker
│   │   ├── server.js           # Express API (REST) & WebSocket real-time ticker stream
│   │   └── package.json        # @zerodrain/agent-core
│   │
│   └── trader-ui/              # 📈 Trading Cockpit, 200+ Token Navigation & Live Execution Terminal
│       ├── src/
│       │   ├── components/
│       │   │   ├── AdminPanel.jsx      # Agent API Gateway, payload dispatcher & Defuse quote preview
│       │   │   ├── LiveChart.jsx       # 200+ token navigation hub, TICK/1m/5m/15m multi-timeframe chart
│       │   │   ├── IndicatorGauges.jsx # Live RSI, EMA-9/21 trend indicators & autonomous AI reasoning
│       │   │   ├── PositionCard.jsx    # Active position PnL, circuit breaker floor, return wallet
│       │   │   ├── AgentTerminal.jsx   # Live system logs & on-chain settlement receipts
│       │   │   ├── TradeHistory.jsx    # Historical trade audit log with return settlement links
│       │   │   └── Navbar.jsx          # Live ticker status, active return wallet & fee metrics
│       │   ├── App.jsx         # Main reactive dashboard container with constrained grid layout
│       │   └── index.css       # Cyber-trading theme with neon bloom & glassmorphism
│       ├── vite.config.js
│       └── package.json        # @zerodrain/trader-ui
│
└── contracts/
    └── zero_drain_vault/       # NEAR Rust smart contract vault
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js:** v18+ (tested and verified on Node v20.20.2)
- **NEAR Account:** Any NEAR Testnet address (e.g. `yourname.testnet`)

### 2. Run via Monorepo Root Scripts
```bash
# Start Agent Core (Daemon Server on port 4000)
npm run start:agent

# In a separate terminal: Start Trader UI (Vite dev server on port 5173)
npm run dev:ui
```

### 3. Or Run Directly from App Directories
```bash
# Agent Core:
cd apps/agent-core
node server.js

# Trader UI:
cd apps/trader-ui
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## ☁️ Free Cloud Deployment Guide

The monorepo is engineered to deploy seamlessly on free-tier hosting providers with **zero additional code changes**:

### Option A: 1-Click Unified Deploy on Render.com (100% Free Single Web Service)
Render free tier provides 1 free Node web service. Because `agent-core` automatically serves the built `trader-ui` SPA, both the Frontend, Backend, and WebSocket run on a **single free Render URL**:
1. Push your repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), click **New +** -> **Blueprint**.
3. Select your repository. Render will automatically detect [`render.yaml`](file:///Users/shivam.sharma1/Documents/myProject/near/agent-trader/render.yaml):
   - **Build Command:** `npm run build:ui`
   - **Start Command:** `npm run start:agent`
   - **Health Check Path:** `/health`
4. Click **Apply**. Your app is live with SSL (`https://your-app.onrender.com`) and secure WebSockets (`wss://your-app.onrender.com`).

### Option B: Split Deploy (Vercel for UI + Render/Railway for Agent Core)
If you prefer hosting the React frontend on **Vercel** and the backend daemon on **Render**:
1. **Deploy Agent Core on Render/Railway:**
   - Root directory: `apps/agent-core`
   - Start command: `node server.js`
   - Health check: `/health`
   - Note the backend URL (e.g. `https://zerodrain-core.onrender.com`).
2. **Deploy Trader UI on Vercel:**
   - Root directory: `apps/trader-ui`
   - Framework preset: `Vite` (Pre-configured via [`apps/trader-ui/vercel.json`](file:///Users/shivam.sharma1/Documents/myProject/near/agent-trader/apps/trader-ui/vercel.json)).
   - Add Environment Variables in Vercel:
     - `VITE_API_BASE_URL` = `https://zerodrain-core.onrender.com`
     - `VITE_WS_URL` = `wss://zerodrain-core.onrender.com`

### Option C: Containerized Deploy (Railway / Fly.io / Koyeb / Docker)
Use the production multi-stage [`Dockerfile`](file:///Users/shivam.sharma1/Documents/myProject/near/agent-trader/Dockerfile):
```bash
docker build -t zerodrain-agent .
docker run -p 4000:4000 zerodrain-agent
```

---

## 🔒 Security & Invariants

1. **Strict Same-Wallet Return Guarantee:** Settled funds can NEVER be diverted to an arbitrary address. The caller's `wallet` provided in the incoming payload is strictly used for all return transfers.
2. **Hard Mathematical Drawdown Bounds:** Positions are auto-liquidated and halted the instant mark-to-market loss breaches the Stop-Loss percentage.
3. **Zero MEV / Sandwiching:** All token conversions leverage Defuse Protocol off-chain solver auctions to guarantee exact quote fills without on-chain frontrunning.
4. **Resilient Grid UI:** CSS Grid containers enforce `minWidth: 0` constraints, ensuring responsive stability without horizontal layout blowouts across 200+ tokens.
