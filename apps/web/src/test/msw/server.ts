/**
 * MSW server for Node.js / jsdom test environment.
 *
 * Lifecycle is managed in src/test/setup.ts:
 *   beforeAll  → server.listen({ onUnhandledRequest: "warn" })
 *   afterEach  → server.resetHandlers()
 *   afterAll   → server.close()
 *
 * Override handlers per-test:
 *   import { server } from "../msw/server";
 *   import { http, HttpResponse } from "msw";
 *   server.use(http.get("http://localhost/api/quizzes/active", () => HttpResponse.json(myData)))
 */
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
