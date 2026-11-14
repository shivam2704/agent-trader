// apps/trader-ui/src/components/AgentTerminal.jsx
import React, { useState } from 'react';
import { Terminal, ExternalLink, ArrowDownUp, Filter } from 'lucide-react';

export default function AgentTerminal({ logs = [] }) {
  // 'newest' (Reverse-Chronological: freshest on top) | 'oldest' (Classic Terminal: oldest on top)
  const [sortOrder, setSortOrder] = useState('newest');
  const [filterLevel, setFilterLevel] = useState('ALL');

  const levelMeta = (level) => {
    switch (level) {
      case 'EMERGENCY': return { color: 'var(--accent-red)', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.25)' };
      case 'TRADE':     return { color: 'var(--accent-green)', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.2)' };
      case 'WARNING':   return { color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.2)' };
      default:          return { color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.18)' };
    }
  };

  // 1. Filter by level if specified
  const filteredLogs = logs.filter((l) => {
    if (filterLevel === 'ALL') return true;
    return l.level === filterLevel;
  });

  // 2. Order logs according to user preference (Default: Newest on Top, 0 scroll jumping)
  const orderedLogs = sortOrder === 'newest' ? filteredLogs : [...filteredLogs].reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', minHeight: '260px' }}>
      {/* Terminal Control Strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '10px',
        borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={14} color="var(--accent-blue)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
            EXECUTION & SOLVER AUDIT TRAIL
          </span>
          <span style={{
            fontSize: '0.62rem',
            padding: '1px 6px',
            borderRadius: '10px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}>
            {filteredLogs.length} events
          </span>
        </div>

        {/* Controls: Order toggle & Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Level Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {['ALL', 'TRADE', 'INFO'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFilterLevel(lvl)}
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  border: filterLevel === lvl ? '1px solid var(--accent-blue)' : '1px solid transparent',
                  background: filterLevel === lvl ? 'var(--accent-blue-dim)' : 'transparent',
                  color: filterLevel === lvl ? 'var(--accent-blue)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {lvl}
              </button>
            ))}
          </div>

          <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />

          {/* Sort Order Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
            title={`Currently showing ${sortOrder === 'newest' ? 'latest events at the top (no scroll jump)' : 'oldest events at the top'}. Click to switch.`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.65rem',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '5px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <ArrowDownUp size={11} color="var(--accent-blue)" />
            <span>{sortOrder === 'newest' ? 'Newest on Top' : 'Oldest on Top'}</span>
          </button>
        </div>
      </div>

      {/* Log Feed Container (Auto-scroll removed so user can read smoothly) */}
      <div style={{
        maxHeight: '360px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        paddingRight: '4px',
      }}>
        {orderedLogs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 'auto', textAlign: 'center', padding: '30px 0' }}>
            No activity logged yet. Live orders and solver quotes will stream here.
          </div>
        ) : (
          orderedLogs.map((log) => {
            const { color, bg, border } = levelMeta(log.level);
            return (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '5px 8px',
                  borderRadius: '5px',
                  background: log.level === 'EMERGENCY' ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.015)',
                  border: `1px solid ${log.level === 'EMERGENCY' ? border : 'transparent'}`,
                  transition: 'background 0.15s ease',
                }}
              >
                <span style={{
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: '3px',
                  background: bg,
                  color,
                  border: `1px solid ${border}`,
                  flexShrink: 0,
                  marginTop: '1px',
                  letterSpacing: '0.04em',
                }}>
                  {log.level}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', wordBreak: 'break-word', lineHeight: 1.4 }}>
                    {log.message}
                  </span>
                  {log.details?.explorerUrl && (
                    <div style={{ marginTop: '3px' }}>
                      <a
                        href={log.details.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.66rem',
                          color: 'var(--accent-blue)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        On-chain proof <ExternalLink size={9} />
                      </a>
                    </div>
                  )}
                </div>

                <span
                  className="mono"
                  style={{ fontSize: '0.62rem', color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }}
                  title={log.timestamp ? new Date(log.timestamp).toLocaleString() : '--'}
                >
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--'}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
