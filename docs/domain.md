# Domain model

This document explains the domain logic in `src/domain/`: what each concept means, the rules it enforces, and how prices and tax are calculated. It describes the code as it is.

The domain is pure TypeScript. It does no I/O, imports nothing outside `src/domain/` (ESLint enforces this), and has no classes: every concept is readonly data plus functions that return new data. Because it is plain data, a domain value can be passed from a Server Component to a Client Component unchanged, and the configurator can price a bundle in the browser with exactly the same functions the server uses.

## Vocabulary

| Term | Meaning | Code |
|---|---|---|
| Bike | A product with a frame type, a net price and a tax rate | `bike.ts` |
| Accessory | A product that fits some frame types, with a `maxAmount` per bundle | `accessory.ts` |
| Frame type | One of Touring, Road, Mountain, Urban, E-Cargo, E-Urban | `frame-type.ts` |
| Compatible | An accessory is compatible if its frame types include the bike's | `isCompatible` |
| Bundle | One bike plus accessory quantities, each from 0 to its `maxAmount` | `bundle.ts` |
| Cart line | One bundle in the cart, with its own id; priced and removed as one unit | `cart.ts` |
| Cart | A list of cart lines and nothing else | `cart.ts` |
| Net, tax, gross | Catalog prices are net; gross = net + tax | `money.ts` |

## Building blocks

### Result: expected failures are values

Functions that can fail in an expected way return a `Result` instead of throwing:

```ts
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

Every error is an object with a `code` string and the details needed to explain it, for example `{ code: "line-not-found", lineId: "line-9" }`. Callers switch on `code`. Later layers map these codes to HTTP statuses and UI messages. Throwing is reserved for bugs.

### Branded types: a value that has been checked

Ids, money, tax rates and quantities are plain numbers and strings at runtime, but TypeScript treats them as distinct types (`Brand` in `brand.ts`). The only way to get one is through its validating constructor, so holding a `Cents` means it has already been checked.

| Type | Constructor | Accepts | Error code |
|---|---|---|---|
| `Cents` | `cents(n)` | whole numbers, 0 or more | `invalid-cents` |
| `TaxRateBp` | `taxRateBp(n)` | whole basis points, 0 to 10000 (1900 = 19 %) | `invalid-tax-rate` |
| `Quantity` | `quantity(n)` | whole numbers, 0 or more | `invalid-quantity` |
| `BikeId`, `AccessoryId`, `CartId`, `CartLineId` | `bikeId(s)` etc. | at least one character, no whitespace | `invalid-id` |
| `FrameType` | `frameType(s)` | one of the six catalog frame types | `unknown-frame-type` |

`Bundle` and `Cart` are branded too, so they can only come from `createBundle` and the cart functions, never from a hand-written object. `src/domain/brand.test.ts` checks this at compile time: `npm run typecheck` fails if any of those shortcuts ever compiles.

## Money and tax

All money is **integer cents**. The domain never sees a decimal price: converting the catalog's `899.0` to `89900` happens in the catalog adapter (a later PR), which also rejects prices with more than two decimals. `cents()` rejects anything that is not a whole number, so a float such as `79.9 * 100` (`7990.000000000001`) cannot get in.

Tax rates are **basis points**: 19 % is `1900`. That keeps the tax arithmetic in integers too.

### `taxOf`: the only place tax is computed

```ts
taxOf(net, rate) = floor((net × rate + 5000) / 10000)
```

This is half-up rounding to a whole cent, done in integers. Gross is always `net + taxOf(net, rate)`; nothing else computes tax.

| Net (cents) | Exact tax at 19 % | `taxOf` | Why it is tested |
|---|---|---|---|
| 1650 (repair kit) | 313.5 | 314 | Float arithmetic gives 313 |
| 3950 (fork service kit) | 750.5 | 751 | Float arithmetic gives 750 |
| 50 | 9.5 | 10 | Another half-cent case |
| 0 | 0 | 0 | Zero stays zero |

Rounding with `floor` is only correct for amounts that are not negative. `Cents` cannot be negative, and refunds are out of scope.

### Rounding once per line, per rate

Tax is rounded **once per cart line**, on the line's summed net, separately for each tax rate in the line. `priceOf(amounts)` does this: it groups the amounts by tax rate, sums the net of each group, rounds the tax of each group once, and returns `{ net, tax, gross }`.

Why per line and not per unit: the largest Touring Voyager 5.0 bundle (every compatible accessory at its maximum) has a net of €2,222.70. Rounded once for the line, tax is €422.31 and gross is €2,645.01. Rounded per unit, it would come to €2,645.03.

Why once per rate: if a line mixed 19 % and 7 % items, each rate is rounded on its own. For €16.50 at 19 % (313.5 cents) plus €0.50 at 7 % (3.5 cents), tax is 314 + 4 = 318 cents. The catalog only has 19 % today; the rule is there so a second rate cannot quietly change the totals.

### Totals are never rounded again

`sumPrices` adds already rounded prices as they are. A cart total is the sum of its line prices, so it always equals what the customer sees on each line. Three identical lines of €1,206.80 net carry €229.29 tax each, €687.87 together. Rounding the cart's €3,620.40 net once would give €687.88 instead.

## Bikes, accessories and compatibility

A `Bike` has an id, a name, a frame type, a net price and a tax rate. An `Accessory` has the same price fields, plus the list of frame types it fits and a `maxAmount`, the most of it one bundle may hold.

`isCompatible(accessory, bike)` is true when the accessory's frame types include the bike's frame type. For example, the Aluminum Rear Rack fits Touring, Urban, E-Cargo and E-Urban frames, so it is compatible with the Touring Voyager 5.0 and not with the Speedline Carbon Race (Road).

`FrameType` is a closed list of the six frame types in the catalog. A new frame type in the data needs a code change.

## Bundle

A bundle is one bike plus the accessories chosen for it. `createBundle(bike, selection)` takes the bike and a list of `{ accessory, quantity }` and checks each entry in order:

1. An accessory listed **more than once** is rejected with `duplicate-accessory`.
2. A quantity of **0** means "not in the bundle": the entry is left out and not checked further.
3. An accessory that is **not compatible** with the bike is rejected with `incompatible-accessory` (with the bike's frame type).
4. A quantity **above `maxAmount`** is rejected with `quantity-out-of-range` (with the quantity and the maximum).

The first entry that breaks a rule decides the error. A bike with no accessories is a valid bundle.

`priceBundle(bundle)` prices the bundle as one line: the bike's net, plus each accessory's net times its quantity, through `priceOf`. Example from the catalog: Touring Voyager 5.0 + 2 × Urban Pro Bike Helmet + SecureLock Chain Lock + Aluminum Rear Rack + 3 × Compact Puncture Repair Kit is €1,206.80 net, €229.29 tax, €1,436.09 gross.

## Cart

The cart is the aggregate: it has an id and a list of lines, and it changes only through `addBundle`, `removeLine` and `clear` in `cart.ts`. Each returns a **new** cart and leaves the one it was given unchanged.

| Function | Does | Can fail with |
|---|---|---|
| `emptyCart(id)` | A cart with no lines | — |
| `addBundle(cart, lineId, bundle)` | Appends the bundle as a new line | `duplicate-line` if the cart already holds that line id |
| `removeLine(cart, lineId)` | Removes that line, keeps the others in order | `line-not-found` if the cart does not hold it |
| `clear(cart)` | Removes every line, keeps the cart's id | — |
| `cartTotals(cart)` | Sums the line prices with `sumPrices` | — |

Rules that follow from this:

- **Lines are never merged.** Adding the same bundle twice gives two lines, each with its own id.
- **The caller supplies the line id.** The domain stays pure and generates nothing random; the use case that adds a bundle (a later PR) creates the id.
- **A cart holds bundles only.** There are no loose bikes or accessories. To change an accessory in a bundle already in the cart, the customer removes the line and adds a new bundle.
- **Removing twice reports it.** Removing a line that is already gone returns `line-not-found`, so the API can answer 404 and the UI can treat it as already removed.

## What is not in the domain

- Loading the catalog from `data/*.json` and converting decimal prices to cents: the catalog adapter.
- Stock, availability and reservation: the stock service and checkout use case.
- Where carts are stored and how a browser finds its cart: the cart repository and Route Handlers.
- Formatting money for display (`€1,436.09`): the UI.

## Tests

Each module has a Jest test file next to it in `src/domain/`. The tests call the functions directly and check the values returned. The fixtures in `test-support.ts` are real products from `data/`, with prices converted to cents by hand. The expected amounts above, such as €1,436.09 for the example bundle and €2,645.01 for the full Touring bundle, are asserted in `money.test.ts`, `bundle.test.ts` and `cart.test.ts`.
