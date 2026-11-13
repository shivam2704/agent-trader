// apps/trader-ui/src/components/IndicatorGauges.jsx
import React from 'react';
import { Activity } from 'lucide-react';

export default function IndicatorGauges({ indicators, signal, reasoning }) {
  const rsi = indicators?.rsi ?? 50.0;
  const ema9 = indicators?.ema9 ?? null;
  const ema21 = indicators?.ema21 ?? null;

  const isOversold = rsi < 35;
  const isOverbought = rsi > 70;
  const isBullishEma = ema9 !== null && ema21 !== null ? ema9 >= ema21 : true;

  const rsiColor = isOversold ? 'var(--accent-green)' : isOverbought ? 'var(--accent-red)' : 'var(--accent-cyan)';
  const rsiBarColor = isOversold ? 'var(--accent-green)' : isOverbought ? 'var(--accent-red)' : 'var(--accent-blue)';

  const signalColor = signal === 'BUY' ? 'var(--accent-green)'
    : signal === 'SELL' ? 'var(--accent-red)'
    : 'var(--accent-amber)';

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'default', userSelect: 'none' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }} title="Technical indicators computed in real time from market oracles">
          <Activity size={14} color="var(--text-muted)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>INDICATORS</span>
        </div>
        <span
          title={`Algorithmic Market Sentiment: ${signal || 'NEUTRAL'}`}
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '4px',
            background: signal === 'BUY' ? 'var(--accent-green-dim)' : signal === 'SELL' ? 'var(--accent-red-dim)' : 'rgba(255,255,255,0.05)',
            color: signalColor,
            letterSpacing: '0.05em',
            cursor: 'default',
          }}
        >
          {signal || 'NEUTRAL'}
        </span>
      </div>

      {/* RSI */}
      <div title={`Relative Strength Index (14): ${rsi.toFixed(1)}. <35 is oversold, >70 is overbought.`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>RSI (14)</span>
          <span className="mono" style={{ fontSize: '0.82rem', fontWeight: 700, color: rsiColor }}>{rsi.toFixed(1)}</span>
        </div>
        <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(Math.max(rsi, 0), 100)}%`, height: '100%', background: rsiBarColor, borderRadius: '2px', transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Oversold &lt;35</span>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Overbought &gt;70</span>
        </div>
      </div>

      {/* EMA cross */}
      <div
        title={`Exponential Moving Average: 9-period EMA ($${ema9?.toFixed(3) || '--'}) vs 21-period baseline ($${ema21?.toFixed(3) || '--'})`}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-input)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
      >
        <div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '3px' }}>EMA Trend</div>
          <div className="mono" style={{ fontSize: '0.72rem', color: isBullishEma ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
            {isBullishEma ? '▲ Bullish Cross' : '▼ Bearish Cross'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--accent-blue)' }}>
            9: {ema9 != null ? `$${ema9 >= 100 ? ema9.toFixed(2) : ema9.toFixed(3)}` : '--'}
          </div>
          <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
            21: {ema21 != null ? `$${ema21 >= 100 ? ema21.toFixed(2) : ema21.toFixed(3)}` : '--'}
          </div>
        </div>
      </div>

      {/* Reasoning */}
      {reasoning && (
        <p
          title="Real-time market assessment from autonomous engine"
          style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4, borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}
        >
          {reasoning}
        </p>
      )}
    </div>
  );
}
