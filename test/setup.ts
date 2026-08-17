import "@testing-library/jest-dom/vitest";

// jsdom has no IntersectionObserver, which framer-motion's `whileInView`
// viewport feature requires. Provide a minimal mock that reports every observed
// element as immediately intersecting, so scroll-reveal components render in
// their visible (final) state and tests can query them.
class IntersectionObserverMock {
  readonly root: Element | null = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    this.callback(
      [
        {
          isIntersecting: true,
          intersectionRatio: 1,
          target,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: 0,
        },
      ],
      this as unknown as IntersectionObserver,
    );
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.IntersectionObserver =
  globalThis.IntersectionObserver ??
  (IntersectionObserverMock as unknown as typeof IntersectionObserver);

// ── next-intl (i18n) test shim ──
// Tests render locale-aware components without a request context. These mocks
// resolve to the English dictionary so assertions keep seeing the same copy as
// production (default locale). The key `t` helper also interpolates {params}.
import { vi } from "vitest";

function loadMessages() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../messages/en.json") as Record<string, Record<string, string>>;
  return en;
}

function makeT(namespace: string) {
  const messages = loadMessages();
  const dict = messages[namespace] ?? {};
  return (key: string, values?: Record<string, string | number>) => {
    let out = dict[key] ?? key;
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        out = out.replace(`{${k}}`, String(v));
      }
    }
    return out;
  };
}

vi.mock("next-intl/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("next-intl/server")>();
  return {
    ...original,
    getLocale: vi.fn().mockResolvedValue("en"),
    getTranslations: vi.fn().mockImplementation(async (namespace: string) => makeT(namespace)),
    getMessages: vi.fn().mockResolvedValue(loadMessages()),
    getRequestConfig: vi.fn(),
  };
});

vi.mock("next-intl", async (importOriginal) => {
  const original = await importOriginal<typeof import("next-intl")>();
  return {
    ...original,
    useLocale: vi.fn().mockReturnValue("en"),
    useTranslations: vi.fn().mockImplementation((namespace: string) => makeT(namespace)),
  };
});
