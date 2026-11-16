# Bike bundle configurator

A customer picks a bike, adds compatible accessories with a quantity slider, puts the bundle in a cart and places an order. The catalog is loaded on the server, prices are computed on the server, and stock comes from a simulated, unreliable service. Built with Next.js, React and TypeScript for the brief in [`docs/brief.md`](docs/brief.md).

## How to run

Use the Node.js version in `.nvmrc`.

```bash
npm install
npm run dev          # http://localhost:3000
```

Production build:

```bash
npm run build && npm start
```

| Command                | What it does                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| `npm run lint`         | ESLint, including the layer rules                                       |
| `npm run typecheck`    | TypeScript                                                              |
| `npm test`             | Jest: domain, application, adapters, route handlers, components         |
| `npm run test:e2e`     | Builds, then runs Playwright against two production servers (see below) |
| `npm run format:check` | Prettier                                                                |

To see the stock failure path by hand, make the stock service always fail:

```bash
STOCK_FAILURE_RATE=1 npm start
```

The stock service reads `STOCK_FAILURE_RATE` (default `0.1`), `STOCK_LATENCY_MIN_MS` (200), `STOCK_LATENCY_MAX_MS` (1200) and `STOCK_SEED`.

### End-to-end tests

`npm run test:e2e` starts two servers from the same build: one whose stock service never fails (port 3000) and one whose stock service always fails (port 3001). That makes the failure path reproducible without a test hook in production code ([A8](docs/decisions/0001-architecture.md#a8-the-simulated-stock-service)). Four tests cover the happy path (configure, add to cart, order, confirmed), an incompatible accessory shown disabled with its reason, a stock shortfall at checkout, and the stock service being down. Install the browser once with `npx playwright install chromium`. CI runs them in their own job.

## Architecture in short

Pure domain, ports and adapters. The server is the source of truth; the client never sends prices, and money is integer cents everywhere.

```text
src/domain/          Money, TaxRate, Bike, Accessory, Bundle, Cart: immutable data and pure functions
src/application/     use cases, queries and ports.ts (CatalogReader, CartRepository, StockService, IdempotencyStore)
src/infrastructure/  adapters: JSON catalog, in-memory cart, simulated stock, in-memory idempotency store
src/contracts/       zod schemas for requests and responses, shared by UI and API
src/server/          composition.ts, the only place adapters are created
src/app/             pages (Server Components) and Route Handlers
src/ui/, features/   design-system primitives and the configurator and cart screens
```

Dependencies point inwards and ESLint enforces it. Reads go Server Component → query → port → adapter. Writes go Route Handler → contract schema → use case → `Result` → HTTP status. Expected failures are `Result` values, not exceptions.

- Decisions and their reasons: [`docs/decisions/0001-architecture.md`](docs/decisions/0001-architecture.md) (A1 to A14) and [`docs/decisions/0002-ui.md`](docs/decisions/0002-ui.md) (U1 to U11).
- Domain terms (bundle, cart line, net and gross price, availability, reservation, shortfall): [`docs/domain.md`](docs/domain.md).

## Choices made

- **Cart:** an opaque `cart_id` cookie (7 days); the cart lives on the server, and the UI refreshes it with `router.refresh()` after each write (A1, A2).
- **Stock is a hint on the configurator and a decision at checkout.** Availability is fetched after hydration; "Add to cart" does not call the stock service; checkout reserves with a 3 s timeout and an `Idempotency-Key`, so a retry cannot order twice (A7, A9, A10).
- **Rendering:** Cache Components kept. The catalog is cached with a tag, the cart badge streams, the cart page renders on every request (A3, A4).
- **Money:** converted to integer cents at the catalog adapter; tax is computed once per cart line, rounded half-up (A12).
- **UI:** one-page configurator, native radio and range inputs, inline order results on the cart page (U1 to U11).

## Bonuses

Race conditions, A11y and Caching strategy were chosen (A13). They are being added in a parallel pull request, so this README does not describe them yet.

## Left out, and why

The brief asks for a record of what was deliberately left out. Reasons are in [0001, "Deferred to a later iteration"](docs/decisions/0001-architecture.md#deferred-to-a-later-iteration).

| Left out                             | Why                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Optimistic UI bonus                  | About 2 hours and the riskiest bonus; it would also need a stock call on "Add to cart" (A7).      |
| Limit of 10 product types bonus      | Not among the brief's criteria; one full Touring bundle already has 11 types, a product question. |
| i18n bonus                           | About 3 hours: German names for 26 products and changes on every screen.                          |
| Atomic `CartRepository.update` (A11) | A port change, planned as its own commit in the next iteration.                                   |
| A database                           | A new adapter behind the existing ports; nothing else would change.                               |

## Known limits

- One long-lived Node.js process is required. Cart, stock and idempotency records are in memory and reset on restart (A1, A8).
- The bike selection is not shareable by URL and is lost on reload (A5).
- Two quick adds can lose one until the atomic cart update lands (A11).
- A cart changed in another tab while a checkout is in flight is not guarded against (A11).
- An order cannot be looked up after checkout; the confirmation is gone after a reload (A14, U9).
- An "individual item" in the cart is one bundle; a single accessory cannot be removed from a bundle in the cart.
- The bonuses that were not built (see above).

## Deployment

Run `npm run build` and then `npm start` on any host that keeps one Node.js process alive (a VM, a container, a long-running PaaS service). Because carts, stock and idempotency records are held in process memory, do not run several instances behind a load balancer and do not use a serverless platform such as Vercel: each invocation would see its own cart and stock. Moving to several instances needs a shared store, which is one new adapter for `CartRepository`, `StockService` and `IdempotencyStore`. Set the `STOCK_*` variables above to tune the simulated stock service.
