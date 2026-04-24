import React, { useEffect, useMemo, useRef, useState } from 'react';

type EventItem = {
  data: unknown;
  receivedAt: string;
};

const SERVER2_PORT: number = Number(import.meta.env.VITE_SERVER2_PORT) || 4005;

export default function LiveEventsView() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const sseUrl = useMemo(() => {
    const isRouter = typeof window !== 'undefined' && window.location && window.location.port === '5000';
    if (isRouter) {
      return '/api/events?stream=1';
    }
    if (import.meta.env.PROD) {
      return '/api/events?stream=1';
    }
    const port = Number(import.meta.env.VITE_SERVER2_PORT) || 4005;
    return `http://localhost:${port}/events?stream=1`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let connectTimer: number | undefined;
    let esLocal: EventSource | null = null;

    (async () => {
      try {
        // In router/prod behind Approuter, trigger XSUAA login by probing /api/health
        const isRouter = typeof window !== 'undefined' && window.location && window.location.port === '5000';
        if (isRouter || import.meta.env.PROD) {
          const res = await fetch('/api/health', { credentials: 'include' });
          const ct = res.headers.get('content-type') || '';
          if (res.status === 401 || ct.includes('text/html')) {
            // Redirect to Approuter interactive login; accessing /api/events triggers auth
            window.location.href = '/api/events';
            return;
          }
        }

        if (cancelled) return;

        const es = new EventSource(sseUrl, { withCredentials: false });
        esLocal = es;
        esRef.current = es;

        // Fallback: if connection opened but no data yet, mark as connected after short delay
        connectTimer = window.setTimeout(() => {
          if (es.readyState === 1) {
            setStatus('connected');
            setLastError(null);
          }
        }, 2000);

        es.onopen = () => {
          setStatus('connected');
          setLastError(null);
        };

        es.onmessage = (e: MessageEvent) => {
          // Mark connected on first data frame (robust across proxies)
          setStatus('connected');
          setLastError(null);
          try {
            const parsed = JSON.parse(e.data);
            // Ignore initial server 'ready' frame so UI doesn't count it as a user event
            if (typeof parsed === 'object' && parsed !== null) {
              const t = (parsed as Record<string, unknown>).type;
              if (typeof t === 'string' && t === 'ready') return;
            }
            setEvents((prev) => [{ data: parsed, receivedAt: new Date().toISOString() }, ...prev]);
          } catch {
            // Non-JSON payload; store raw
            setEvents((prev) => [{ data: e.data, receivedAt: new Date().toISOString() }, ...prev]);
          }
        };

        es.onerror = (err) => {
          console.error('SSE connection error:', err);
          setStatus('error');
          setLastError('SSE connection error. If authentication is required, please sign in and retry.');
          // EventSource will auto-reconnect; on successful reconnect, onopen will fire and status becomes connected
        };
      } catch (e) {
        console.error('Pre-auth or SSE connect failed:', e);
        setStatus('error');
        setLastError('Failed to authenticate or connect. Please refresh.');
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (esLocal) esLocal.close();
      } catch {
        // ignore
      }
      if (connectTimer) window.clearTimeout(connectTimer);
      esRef.current = null;
      setStatus('disconnected');
    };
  }, [sseUrl]);

  const clearEvents = () => setEvents([]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Live Events</h1>
        <div style={styles.statusRow}>
          <span style={{ ...styles.badge, ...badgeStyleForStatus(status) }}>
            {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting' : status === 'error' ? 'Error' : 'Disconnected'}
          </span>
          <code style={styles.endpoint}>SSE: {sseUrl}</code>
          <button style={styles.clearBtn} onClick={clearEvents} title="Clear received events">
            Clear Events
          </button>
        </div>
        {lastError && <div style={styles.errorBox}>{lastError}</div>}
        <p style={styles.hint}>
          Open another terminal and POST JSON to {(typeof window !== 'undefined' && window.location && window.location.port === '5000') ? '/api/webhook' : (import.meta.env.PROD ? '/api/webhook' : `http://localhost:${SERVER2_PORT}/webhook`)} to see events appear here.
        </p>
      </header>

      <main style={styles.eventsContainer}>
        {events.length === 0 ? (
          <div style={styles.empty}>No events yet. Waiting for incoming data…</div>
        ) : (
          events.map((ev, idx) => (
            <div key={idx} style={styles.eventItem}>
              <div style={styles.eventMeta}>
                <span>Received: {new Date(ev.receivedAt).toLocaleString()}</span>
              </div>
              <pre style={styles.pre}>{JSON.stringify(ev.data, null, 2)}</pre>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { margin: '0 auto', maxWidth: 900, padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, "Apple Color Emoji", "Segoe UI Emoji"', color: '#222' },
  header: { marginBottom: 16 },
  title: { margin: 0, fontSize: 24 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 },
  badge: { padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 },
  endpoint: { background: '#f6f8fa', padding: '2px 6px', borderRadius: 4 },
  clearBtn: { marginLeft: 'auto', padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' },
  errorBox: { marginTop: 8, padding: 8, borderRadius: 6, background: '#ffeceb', color: '#8b0000', border: '1px solid #f5c2c7' },
  hint: { marginTop: 8, color: '#555' },
  eventsContainer: { display: 'flex', flexDirection: 'column', gap: 12 },
  empty: { color: '#666', fontStyle: 'italic' },
  eventItem: { border: '1px solid #e1e4e8', borderRadius: 8, padding: 12, background: '#fff' },
  eventMeta: { marginBottom: 8, color: '#444', fontSize: 12 },
  pre: { margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word', background: '#f6f8fa', padding: 12, borderRadius: 6, overflowX: 'auto' },
};

function badgeStyleForStatus(status: 'connecting' | 'connected' | 'disconnected' | 'error'): React.CSSProperties {
  switch (status) {
    case 'connected':
      return { background: '#e3f9e5', color: '#1f7a1f', border: '1px solid #b7efc5' };
    case 'connecting':
      return { background: '#fff8e1', color: '#8a6d1d', border: '1px solid #ffe082' };
    case 'error':
      return { background: '#ffeceb', color: '#8b0000', border: '1px solid #f5c2c7' };
    case 'disconnected':
    default:
      return { background: '#e9ecef', color: '#495057', border: '1px solid #ced4da' };
  }
}
