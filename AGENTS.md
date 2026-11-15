# Conventions for all agents

## Next.js
Next.js changes quickly, and agents often know older APIs. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` for the installed version, and heed deprecation notices.

## Architecture: pure domain, ports and adapters

The server is the source of truth. The client never sends prices; the server recomputes them. Money is integer cents everywhere.

### Folder layout
```text
src/
  domain/            entities, value objects and rules: Money, TaxRate, Bike, Accessory, Bundle, Cart.
  application/       use cases and queries, plus ports.ts (interfaces for everything outside the domain).
  infrastructure/    adapters implementing the ports: JSON catalog, in-memory cart, simulated stock.
  contracts/         zod schemas for HTTP requests and responses, shared by UI and API.
  server/
    composition.ts   the composition root: the only place adapters are created and wired.
  app/               Next.js pages (Server Components) and api/ (Route Handlers).
  ui/                design-system primitives. No business logic.
  features/          screens (configurator, cart) built from ui/.
```

### Dependency rules (enforced with ESLint no-restricted-imports)
- `domain` imports only `domain`. No React, Next.js, zod or I/O.
- `application` imports `domain` and its own ports. No adapters, no Next.js.
- `infrastructure` implements ports from `application`. Only `server/composition.ts` imports it.
- `app/` and `features/` use `application` (through the composition root) and `contracts/`, never `infrastructure`.

### Ports and request flow
- Ports in `application/ports.ts`: `CatalogReader`, `CartRepository`, `StockService` (and `IdempotencyStore` from iteration 3). A database is a new adapter; nothing else changes.
- Reads: Server Component → application query → port → adapter.
- Writes: Route Handler → parse with the contract schema → use case → map the Result to an HTTP status.

### Style: functional core
- The domain is immutable data plus pure functions. No classes in `domain/`.
- Value objects (Money, TaxRate, Quantity) are readonly types created by validating constructor functions or branded types.
- `Cart` is the aggregate: a readonly type changed only by the functions in `domain/cart.ts` (`addBundle`, `removeLine`, `clear`), which return a new Cart or a typed error. Never build or mutate a Cart elsewhere.
- Expected failures are returned as `Result` values with typed errors, not thrown. Throw only for bugs.
- Use discriminated unions for states and results (e.g. `CheckoutResult`), and branded types for IDs and cents.
- Adapters in `infrastructure/` may be classes implementing a port.
- Domain data stays serialisable, so it can cross from Server to Client Components unchanged.

## Ubiquitous language
Use these names in code, tests and UI copy.
- **Bike**, **Accessory**, **FrameType**. An accessory is *compatible* if its frame types include the bike's.
- **Bundle**: one bike plus accessory quantities (0..maxAmount).
- **Cart**, **CartLine**: a cart holds lines; each line is one bundle.
- **Net price**, **gross price**, **tax**: catalog prices are net; gross = net × (1 + taxRate), rounded per line.
- **Availability**: stock count shown to the customer; a hint. **Reservation**: stock taken at checkout; the decision.
- **Shortfall**: more requested than available. **Stock unavailable**: the stock service failed.

## Working rules
- Test first with Jest. Domain tests call pure functions directly; application tests use in-memory adapters and fakes for ports, never mocks of internals.
- Test behaviour, not implementation details. Playwright for E2E.
- Conventional Commits. Small commits; every commit passes lint, typecheck, tests and build.
- Changes to `contracts/` or `application/ports.ts` go in their own commit, with the reason in the message.
- Stay inside the task's scope. Write anything extra as a follow-up note in the PR description.
- npm is the package manager.
