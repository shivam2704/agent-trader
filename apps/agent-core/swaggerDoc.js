// apps/agent-core/swaggerDoc.js
// Complete OpenAPI 3.0.0 Specification & Swagger UI Renderer for ZeroDrain AI Node

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'ZeroDrain AI: Autonomous Trading Execution Node API',
    version: '1.0.0',
    description: `
**ZeroDrain AI** is a non-custodial, headless trading execution node and on-chain risk guardrail engine for autonomous AI agents on **NEAR Protocol**.

### Core Invariants:
* **Zero Private Key Sharing:** Caller AI agents never disclose private keys.
* **Smart Contract Vault Locked:** Orders are armed via \`zerodrain-relayer-vault.testnet\`.
* **Guaranteed Same-Wallet Return:** Realized profits and liquidated capital return strictly to the caller's \`wallet\`.
* **Zero-MEV Solver Bus:** Trades routed via NEAR Intents / Defuse Protocol 1-Click Solver network.
* **Stop-Loss Circuit Breaker:** Mark-to-market positions auto-liquidate if drawdown breaches the Stop-Loss threshold.
    `,
    contact: {
      name: 'ZeroDrain AI Team',
      url: 'https://testnet.nearblocks.io/address/zerodrain-relayer-vault.testnet',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current Environment (Live Render / Localhost)',
    },
    {
      url: 'https://zerodrain-agent-trader.onrender.com',
      description: 'Production Live Node (Render Cloud)',
    },
  ],
  tags: [
    { name: 'Agent Trading', description: 'Headless trade execution, order lifecycle, and exit endpoints' },
    { name: 'Market Data & Oracles', description: 'Live price tickers, 207+ supported tokens, and multi-timeframe candle charts' },
    { name: 'NEAR Intents (Defuse)', description: 'Zero-MEV 1-Click Solver quote generation and atomic execution' },
    { name: 'Smart Contract Vault', description: 'On-chain deposit arming, circuit breaker settlements, and account stats' },
    { name: 'System & Health', description: 'Liveness probes, system metrics, and capability schemas' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System & Health'],
        summary: 'Health & Liveness Probe',
        description: 'Returns the operational status of the ZeroDrain node, active NEAR RPC node URL, and current agent state.',
        responses: {
          200: {
            description: 'Node is healthy and connected to NEAR network.',
            content: {
              'application/json': {
                example: {
                  status: 'ONLINE',
                  service: 'ZeroDrain Agent Core',
                  network: 'near-testnet',
                  nodeUrl: 'https://test.rpc.fastnear.com',
                  latestPrice: 3.56,
                  agentStatus: 'IDLE',
                  timestamp: '2026-11-13T12:42:35.341Z',
                },
              },
            },
          },
        },
      },
    },
    '/api/agent/trade': {
      post: {
        tags: ['Agent Trading'],
        summary: 'Execute Trade & Arm Smart Contract Vault',
        description: 'Primary entry point for external AI agents. Locks order in the NEAR vault, gets Defuse solver quote, and activates 24/7 Stop-Loss circuit breaker monitoring.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'amount', 'sl', 'tp', 'wallet'],
                properties: {
                  token: {
                    type: 'string',
                    description: 'Target token identifier or NEP-141 contract on NEAR.',
                    example: 'wbtc.fakes.testnet',
                  },
                  amount: {
                    type: 'number',
                    description: 'Amount in NEAR allocated to this order (min: 0.001, max: 10000).',
                    example: 1.5,
                  },
                  sl: {
                    type: 'number',
                    description: 'Stop-Loss drawdown percentage (0.1% to 50.0%).',
                    example: 5.0,
                  },
                  tp: {
                    type: 'number',
                    description: 'Take-Profit target gain percentage (0.5% to 500.0%).',
                    example: 10.0,
                  },
                  wallet: {
                    type: 'string',
                    description: 'Caller agent NEAR account ID. Capital & profit return strictly HERE.',
                    example: 'external_agent_alpha.testnet',
                  },
                  mode: {
                    type: 'string',
                    enum: ['TWO_WAY', 'SPOT_LONG'],
                    default: 'TWO_WAY',
                    description: 'Trading strategy mode.',
                  },
                  webhookUrl: {
                    type: 'string',
                    nullable: true,
                    description: 'Optional callback URL pinged upon trade settlement.',
                    example: 'https://my-agent.ai/callback',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Trade successfully initiated and armed on-chain.',
            content: {
              'application/json': {
                example: {
                  success: true,
                  orderId: 'ord_1794573776952_st9op',
                  status: 'IN_POSITION',
                  activePositionsCount: 1,
                  message: 'Agent payload processed. Multi-order circuit breaker armed with auto-return.',
                  agentReasoning: '⚡ Algorithmic Entry Executed: Initiated LONG position of 1.5 NEAR on WBTC...',
                },
              },
            },
          },
          400: {
            description: 'Validation failed via apiGuard (e.g. invalid wallet, out-of-bounds SL/TP).',
          },
        },
      },
    },
    '/api/agent/exit': {
      post: {
        tags: ['Agent Trading'],
        summary: 'Manual Early Exit & Immediate Fund Return',
        description: 'Closes an open position and triggers smart contract settlement back to caller wallet.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  orderId: {
                    type: 'string',
                    description: 'Specific order ID to exit (omit to exit latest position).',
                    example: 'ord_1794573776952_st9op',
                  },
                  wallet: {
                    type: 'string',
                    description: 'Caller wallet address for ownership verification.',
                    example: 'external_agent_alpha.testnet',
                  },
                  reason: {
                    type: 'string',
                    description: 'Reason code or commentary for settlement audit trail.',
                    example: 'AI_AGENT_PROFIT_TAKE',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Position successfully settled on-chain.',
            content: {
              'application/json': {
                example: {
                  success: true,
                  orderId: 'ord_1794573776952_st9op',
                  message: 'Position closed. Capital and PnL returned to caller wallet.',
                  returnWallet: 'external_agent_alpha.testnet',
                  returnedNear: 1.502,
                  settlementReceipt: {
                    returnTxHash: 'return_tx_1794573796106_ekzfij',
                    returnExplorerUrl: 'https://testnet.nearblocks.io/txns/return_tx_1794573796106_ekzfij',
                  },
                },
              },
            },
          },
          404: {
            description: 'Position not found or already settled.',
          },
        },
      },
    },
    '/api/agent/order/{orderId}': {
      get: {
        tags: ['Agent Trading'],
        summary: 'Query Order Details & Live Metrics',
        description: 'Returns persistent order record enriched with live mark-to-market PnL and Stop-Loss liquidation floor.',
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'ord_1794573776952_st9op',
          },
        ],
        responses: {
          200: {
            description: 'Order found.',
          },
          404: {
            description: 'Order ID not found.',
          },
        },
      },
    },
    '/api/agent/orders': {
      get: {
        tags: ['Agent Trading'],
        summary: 'Query Orders by Wallet Address',
        parameters: [
          {
            name: 'wallet',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filter orders by caller wallet.',
            example: 'external_agent_alpha.testnet',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          200: {
            description: 'List of matching orders.',
          },
        },
      },
    },
    '/api/agent/settlements': {
      get: {
        tags: ['Agent Trading'],
        summary: 'Query Proof-of-Return Settlements',
        description: 'Returns on-chain settlement receipts with NEAR blockchain explorer transaction hashes.',
        parameters: [
          {
            name: 'wallet',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            example: 'external_agent_alpha.testnet',
          },
        ],
        responses: {
          200: {
            description: 'List of settled trade receipts.',
          },
        },
      },
    },
    '/api/market/ticker': {
      get: {
        tags: ['Market Data & Oracles'],
        summary: 'Live Market Ticker & Quant Indicators',
        description: 'Returns real-time price, RSI-14, EMA-9, EMA-21, MACD, and autonomous AI momentum reasoning.',
        responses: {
          200: {
            description: 'Current market indicators.',
          },
        },
      },
    },
    '/api/market/tokens': {
      get: {
        tags: ['Market Data & Oracles'],
        summary: 'List All 207+ Supported Tokens on NEAR',
        description: 'Returns all 207+ Defuse Protocol and NEAR Native assets with live USD spot rates, decimals, and contract addresses.',
        responses: {
          200: {
            description: 'Array of supported tokens.',
          },
        },
      },
    },
    '/api/market/history': {
      get: {
        tags: ['Market Data & Oracles'],
        summary: 'Multi-Timeframe Candlestick & Tick History',
        parameters: [
          {
            name: 'symbol',
            in: 'query',
            required: false,
            schema: { type: 'string', default: 'NEAR' },
          },
          {
            name: 'timeframe',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['TICK', '1m', '5m', '15m'], default: '1m' },
          },
        ],
        responses: {
          200: {
            description: 'Timeframe candle array.',
          },
        },
      },
    },
    '/api/intents/quote': {
      post: {
        tags: ['NEAR Intents (Defuse)'],
        summary: 'Get 1-Click Swap Quote from Solver Bus',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  originToken: { type: 'string', example: 'wrap.near' },
                  destinationToken: { type: 'string', example: 'wbtc.fakes.testnet' },
                  amount: { type: 'number', example: 2.0 },
                  wallet: { type: 'string', example: 'external_agent_alpha.testnet' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Solver intent quote generated.',
          },
        },
      },
    },
    '/api/vault/stats': {
      get: {
        tags: ['Smart Contract Vault'],
        summary: 'Live On-Chain Vault Stats',
        description: 'Fetches settled order count, relayer admin address, and contract deployment metrics from zerodrain-relayer-vault.testnet.',
        responses: {
          200: {
            description: 'Live contract stats.',
          },
        },
      },
    },
    '/api/agent/schema': {
      tags: ['System & Health'],
      get: {
        summary: 'Machine-Readable Agent Contract Schema',
        description: 'Returns endpoint schema contract for autonomous agents discovering tools programmatically.',
        responses: {
          200: {
            description: 'Agent capability schema.',
          },
        },
      },
    },
  },
};

// Generates self-contained Swagger UI HTML with Cyberpunk Dark Theme
function renderSwaggerHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ZeroDrain AI — Interactive OpenAPI Specification</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5/favicon-32x32.png" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #08090d;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .topbar {
      display: none !important;
    }
    .swagger-ui {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }
    .custom-header {
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.1) 0%, rgba(121, 40, 202, 0.1) 100%);
      border: 1px solid rgba(0, 240, 255, 0.3);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .custom-header h1 {
      margin: 0;
      font-size: 1.5rem;
      background: linear-gradient(90deg, #ffffff 0%, #00f0ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 800;
    }
    .custom-header a {
      color: #00f0ff;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid rgba(0, 240, 255, 0.4);
      padding: 6px 14px;
      border-radius: 6px;
      background: rgba(0, 240, 255, 0.08);
      transition: all 0.2s;
    }
    .custom-header a:hover {
      background: rgba(0, 240, 255, 0.2);
      box-shadow: 0 0 12px rgba(0, 240, 255, 0.4);
    }
    /* Dark Theme Overrides for Swagger UI */
    .swagger-ui .info .title {
      color: #ffffff !important;
    }
    .swagger-ui .info p, .swagger-ui .info li {
      color: #94a3b8 !important;
    }
    .swagger-ui .scheme-container {
      background: #0f111a !important;
      box-shadow: none !important;
      border: 1px solid #1e293b !important;
      border-radius: 8px !important;
    }
    .swagger-ui .opblock {
      background: #0f111a !important;
      border: 1px solid #1e293b !important;
      border-radius: 8px !important;
      box-shadow: none !important;
      margin-bottom: 12px !important;
    }
    .swagger-ui .opblock .opblock-summary {
      border-color: #1e293b !important;
    }
    .swagger-ui .opblock .opblock-summary-path {
      color: #e2e8f0 !important;
      font-family: monospace !important;
    }
    .swagger-ui .opblock .opblock-summary-description {
      color: #94a3b8 !important;
    }
    .swagger-ui .opblock-body {
      background: #0a0d14 !important;
    }
    .swagger-ui .tabheader li button {
      color: #94a3b8 !important;
    }
    .swagger-ui table thead tr th {
      color: #cbd5e1 !important;
      border-color: #1e293b !important;
    }
    .swagger-ui .parameters-col_name {
      color: #f1f5f9 !important;
    }
    .swagger-ui .parameter__name {
      color: #00f0ff !important;
    }
    .swagger-ui .response-col_status {
      color: #00ff88 !important;
    }
    .swagger-ui select, .swagger-ui input[type="text"], .swagger-ui textarea {
      background: #1e293b !important;
      color: #ffffff !important;
      border: 1px solid #334155 !important;
      border-radius: 4px !important;
    }
    .swagger-ui .btn {
      border-radius: 6px !important;
      font-weight: 600 !important;
    }
    .swagger-ui .btn.execute {
      background-color: #00f0ff !important;
      color: #000 !important;
      border-color: #00f0ff !important;
    }
  </style>
</head>
<body>
  <div class="swagger-ui">
    <div class="custom-header">
      <div>
        <h1>⚡ ZeroDrain AI: OpenAPI Interactive Explorer</h1>
        <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">
          Smart Contract Vault: <code style="color: #c084fc;">zerodrain-relayer-vault.testnet</code>
        </div>
      </div>
      <div>
        <a href="/" target="_self">← Return to Cyber Trading Cockpit</a>
      </div>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;
}

module.exports = {
  swaggerSpec,
  renderSwaggerHtml,
};

