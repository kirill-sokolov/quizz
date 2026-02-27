/**
 * Global test setup for the web app.
 *
 * Runs before every test file:
 *   - Imports jest-dom matchers (toBeInTheDocument, etc.)
 *   - Stubs browser APIs that jsdom doesn't implement:
 *       AudioContext, window.matchMedia, IntersectionObserver,
 *       ResizeObserver, HTMLMediaElement.play
 */
import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount React trees after each test
afterEach(() => {
  cleanup();
});

// ─── AudioContext ─────────────────────────────────────────────────────────────
// TVTimer creates AudioContext oscillators for tick/alarm sounds.

function makeAudioNodeMock() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    frequency: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    start: vi.fn(),
    stop: vi.fn(),
  };
}

class AudioContextMock {
  currentTime = 0;
  state = "running";
  destination = {};

  createOscillator() {
    return makeAudioNodeMock();
  }
  createGain() {
    return makeAudioNodeMock();
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

Object.defineProperty(window, "AudioContext", {
  writable: true,
  value: AudioContextMock,
});
Object.defineProperty(window, "webkitAudioContext", {
  writable: true,
  value: AudioContextMock,
});

// ─── window.matchMedia ────────────────────────────────────────────────────────
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// ─── IntersectionObserver ─────────────────────────────────────────────────────
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  },
});

// ─── ResizeObserver ───────────────────────────────────────────────────────────
Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  },
});

// ─── HTMLMediaElement ─────────────────────────────────────────────────────────
// jsdom doesn't support video/audio playback — silence the "Not implemented" warnings.
Object.defineProperty(HTMLMediaElement.prototype, "play", {
  writable: true,
  value: vi.fn().mockResolvedValue(undefined),
});
Object.defineProperty(HTMLMediaElement.prototype, "pause", {
  writable: true,
  value: vi.fn(),
});
Object.defineProperty(HTMLMediaElement.prototype, "load", {
  writable: true,
  value: vi.fn(),
});
