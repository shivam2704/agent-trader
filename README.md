# ZeroDrain AI: Autonomous Headless Trading Agent on NEAR Protocol

> **"Payload In ➔ Trade & Manage ➔ Return Capital to Same Wallet — With Mathematical Risk Protection."**  
> An autonomous, non-custodial trading execution node built for AI agents and automated callers on **NEAR Protocol**, powered by **NEAR Intents & the Defuse 1-Click Swap Protocol (`1click.chaindefuser.com`)**.

---

## ⚡ Quick Start: How an AI Agent Uses ZeroDrain (In 3 Lines)

Any autonomous AI agent (ElizaOS, LangChain, AutoGPT, Python script, or Telegram bot) can execute and manage trades on NEAR **without sharing private keys or connecting browser extensions**.

### 1. Execute a Trade (Agent Invariant Payload)

```bash
curl -X POST http://localhost:4000/api/agent/trade \
  -H "Content-Type: application/json" \
  -d '{
    "token": "wbtc.fakes.testnet",
    "amount": 1.5,
    "sl": 5.0,
    "tp": 10.0,
    "wallet": "your_agent_wallet.testnet"
  }'
```

#### Python Example:
```python
import requests

payload = {
    "token": "wbtc.fakes.testnet",
    "amount": 1.5,
    "sl": 5.0,     # Circuit breaker at -5%
    "tp": 10.0,    # Take-profit at +10%
    "wallet": "your_agent_wallet.testnet" # Capital returned HERE
}

res = requests.post("http://localhost:4000/api/agent/trade", json=payload).json()
print("Order Placed:", res["orderId"])
```

#### JavaScript / Node.js Example:
```javascript
const res = await fetch("http://localhost:4000/api/agent/trade", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token: "wbtc.fakes.testnet",
    amount: 1.5,
    sl: 5.0,
    tp: 10.0,
    wallet: "your_agent_wallet.testnet"
  })
});
const data = await res.json();
console.log("Order ID:", data.orderId);
```

### 2. What Happens Automatically?
1. **On-Chain Vault Armed:** The node calls `deposit_and_arm` on the NEAR smart contract vault ([`zerodrain-relayer-vault.testnet`](https://testnet.nearblocks.io/address/zerodrain-relayer-vault.testnet)), immutably locking your `wallet` as the sole return destination.
2. **Defuse Solver Routing:** Routed via NEAR Intents / Defuse Protocol for Zero-MEV atomic fill.
3. **24/7 Monitoring:** If Take-Profit (+10%) or Stop-Loss (-5%) hits, the position auto-closes and **all funds return on-chain directly to `your_agent_wallet.testnet`**.
4. **Manual Exit Anytime:** Call `POST /api/agent/exit` with `{ "orderId": "..." }` to exit early.

---

## ⚡ Core Invariants & Features

### 1. 🤖 Headless Agent-to-Agent Architecture (Zero Human Wallet Connect)
- **Built for AI Agents:** Eliminates browser wallet extensions, popup signature modals, and human delays.
- **Strict Same-Wallet Return Guarantee:** The `wallet` address passed in the payload is cryptographically and mathematically locked to the position. Capital and PnL can **never** be routed to any other address.

### 2. 🔐 Intent-Bound Smart Contract Vault (`zerodrain-relayer-vault.testnet`)
- **Verified on NEAR Testnet:** Deployed contract at [`zerodrain-relayer-vault.testnet`](https://testnet.nearblocks.io/address/zerodrain-relayer-vault.testnet).
- **Zero Private Key Sharing:** Caller AI agents **never** expose or share private keys.
- **No Fund Diversion Guarantee:** The relayer can only invoke `settle_circuit_breaker`, which executes `Promise::new(order.return_wallet).transfer(...)`.
- **Emergency Sovereign Exit:** In the event of a catastrophic server outage, the caller can execute `emergency_cancel(order_id)` on-chain directly to withdraw 100% of deposited capital back to their wallet.

### 3. 🎯 NEAR Intents & 1-Click Swap Protocol (Defuse Engine)
- Direct integration with **NEAR Intents / Defuse Protocol solver bus (`https://1click.chaindefuser.com`)**.
- **Zero-MEV & Zero AMM Slippage:** Solvers bid off-chain to fill quotes atomically without frontrunning or sandwich attacks.
- **Omnichain Settlement:** Near-instant execution across Bitcoin, Ethereum, Solana, and Native NEAR assets via NEAR Chain Signatures.

### 4. 🛡️ Architectural Synergy: NEAR Intents Permissioning + ZeroDrain Sentinel
ZeroDrain is not a walled garden or a rival DEX — it is the **Real-Time Runtime Risk & Circuit-Breaker Sentinel for the NEAR Intents Agent Ecosystem**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        AGENT INTENT LIFECYCLE ON NEAR                                  │
└────────────────────────────────────────────────────────────────────────────────────────┘

  [Autonomous AI Agent]
          │
          │ 1. Signs Intent using Scoped NEAR Session Key / Allowance
          ▼
  ┌─────────────────────────────────────────────────────────┐
  │  NEAR INTENTS PERMISSIONING (PDP / Session Keys)        │  ◄── STATIC PRE-TRADE POLICY
  │  • Who can trade? (Agent Public Key)                    │      (Enforces bounds & budgets)
  │  • What methods? (swap, ft_transfer_call)               │
  │  • Allowance Cap? (Max allocation per session)          │
  └───────────────────────────┬─────────────────────────────┘
                              │
                              │ 2. Dispatches Execution Intent
                              ▼
  ┌─────────────────────────────────────────────────────────┐
  │  ZeroDrain.AI RUNTIME SENTINEL                          │  ◄── DYNAMIC POST-TRADE DEFENSE
  │  • Immutable Vault: Locks return_wallet on-chain        │      (Protects active capital)
  │  • Defuse Solver Route: 1-Click Zero-MEV execution     │
  │  • 24/7 Mark-to-Market Sentinel: 3s tick evaluation     │
  │  • Circuit Breaker Trigger: SL / TP / Trailing Ratchet   │
  └───────────────────────────┬─────────────────────────────┘
                              │
                              │ 3. On Breaker Hit: Auto-Settles & Refunds
                              ▼
  [Caller Vault / return_wallet on NEAR Testnet]  ◄── 100% Capital + PnL Auto-Returned
```

| Dimension | NEAR Intents Agent API (Permissioning Layer) | ZeroDrain.AI (Execution & Risk Sentinel) |
| :--- | :--- | :--- |
| **Domain** | Pre-Trade Static Authorization | Post-Trade Dynamic Risk Management |
| **Key Mechanism** | `add_public_key`, Scoped FunctionCall Keys, Allowances | Smart Contract Vault, Real-time Mark-to-Market Oracle Engine |
| **What It Prevents** | Unauthorized agent actions, rogue contract calls | Capital wipeout from market crashes, unhandled slippage shocks |
| **Capital Safety** | Limits how much an agent can spend | Guarantees funds return on-chain to `return_wallet` on SL/TP |

### 5. 🛑 Hard Stop-Loss Circuit Breaker ("Sb Khali Na Ho Jaye")
- Real-time mark-to-market position evaluation every 3 seconds.
- Instant liquidation and return of remaining capital (~95%) upon Stop-Loss trigger.

### 6. 🌐 200+ Coins Supported
- Dynamically discovers and tracks **207+ tokens** across NEAR Native (wNEAR, USDC, wBTC, REF, SWEAT, BLACKDRAGON), Omnichain Layer-1s (BTC, ETH, SOL, DOGE, XRP, TON, SUI), and Stables.
- Multi-source oracles with automatic decimal scaling (from $80,000+ BTC to $0.000004 meme tokens).

### 7. 📊 Live Real-Time Multi-Timeframe Charts & WebSockets
- **Timeframes:** `TICK` (3-sec scalping), `1m` (30 min bars), `5m` (trend analysis), and `15m` (macro).
- Live WebSocket stream (`ws://`) broadcasting order book ticks, mark-to-market PnL, and circuit breaker status.

---

## 🛡️ Enterprise API Guard & Exception Handling (for AI Agents)

To ensure autonomous AI callers never receive unhandled HTTP 500 errors or unparseable responses, all endpoints pass through `apiGuard.js` with machine-readable JSON error contracts:

| HTTP Status | Error Code | Description |
|---|---|---|
| `400 Bad Request` | `MALFORMED_JSON` | Incoming request body is not valid JSON. |
| `400 Bad Request` | `MISSING_REQUIRED_FIELDS` | Missing one or more: `wallet`, `token`, `amount`, `sl`, `tp`. |
| `400 Bad Request` | `INVALID_WALLET_FORMAT` | Invalid NEAR wallet (must be lowercase alphanumeric `.testnet`, `.near`, or 64-char hex key; Ethereum `0x...` addresses rejected). |
| `400 Bad Request` | `INVALID_AMOUNT` | Amount must be numeric, >= 0.001 NEAR and <= 10,000 NEAR. |
| `400 Bad Request` | `INVALID_STOP_LOSS` | Stop-loss must be between 0.1% and 50.0%. |
| `400 Bad Request` | `INVALID_TAKE_PROFIT` | Take-profit must be between 0.5% and 500.0%. |
| `404 Not Found` | `POSITION_NOT_FOUND` | Exit called for an order ID that does not exist or has already settled. |

#### Machine-Readable Error Response Example:
```json
{
  "success": false,
  "error": "INVALID_WALLET_FORMAT",
  "message": "Invalid NEAR wallet format. Must be a valid NEAR account ID (e.g. agent.testnet, my-agent.near, or 64-character hex public key).",
  "received": "0x71C...invalid",
  "help": "Use a valid NEAR testnet/mainnet account or 64-char public key."
}
```

---

## 📡 REST API Reference

### 1. Trade Entry (Agent API Gateway)
`POST /api/agent/trade` *(Aliases: `/api/v1/agent/execute`, `/api/agent/payload`)*

```bash
curl -X POST http://localhost:4000/api/agent/trade \
  -H "Content-Type: application/json" \
  -d '{
    "token": "wbtc.fakes.testnet",
    "amount": 2.0,
    "sl": 5.0,
    "tp": 10.0,
    "wallet": "external_agent_alpha.testnet",
    "mode": "TWO_WAY"
  }'
```

### 2. Manual Exit / Close Position
`POST /api/agent/exit` *(Alias: `/api/agent/close`)*

```bash
curl -X POST http://localhost:4000/api/agent/exit \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ord_1793212065512_742dw",
    "wallet": "external_agent_alpha.testnet",
    "reason": "AGENT_PROFIT_TAKE"
  }'
```

### 3. Query Order Status
`GET /api/agent/order/:orderId`

```bash
curl http://localhost:4000/api/agent/order/ord_1793212065512_742dw
```

### 4. Query All Orders by Caller Wallet
`GET /api/agent/orders?wallet=external_agent_alpha.testnet`

### 5. Query Settlement Receipts (Proof of Same-Wallet Return)
`GET /api/agent/settlements?wallet=external_agent_alpha.testnet`

### 6. Health & Liveness Check
`GET /health`  
Returns `{ "status": "HEALTHY", "node": "ZeroDrain AI Core", "uptimeSeconds": 1420 }`.

---

## 🚀 Cloud Deployment: Railway.app (Recommended)

Railway does not put free services to sleep after 15 minutes of inactivity, ensuring the 24/7 background Stop-Loss circuit breaker loop stays online continuously.

### Step-by-Step Railway Deployment:

1. **Push this repository to GitHub:**
   ```bash
   git add .
   git commit -m "feat: ZeroDrain AI production deployment"
   git push origin main
   ```

2. **Deploy on Railway:**
   - Log in to [Railway.app](https://railway.app).
   - Click **"New Project"** ➔ **"Deploy from GitHub repo"**.
   - Select your repository.
   - Railway will auto-detect [`railway.json`](file:///Users/shivam.sharma1/Documents/myProject/near/agent-trader/railway.json) & [`Dockerfile`](file:///Users/shivam.sharma1/Documents/myProject/near/agent-trader/Dockerfile) and begin the container build.

3. **Set Environment Variables in Railway:**
   In your Railway project, navigate to **Variables** and add:

   | Variable | Value | Description |
   |---|---|---|
   | `PORT` | `4000` | Service listening port |
   | `NODE_ENV` | `production` | Production environment flag |
   | `NEAR_NETWORK_ID` | `testnet` | NEAR network (`testnet` or `mainnet`) |
   | `NEAR_NODE_URL` | `https://test.rpc.fastnear.com` | High-speed NEAR RPC endpoint |
   | `NEAR_RELAYER_ACCOUNT_ID` | `zerodrain-relayer-vault.testnet` | Deployed vault smart contract account |
   | `NEAR_RELAYER_PRIVATE_KEY` | `ed25519:E8xHw2...` | Relayer signer key for vault settlements |
   | `DEFUSE_API_URL` | `https://1click.chaindefuser.com` | Defuse Protocol 1-Click Solver Bus |

4. **Generate Public Domain:**
   - Go to **Settings** ➔ **Public Networking**.
   - Click **"Generate Domain"**.
   - Your unified live trading node & visual dashboard is accessible immediately at `https://your-app.up.railway.app`.

---

## 💻 Local Development

### 1. Prerequisites
- **Node.js:** v18+ (verified on Node v20.20.2)
- **NEAR Account:** Any testnet account (e.g. `yourname.testnet`)

### 2. Install & Run
```bash
# Clone the repository
git clone <your-repo-url>
cd agent-trader

# Install monorepo dependencies
npm install

# Start both Agent Core and UI simultaneously:
npm run start:agent   # Runs backend daemon on http://localhost:4000
npm run dev:ui        # Runs frontend dev server on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## 🔒 Security & Mathematical Invariants

1. **Non-Custodial Design:** Caller private keys are never requested or stored.
2. **On-Chain Vault Enforcement:** The smart contract locks the caller's wallet upon order arming; settlement transactions are programmatically restricted to that exact account.
3. **MEV-Resistant Intent Routing:** Off-chain solver auctions prevent mempool frontrunning, sandwiching, and predatory slippage.
4. **Resilient Fail-Safe Circuit Breaker:** The 3-second continuous evaluation loop ensures orders are liquidated before catastrophic liquidation occurs.
