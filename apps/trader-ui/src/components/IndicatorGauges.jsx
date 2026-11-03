// frontend/src/components/IndicatorGauges.jsx
import React from 'react';
import { Gauge, Zap, TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';

export default function IndicatorGauges({ indicators, signal, reasoning }) {
  const rsi = indicators?.rsi ?? 50.0;
  const ema9 = indicators?.ema9 ?? null;
  const ema21 = indicators?.ema21 ?? null;

  const isOversold = rsi < 35;
  const isOverbought = rsi > 70;
  const isBullishEma = ema9 !== null && ema21 !== null ? ema9 >= ema21 : true;

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Gauge size={18} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Real-Time Technical Oracles</h3>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>14-Period RSI & EMAs</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* RSI Meter */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>RSI (14) Momentum</span>
            <span
              className="mono"
              style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: isOversold ? 'var(--accent-green)' : isOverbought ? 'var(--accent-red)' : 'var(--accent-cyan)',
              }}
            >
              {rsi.toFixed(1)}
            </span>
          </div>

          {/* Progress visual bar */}
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
            <div
              style={{
                width: `${Math.min(Math.max(rsi, 0), 100)}%`,
                height: '100%',
                background: isOversold
                  ? 'linear-gradient(90deg, #00ff88 0%, #00f0ff 100%)'
                  : isOverbought
                  ? 'linear-gradient(90deg, #ffaa00 0%, #ff3366 100%)'
                  : 'var(--accent-cyan)',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            <span>Oversold &lt;35</span>
            <span>Neutral 50</span>
            <span>Overbought &gt;70</span>
          </div>
        </div>

        {/* EMA Trend Cross */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>EMA 9 vs EMA 21</span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                background: isBullishEma ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,102,0.15)',
                color: isBullishEma ? 'var(--accent-green)' : 'var(--accent-red)',
              }}
            >
              {isBullishEma ? 'Golden Cross' : 'Death Cross'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }} className="mono">
            <span style={{ color: 'var(--accent-cyan)' }}>EMA-9: {ema9 !== null ? `$${ema9 >= 100 ? ema9.toFixed(2) : ema9.toFixed(3)}` : '--'}</span>
            <span style={{ color: 'var(--accent-purple)' }}>EMA-21: {ema21 !== null ? `$${ema21 >= 100 ? ema21.toFixed(2) : ema21.toFixed(3)}` : '--'}</span>
          </div>

          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            {isBullishEma ? 'Short-term momentum is above long-term baseline.' : 'Short-term momentum is trailing downward.'}
          </p>
        </div>
      </div>

      {/* Live Agent Reasoning Box */}
      <div style={{ background: 'rgba(0,240,255,0.03)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <Zap size={16} color="var(--accent-cyan)" style={{ marginTop: '2px', flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Agent Market Assessment: {signal || 'NEUTRAL'}
          </span>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.4' }}>
            {reasoning || 'Market trading in normal equilibrium.'}
          </p>
        </div>
      </div>
    </div>
  );
}
