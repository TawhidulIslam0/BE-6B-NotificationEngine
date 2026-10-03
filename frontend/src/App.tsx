import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  FileWarning,
  Gauge,
  Menu,
  Send,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';

import { endpoints } from './api';

type Page =
  | 'dashboard'
  | 'send'
  | 'analytics'
  | 'dlq'
  | 'preferences';

type EventType =
  | 'user.welcome'
  | 'user.email_verified'
  | 'user.phone_verified'
  | 'user.password_changed'
  | 'user.password_reset_requested'
  | 'user.login_new_device'
  | 'transaction.failed';

const eventTypes: EventType[] = [
  'user.welcome',
  'user.email_verified',
  'user.phone_verified',
  'user.password_changed',
  'user.password_reset_requested',
  'user.login_new_device',
  'transaction.failed',
];

function createId(): string {
  return crypto.randomUUID();
}

function createPayload(eventType: EventType, userId: string) {
  switch (eventType) {
    case 'user.welcome':
      return {
        name: 'Demo User',
      };

    case 'user.email_verified':
      return {
        email: 'demo@example.com',
      };

    case 'user.phone_verified':
      return {
        phone: '+15550000001',
      };

    case 'user.password_changed':
      return {
        changedAt: new Date().toISOString(),
      };

    case 'user.password_reset_requested':
      return {
        email: 'demo@example.com',
        requestedAt: new Date().toISOString(),
      };

    case 'user.login_new_device':
      return {
        deviceId: 'demo-device-001',
        deviceName: 'Demo Browser',
        ipAddress: '127.0.0.1',
      };

    case 'transaction.failed':
      return {
        transactionId: `demo-transaction-${Date.now()}`,
        amount: 42,
        currency: 'USD',
        reason: 'integration-test',
      };

    default:
      return {
        userId,
      };
  }
}

function Status({ ok }: { ok: boolean }) {
  return (
    <span className={`pill ${ok ? 'ok' : 'bad'}`}>
      {ok ? 'Operational' : 'Unavailable'}
    </span>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [mobile, setMobile] = useState(false);
  const [health, setHealth] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    endpoints
      .health()
      .then(() => {
        setHealth(true);
        setError('');
      })
      .catch((err: Error) => {
        setHealth(false);
        setError(err.message);
      });
  }, []);

  const navigation = [
    ['dashboard', 'Dashboard', Gauge],
    ['send', 'Send Test Event', Send],
    ['analytics', 'Analytics', BarChart3],
    ['dlq', 'DLQ', FileWarning],
    ['preferences', 'Preferences', Settings],
  ] as const;

  const currentTitle =
    navigation.find(([id]) => id === page)?.[1] ?? 'Dashboard';

  return (
    <div className="app">
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <div className="brand">
          <div className="mark">
            <Bell size={20} />
          </div>

          <div>
            <b>Notification</b>
            <span>Engine Demo</span>
          </div>
        </div>

        <nav>
          {navigation.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? 'active' : ''}
              onClick={() => {
                setPage(id);
                setMobile(false);
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="note">
          <ShieldCheck size={18} />
          Backend-focused demo
        </div>
      </aside>

      {mobile && (
        <button
          className="close"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
      )}

      <main>
        <header>
          <button
            className="menu"
            onClick={() => setMobile(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>

          <div>
            <small>BE-6B</small>
            <h1>{currentTitle}</h1>
          </div>

          <div className="api">
            <Activity size={16} />
            API
            <Status ok={health} />
          </div>
        </header>

        {error && <div className="alert">{error}</div>}

        {page === 'dashboard' && <Dashboard health={health} />}

        {page === 'send' && <SendEvent />}

        {page === 'analytics' && <Analytics />}

        {page === 'dlq' && <DLQ />}

        {page === 'preferences' && <Preferences />}
      </main>
    </div>
  );
}

function Dashboard({ health }: { health: boolean }) {
  return (
    <div className="content">
      <section className="hero">
        <div>
          <small>EVENT-DRIVEN NOTIFICATION PLATFORM</small>

          <h2>
            Observe the engine. Send an event. Inspect the operational flow.
          </h2>

          <p>
            A lightweight client for demonstrating the BE-6B notification
            engine backend.
          </p>
        </div>

        <Bell size={44} />
      </section>

      <div className="grid four">
        {['API', 'PostgreSQL', 'Kafka', 'RabbitMQ'].map((service) => (
          <Card title={service} key={service}>
            <Status ok={health} />
          </Card>
        ))}
      </div>

      <div className="grid two">
        <Card title="Demo flow">
          <ol>
            <li>Submit a validated event</li>
            <li>Apply preferences and compliance</li>
            <li>Process multi-channel delivery</li>
            <li>Track state and analytics</li>
          </ol>
        </Card>

        <Card title="Architecture">
          <div className="flow">
            Client → API → Event Stream → Engine → Providers
          </div>

          <p>
            PostgreSQL is the durable system of record; Redis supports
            fast-access state and caching.
          </p>
        </Card>
      </div>
    </div>
  );
}

function SendEvent() {
  const [eventType, setEventType] =
    useState<EventType>('user.welcome');

  const [userId, setUserId] =
    useState('demo-user-001');

  const [payload, setPayload] = useState(
    JSON.stringify(
      createPayload('user.welcome', 'demo-user-001'),
      null,
      2,
    ),
  );

  const [result, setResult] = useState('');

  const [sentEvent, setSentEvent] =
    useState<Record<string, unknown> | null>(null);

  const [busy, setBusy] = useState(false);

  const hasSentEvent = sentEvent !== null;

  const updateEventType = (value: EventType) => {
    setEventType(value);

    setPayload(
      JSON.stringify(
        createPayload(value, userId),
        null,
        2,
      ),
    );

    setResult('');
    setSentEvent(null);
  };

  const updateUserId = (value: string) => {
    setUserId(value);

    setPayload(
      JSON.stringify(
        createPayload(eventType, value),
        null,
        2,
      ),
    );

    setResult('');
  };

  const send = async () => {
    setBusy(true);
    setResult('');
    setSentEvent(null);

    try {
      let parsedPayload: unknown;

      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        throw new Error(
          'The JSON payload is invalid. Please fix the JSON before sending.',
        );
      }

      const event = {
        event_id: createId(),
        event_type: eventType,
        event_version: '1.0',
        occurred_at: new Date().toISOString(),
        user_id: userId,
        correlation_id: createId(),
        source: 'notification-engine-demo',
        priority: 'normal',
        payload: parsedPayload,
      };

      setSentEvent(event);

      const response = await endpoints.sendEvent(event);

      setResult(
        JSON.stringify(response, null, 2),
      );
    } catch (error) {
      setResult(
        error instanceof Error
          ? error.message
          : 'Request failed',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="content">
      <Card title="Send a test notification event">
        <div className="form">
          <label>
            Event type

            <select
              value={eventType}
              onChange={(event) =>
                updateEventType(
                  event.target.value as EventType,
                )
              }
            >
              {eventTypes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label>
            User ID

            <input
              value={userId}
              onChange={(event) =>
                updateUserId(event.target.value)
              }
              placeholder="demo-user-001"
            />
          </label>

          <label>
            JSON payload

            <textarea
              value={payload}
              onChange={(event) =>
                setPayload(event.target.value)
              }
              rows={10}
            />
          </label>

          <button
            className="primary"
            onClick={send}
            disabled={busy || !userId.trim()}
          >
            {busy ? 'Sending...' : 'Send event'}
          </button>

          {sentEvent && (
            <div>
              <h4>Event sent to backend</h4>

              <pre>
                {JSON.stringify(
                  sentEvent,
                  null,
                  2,
                )}
              </pre>
            </div>
          )}

          {result && (
            <div>
              <h4>Backend response</h4>

              <pre>{result}</pre>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Analytics() {
  const [data, setData] =
    useState<Record<string, unknown> | null>(null);

  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      endpoints.deliveryRates(),
      endpoints.channelPerformance(),
      endpoints.optOutTrends(),
      endpoints.costs(),
    ])
      .then(
        ([
          deliveryRates,
          channelPerformance,
          optOutTrends,
          costs,
        ]) => {
          setData({
            deliveryRates,
            channelPerformance,
            optOutTrends,
            costs,
          });
        },
      )
      .catch((err: Error) =>
        setError(err.message),
      );
  }, []);

  return (
    <div className="content">
      <div className="grid two">
        {data ? (
          Object.entries(data).map(
            ([key, value]) => (
              <Card title={key} key={key}>
                <pre>
                  {JSON.stringify(
                    value,
                    null,
                    2,
                  )}
                </pre>
              </Card>
            ),
          )
        ) : (
          <Card title="Loading analytics">
            Requesting backend analytics endpoints...
          </Card>
        )}
      </div>

      {error && (
        <div className="alert">
          {error}
        </div>
      )}
    </div>
  );
}

function DLQ() {
  const [data, setData] =
    useState<unknown>(null);

  const [error, setError] =
    useState('');

  useEffect(() => {
    endpoints
      .dlq()
      .then(setData)
      .catch((err: Error) =>
        setError(err.message),
      );
  }, []);

  return (
    <div className="content">
      <Card title="Dead-letter queue">
        <p>
          Live DLQ response from the backend.
        </p>

        <pre>
          {data
            ? JSON.stringify(
                data,
                null,
                2,
              )
            : 'Loading...'}
        </pre>

        {error && (
          <div className="alert">
            {error}
          </div>
        )}
      </Card>
    </div>
  );
}

function Preferences() {
  const [id, setId] =
    useState('demo-user-001');

  const [data, setData] =
    useState<unknown>(null);

  const [error, setError] =
    useState('');

  const load = () => {
    if (!id.trim()) {
      setError('Enter a user ID.');
      return;
    }

    setData(null);
    setError('');

    endpoints
      .preferences(id)
      .then(setData)
      .catch((err: Error) =>
        setError(err.message),
      );
  };

  return (
    <div className="content">
      <Card title="User preferences">
        <div className="inline">
          <input
            value={id}
            onChange={(event) =>
              setId(event.target.value)
            }
            placeholder="User ID"
          />

          <button
            className="primary"
            onClick={load}
          >
            Load
          </button>
        </div>

        {error && (
          <div className="alert">
            {error}
          </div>
        )}

        <pre>
          {data
            ? JSON.stringify(
                data,
                null,
                2,
              )
            : 'Enter a user ID and load preferences.'}
        </pre>
      </Card>
    </div>
  );
}