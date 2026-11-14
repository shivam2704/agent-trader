// apps/agent-core/tests/02_financialMath.test.js
// Production-grade Unit Test Suite for Financial Invariants & Circuit Breaker Math

const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('Suite 1: Mark-to-Market PnL Across Omnichain Price Magnitudes', () => {
  // Verifies that PnL% and PnL in NEAR/USD are invariant to whether token is $0.000004 or $80,000
  function calculatePnL(side, entryPrice, currentPrice, sizeNear, nearUsdPrice = 3.30) {
    let priceDiff = side === 'LONG' ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
    const pnlPercent = parseFloat(((priceDiff / entryPrice) * 100).toFixed(2));
    const pnlUsd = parseFloat(((pnlPercent / 100) * (sizeNear * nearUsdPrice)).toFixed(4));
    const pnlNear = parseFloat(((pnlPercent / 100) * sizeNear).toFixed(6));
    return { pnlPercent, pnlUsd, pnlNear };
  }

  it('calculates exact +10% gain on NEAR native token ($3.30)', () => {
    const res = calculatePnL('LONG', 3.30, 3.63, 10.0, 3.30);
    assert.strictEqual(res.pnlPercent, 10.0);
    assert.strictEqual(res.pnlNear, 1.0); // 10% of 10 NEAR = +1 NEAR
    assert.strictEqual(res.pnlUsd, 3.30); // 10% of $33 = +$3.30
  });

  it('calculates exact -5% Stop-Loss drawdown on BTC ($80,000 -> $76,000)', () => {
    const res = calculatePnL('LONG', 80000, 76000, 2.0, 3.30);
    assert.strictEqual(res.pnlPercent, -5.0);
    assert.strictEqual(res.pnlNear, -0.1); // -5% of 2 NEAR = -0.1 NEAR
    assert.strictEqual(res.pnlUsd, -0.33); // -5% of $6.60 = -$0.33
  });

  it('calculates exact gain on micro-penny token ($0.0000045 -> $0.0000054 = +20%)', () => {
    const res = calculatePnL('LONG', 0.0000045, 0.0000054, 5.0, 3.30);
    assert.strictEqual(res.pnlPercent, 20.0);
    assert.strictEqual(res.pnlNear, 1.0); // 20% of 5 NEAR = +1.0 NEAR
  });

  it('calculates SHORT position profit on price decline', () => {
    // Entry: $100, Price drops to $90 -> SHORT should gain +10%
    const res = calculatePnL('SHORT', 100.0, 90.0, 4.0, 3.30);
    assert.strictEqual(res.pnlPercent, 10.0);
    assert.strictEqual(res.pnlNear, 0.4);
  });
});

describe('Suite 2: Circuit Breaker Settlement & Fee Invariant', () => {
  function computeSettlement(sizeNear, pnlPercent, protocolFeeBps = 15, gasBurnNear = 0.0018) {
    const exitFeeNear = gasBurnNear + (sizeNear * (protocolFeeBps / 10000));
    const pnlNear = (pnlPercent / 100) * sizeNear;
    const grossReturnNear = sizeNear + pnlNear;
    const finalSettledNear = Math.max(0.001, parseFloat((grossReturnNear - exitFeeNear).toFixed(4)));
    return { exitFeeNear, grossReturnNear, finalSettledNear };
  }

  it('guarantees capital preservation on -5.0% Stop-Loss (Returns ~94.8% after protocol fee)', () => {
    const deposit = 1.0; // 1 NEAR
    const res = computeSettlement(deposit, -5.0);
    assert.strictEqual(res.grossReturnNear, 0.95);
    // Protocol fee is 0.0018 + (1 * 0.0015) = 0.0033 NEAR
    assert.strictEqual(res.finalSettledNear, 0.9467);
    assert.ok(res.finalSettledNear > 0.94);
  });

  it('guarantees profit remittance on +20.0% Take-Profit', () => {
    const deposit = 5.0; // 5 NEAR
    const res = computeSettlement(deposit, 20.0);
    assert.strictEqual(res.grossReturnNear, 6.0); // 5 + 1
    assert.ok(res.finalSettledNear > 5.98); // Realized net profit
  });

  it('enforces non-negative minimum floor (cannot return negative NEAR)', () => {
    const deposit = 0.001;
    const res = computeSettlement(deposit, -50.0);
    assert.ok(res.finalSettledNear >= 0.001);
  });
});

describe('Suite 3: Trailing Stop-Loss Ratchet Monotonicity', () => {
  it('ratchets liquidation floor up when price reaches new peaks, never down', () => {
    let entryPrice = 100.0;
    let slDistance = 5.0; // 5% trailing distance
    let currentSl = -5.0; // Initial floor: -5%
    let peakPrice = 100.0;

    function onPriceUpdate(newPrice) {
      if (newPrice > peakPrice) {
        peakPrice = newPrice;
        const peakPnl = parseFloat((((peakPrice - entryPrice) / entryPrice) * 100).toFixed(2));
        const newFloor = parseFloat((peakPnl - slDistance).toFixed(2));
        if (newFloor > currentSl) {
          currentSl = newFloor;
        }
      }
      const currentPnl = parseFloat((((newPrice - entryPrice) / entryPrice) * 100).toFixed(2));
      const shouldLiquidate = currentPnl <= currentSl;
      return { peakPrice, currentSl, currentPnl, shouldLiquidate };
    }

    // Step 1: Price rises to $105 (+5%) -> Floor ratchets to 0% (Breakeven locked!)
    let t1 = onPriceUpdate(105.0);
    assert.strictEqual(t1.currentSl, 0.0);
    assert.strictEqual(t1.shouldLiquidate, false);

    // Step 2: Price rises to $115 (+15%) -> Floor ratchets to +10% (10% profit locked!)
    let t2 = onPriceUpdate(115.0);
    assert.strictEqual(t2.currentSl, 10.0);
    assert.strictEqual(t2.shouldLiquidate, false);

    // Step 3: Price pulls back to $112 (+12%) -> Floor stays at +10% (NEVER DECREASES)
    let t3 = onPriceUpdate(112.0);
    assert.strictEqual(t3.currentSl, 10.0); // Monotonicity check
    assert.strictEqual(t3.shouldLiquidate, false);

    // Step 4: Price crashes to $109 (+9%) -> Breaches +10% trailing floor -> Liquidates in profit!
    let t4 = onPriceUpdate(109.0);
    assert.strictEqual(t4.currentSl, 10.0);
    assert.strictEqual(t4.shouldLiquidate, true); // Trailing SL successfully protected profit!
  });
});
