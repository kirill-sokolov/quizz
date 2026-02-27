/**
 * Minimal WebSocket mock for jsdom tests.
 *
 * TV.jsx and Game.jsx create `new WebSocket(url)` at runtime.
 * This mock replaces the global WebSocket so tests can:
 *   1. Prevent real network connections
 *   2. Push server-sent messages into components via sendWsMessage()
 *
 * Installation is done once in src/test/setup.ts.
 * Call clearWsInstances() in afterEach to reset between tests.
 *
 * Usage in a test:
 *   import { sendWsMessage, getLatestWs } from "../msw/ws-mock";
 *
 *   // After the component has mounted and WS has connected:
 *   sendWsMessage({ event: "slide_changed", data: { quizId: 1 } });
 *   await screen.findByTestId("tv-timer");
 */

type MessageHandler = (ev: { data: string }) => void;

export class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  /** All instances created during the current test (newest last). */
  static instances: MockWebSocket[] = [];

  readyState: number = MockWebSocket.OPEN;
  url: string;

  onopen: (() => void) | null = null;
  onmessage: MessageHandler | null = null;
  onerror: ((err: unknown) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Simulate async open (matches real WS behaviour)
    queueMicrotask(() => this.onopen?.());
  }

  /** No-op: tests don't inspect outgoing messages by default. */
  send(_data: string) {}

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  addEventListener(event: string, handler: EventListenerOrEventListenerObject) {
    const fn = typeof handler === "function" ? handler : handler.handleEvent.bind(handler);
    if (event === "open")    this.onopen    = fn as () => void;
    if (event === "message") this.onmessage = fn as MessageHandler;
    if (event === "error")   this.onerror   = fn;
    if (event === "close")   this.onclose   = fn as () => void;
  }

  removeEventListener() {}

  /** Push a JSON-serialisable server message into this WS instance. */
  dispatchMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

/** Returns the most recently created MockWebSocket instance (the "current" one). */
export function getLatestWs(): MockWebSocket | undefined {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1];
}

/**
 * Push a WebSocket message into the latest connected instance.
 * Call this after the component has mounted.
 */
export function sendWsMessage(data: unknown) {
  getLatestWs()?.dispatchMessage(data);
}

/** Reset instance list — call in afterEach. */
export function clearWsInstances() {
  MockWebSocket.instances = [];
}

/** Install MockWebSocket as the global WebSocket. Call once in setup.ts. */
export function installWsMock() {
  Object.defineProperty(window, "WebSocket", {
    writable: true,
    configurable: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: MockWebSocket as any,
  });
}
