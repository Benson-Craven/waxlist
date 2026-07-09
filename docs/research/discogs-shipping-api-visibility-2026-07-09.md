# Discogs Shipping API Visibility For WAXLIST Seller Bundle Planning

Access date for all sources: 2026-07-09.

## Executive summary

The official Discogs API exposes some listing and seller signals that are useful for WAXLIST seller bundle planning, but it does not expose a reliable cart or checkout shipping estimator for multiple listings from one seller.

High-confidence conclusion:

- Listing and inventory responses can expose listing price, seller username, seller feedback summary, seller free-text terms, `ships_from`, `shipping_price`, `original_shipping_price`, and `shipping_is_blocked` fields, based on first-party API responses from `api.discogs.com`.
- Release marketplace stats expose aggregate `num_for_sale`, `lowest_price`, and `blocked_from_sale`, but not listing-level shipping, seller identity, or bundle totals.
- Discogs shipping costs are buyer-address, seller-policy, method, order-size, value, weight, quantity, country/region, and checkout dependent, according to Discogs support documentation.
- Discogs checkout is the authoritative place where buyers see the final total, including shipping, handling, and applicable taxes.
- WAXLIST should treat Discogs API shipping data as opportunistic evidence, not as a complete delivered-price calculator.

## Evidence matrix

| Question | Official visibility | Auth required? | Stability | Implementation value | Unsafe inference |
| --- | --- | --- | --- | --- | --- |
| Release-level availability and lowest marketplace price | Available from `GET https://api.discogs.com/marketplace/stats/{release_id}`. Live unauthenticated response for release `1` returned `num_for_sale`, `lowest_price`, and `blocked_from_sale`. Source: [Discogs marketplace stats example](https://api.discogs.com/marketplace/stats/1). | No for tested endpoint. | Volatile marketplace snapshot. | Useful as broad availability and item-price evidence. | Do not infer shipping, seller, condition, or delivered total from `lowest_price`. |
| Marketplace listing search by release | `GET https://api.discogs.com/marketplace/search?release_id=1` returned `You must authenticate to access this resource.` Source: [Discogs marketplace search example](https://api.discogs.com/marketplace/search?release_id=1). | Yes, based on live response. | Volatile and rate-limited. | Potential source for seller/listing candidates after OAuth/token support. | Do not design unauthenticated seller-bundle workflows around this endpoint. |
| Seller inventory listings | Public seller inventory can return listing rows. Live unauthenticated request to `GET https://api.discogs.com/users/vinyl.eu/inventory?per_page=1` returned listing fields including `id`, `uri`, `condition`, `sleeve_condition`, `comments`, `ships_from`, `price`, `shipping_price`, `seller`, `release`, and `shipping_is_blocked`. Source: [Discogs seller inventory example](https://api.discogs.com/users/vinyl.eu/inventory?per_page=1). | No for tested public seller inventory. | Volatile inventory. | Useful once WAXLIST knows candidate sellers; can identify sellers with multiple wanted releases in inventory. | Do not assume all seller inventories are complete/public/searchable or that public inventory gives buyer-specific shipping. |
| Listing detail | Public listing detail can return the same listing fields for a known listing id. Live request to `GET https://api.discogs.com/marketplace/listings/4038812638` returned listing detail with `ships_from`, price, seller terms, empty shipping-price objects, and `shipping_is_blocked: true`. Source: [Discogs listing detail example](https://api.discogs.com/marketplace/listings/4038812638). | No for tested listing. | Highly volatile; listing may sell or be deleted. | Useful for item price, condition, seller terms, and ships-from evidence when listing id is known. | Do not treat empty `shipping_price` as free shipping. In the tested response it coincided with `shipping_is_blocked: true`. |
| Listing-level shipping price | The API response shape has `shipping_price` and `original_shipping_price`, but tested responses for a Denmark seller returned empty objects and `shipping_is_blocked: true`. Sources: [seller inventory example](https://api.discogs.com/users/vinyl.eu/inventory?per_page=1), [listing detail example](https://api.discogs.com/marketplace/listings/4038812638). | No for tested listing detail, but buyer-specific accuracy likely depends on account/address context. | Volatile and context-dependent. | Use only when populated with an explicit amount/currency. | Do not infer zero shipping from `{}`. Do not infer buyer eligibility without checking block/status fields. |
| Seller shipping policy data | The API listing response exposed seller free-text `shipping` terms, not a structured shipping policy table. Discogs support says Shipping Policies can be based on region/country, method, weight, quantity, format, order subtotal, free shipping thresholds, and seller configuration. Sources: [Shipping Policies guide](https://support.discogs.com/hc/en-us/articles/360007540673-What-Are-Shipping-Policies-And-How-To-Use-Them), [seller inventory example](https://api.discogs.com/users/vinyl.eu/inventory?per_page=1). | Free-text seller terms were visible in tested public listing responses. Structured policy API was not found in first-party evidence during this pass. | Seller-editable and context-dependent. | Display terms and extract only conservative hints if needed. | Do not parse free text into guaranteed rates. Do not claim WAXLIST knows the seller's complete policy table. |
| Ships-from region/country | Listing responses expose `ships_from`; user profile exposes `location`. Discogs tax FAQ also says seller fee VAT is determined by the `ships from` location set in seller settings. Sources: [listing detail example](https://api.discogs.com/marketplace/listings/4038812638), [seller profile example](https://api.discogs.com/users/vinyl.eu), [Discogs Taxes FAQ](https://support.discogs.com/hc/en-us/articles/26428614456077-Discogs-Taxes-FAQ). | No for tested public endpoints. | Seller-configurable; may differ in granularity. | Useful for seller-region filters, import/tax warning prompts, and buyer risk context. | Do not treat profile `location` as a guaranteed shipping origin if `ships_from` is absent. |
| Checkout/cart totals | Discogs support says checkout shows the order total including shipping, handling, and applicable taxes. No official API endpoint was found in this pass that returns a pre-checkout cart total for arbitrary listing bundles. Source: [How To Buy Music On Discogs](https://support.discogs.com/hc/en-us/articles/360001573434-How-To-Buy-Music-On-Discogs). | Checkout itself requires a logged-in buyer flow. | Final authoritative value, but not exposed for WAXLIST planning through observed public API. | Deep-link users to Discogs cart/checkout for final confirmation. | Do not present WAXLIST bundle totals as Discogs checkout totals. |
| Multi-listing shipping estimate from one seller | Discogs support says Shipping Policies can automatically calculate shipping for orders and merged orders, and larger mixed-format orders are covered by complete policies. No API endpoint was found that accepts multiple listing ids and returns a shipping estimate. Sources: [Shipping Policies FAQ](https://support.discogs.com/hc/en-us/articles/360014127418-Shipping-Policies-FAQ), [Shipping Policies guide](https://support.discogs.com/hc/en-us/articles/360007540673-What-Are-Shipping-Policies-And-How-To-Use-Them). | Discogs calculation occurs in the marketplace/order/checkout flow; no public estimator observed. | Seller-policy and cart-state dependent. | WAXLIST can rank candidate bundles by same-seller coverage and known item prices, then hand off to Discogs. | Do not compute combined shipping unless Discogs returns an explicit defensible amount for the exact buyer/listing set. |
| Tax/import charges | Discogs says VAT/GST/sales tax may be collected at checkout depending on shipping location, and import VAT/duties can still apply above thresholds. US sales tax is calculated at checkout from customer shipping details. Source: [Discogs Taxes FAQ](https://support.discogs.com/hc/en-us/articles/26428614456077-Discogs-Taxes-FAQ). | Checkout/customer-address dependent. | Legally and operationally volatile. | Show caveats and country-threshold warnings. | Do not estimate taxes as final or guaranteed. |
| Seller fees impact shipping | Discogs says sellers are charged a 9% fee on both item and shipping costs. Source: [What Are The Fees For Selling On Discogs?](https://support.discogs.com/hc/en-us/articles/360007521674-What-Are-The-Fees-For-Selling-On-Discogs). | Public support fact. | Policy can change. | Explains why seller terms/shipping can be non-trivial and why bundle discounts are not guaranteed. | Do not infer a seller will discount shipping or waive incremental shipping. |

## What the API appears to expose

### Public aggregate marketplace stats

The tested public stats endpoint returns only aggregate marketplace evidence:

```json
{
  "num_for_sale": 26,
  "lowest_price": {
    "value": 6.25,
    "currency": "USD"
  },
  "blocked_from_sale": false
}
```

Source: live unauthenticated request to [https://api.discogs.com/marketplace/stats/1](https://api.discogs.com/marketplace/stats/1), access date 2026-07-09.

Implementation implication: WAXLIST can use this for `itemPrice` evidence only when labeling it as Discogs marketplace stats. It is not a listing, seller, shipping, or delivered-price source.

### Public seller inventory and listing detail

The tested seller inventory and listing detail endpoints expose enough listing fields to identify candidate bundle sellers when a seller inventory can be queried:

```json
{
  "id": 4038812638,
  "uri": "https://www.discogs.com/sell/item/4038812638",
  "status": "For Sale",
  "condition": "Very Good Plus (VG+)",
  "sleeve_condition": "Very Good (VG)",
  "ships_from": "Denmark",
  "price": { "value": 4.81, "currency": "EUR" },
  "shipping_price": {},
  "original_shipping_price": {},
  "seller": {
    "username": "vinyl.eu",
    "stats": { "rating": "100.0", "stars": 5.0, "total": 101489 },
    "min_order_total": 0.0,
    "shipping": "..."
  },
  "shipping_is_blocked": true
}
```

Sources: live unauthenticated requests to [https://api.discogs.com/users/vinyl.eu/inventory?per_page=1](https://api.discogs.com/users/vinyl.eu/inventory?per_page=1) and [https://api.discogs.com/marketplace/listings/4038812638](https://api.discogs.com/marketplace/listings/4038812638), access date 2026-07-09.

Implementation implication: the listing shape is useful for seller bundle discovery, but WAXLIST should represent shipping as one of:

- `known`: explicit `shipping_price.value` and currency are present for the exact listing context.
- `blocked`: `shipping_is_blocked` is true.
- `unknown`: shipping fields are empty, missing, mismatched, or not buyer-context-specific.

### Authenticated marketplace search boundary

The tested marketplace search endpoint returned:

```json
{ "message": "You must authenticate to access this resource." }
```

Source: live unauthenticated request to [https://api.discogs.com/marketplace/search?release_id=1](https://api.discogs.com/marketplace/search?release_id=1), access date 2026-07-09.

Implementation implication: WAXLIST should not promise unauthenticated seller search. If WAXLIST adds Discogs-authenticated seller bundle planning, it can use authenticated marketplace search to find candidate listings, then still keep checkout totals as unknown unless returned explicitly by Discogs.

## Official Discogs shipping behavior

Discogs support describes Shipping Policies as the mechanism that automatically calculates buyer shipping costs based on the buyer's location. The same guide says seller policies can be based on country/region, shipping method, quantity, weight, format, order subtotal, local pickup, free-shipping thresholds, and policy completeness. Source: [What Are Shipping Policies And How To Use Them](https://support.discogs.com/hc/en-us/articles/360007540673-What-Are-Shipping-Policies-And-How-To-Use-Them), access date 2026-07-09.

Discogs support also says complete policies need coverage for all items, values, and ranges, and that policy behavior can apply to merged orders. Source: [Shipping Policies FAQ](https://support.discogs.com/hc/en-us/articles/360014127418-Shipping-Policies-FAQ), access date 2026-07-09.

Discogs checkout is the authoritative final-price surface: the buying guide says the buyer sees the order total at checkout, including shipping, handling, and applicable taxes. Source: [How To Buy Music On Discogs](https://support.discogs.com/hc/en-us/articles/360001573434-How-To-Buy-Music-On-Discogs), access date 2026-07-09.

Taxes are checkout/location dependent: Discogs says US sales taxes are calculated at checkout from shipping details, VAT/GST/sales tax may be collected at checkout depending on shipping location, and import VAT/duties may still apply above UK/EU thresholds. Source: [Discogs Taxes FAQ](https://support.discogs.com/hc/en-us/articles/26428614456077-Discogs-Taxes-FAQ), access date 2026-07-09.

## WAXLIST implementation guidance

Recommended model for seller bundle planning:

| Field | WAXLIST treatment |
| --- | --- |
| `listingId` | Stable enough for a link, but volatile; listing can sell or disappear. |
| `sellerUsername` | Useful grouping key for bundle planning. |
| `sellerStats` | Useful trust/risk display, not a guarantee. |
| `shipsFrom` | Useful region filter and caveat source. |
| `itemPrice` | Use if listing price is present; label currency and checked time. |
| `shippingPrice` | Use only if explicit amount/currency are present for the current buyer/listing context. |
| `shippingBlocked` | Treat as hard evidence that this listing is unavailable to the current/request context. |
| `seller.shipping` terms | Display or summarize conservatively; do not parse into guaranteed math. |
| `estimatedDeliveredCost` | Show only if item price and shipping are both explicit and compatible. |
| `bundleShippingEstimate` | Keep `unknown` unless Discogs exposes an exact multi-listing quote for the buyer/cart context. |

Recommended user-facing copy:

- "Seller has 3 wanted records. Discogs checkout required for final shipping."
- "Ships from Denmark. Shipping unavailable for this context."
- "Item price known; shipping not returned by Discogs."
- "Do not treat unknown shipping as free."
- "Final Discogs checkout may include shipping, handling, tax, or import charges."

Recommended feature scope:

1. Seller coverage finder: group candidate listings by seller and show how many wants each seller can satisfy.
2. Evidence-first price display: item subtotal from listing prices, shipping unknown unless explicit, checkout caveat always visible.
3. Region filters: use `ships_from` and user preferences to filter or warn, not to compute tax.
4. Discogs handoff: deep-link to seller/listings/cart paths for final purchase.
5. Cache with freshness: listing and shipping fields are marketplace snapshots and should expire quickly.

Avoid:

- Computing `lowest_price + 0 shipping`.
- Parsing seller terms into authoritative rate tables.
- Estimating combined shipping from item counts/weights unless the seller policy data is returned as structured, buyer-context-specific, and current.
- Ranking sellers by "cheapest delivered" when shipping is unknown.
- Treating checkout taxes/import charges as knowable before Discogs checkout.

## Source list

- [Discogs API root](https://api.discogs.com/) - access date 2026-07-09. Used to confirm first-party API availability, API version, documentation URL, and rate-limit headers from live response.
- [Discogs API documentation entry point](https://www.discogs.com/developers/) - access date 2026-07-09. The API root links here as the official developer documentation URL; direct fetch was blocked by Cloudflare in this environment, so endpoint field claims in this note rely on live first-party API responses instead.
- [Discogs Marketplace stats endpoint example](https://api.discogs.com/marketplace/stats/1) - access date 2026-07-09. Live unauthenticated response used for `num_for_sale`, `lowest_price`, and `blocked_from_sale`.
- [Discogs Marketplace search endpoint example](https://api.discogs.com/marketplace/search?release_id=1) - access date 2026-07-09. Live unauthenticated response used to confirm authentication requirement.
- [Discogs seller profile endpoint example](https://api.discogs.com/users/vinyl.eu) - access date 2026-07-09. Live unauthenticated response used for seller profile fields, location, inventory URL, and seller rating fields.
- [Discogs seller inventory endpoint example](https://api.discogs.com/users/vinyl.eu/inventory?per_page=1) - access date 2026-07-09. Live unauthenticated response used for listing shape, `ships_from`, `shipping_price`, `original_shipping_price`, seller terms, and `shipping_is_blocked`.
- [Discogs listing detail endpoint example](https://api.discogs.com/marketplace/listings/4038812638) - access date 2026-07-09. Live unauthenticated response used for listing detail shape and volatile listing-level fields.
- [What Are Shipping Policies And How To Use Them](https://support.discogs.com/hc/en-us/articles/360007540673-What-Are-Shipping-Policies-And-How-To-Use-Them) - access date 2026-07-09. Used for automatic shipping-cost calculation behavior, region/country setup, quantity/weight/format/order-value policy dimensions, complete-policy requirements, and blocked-country behavior.
- [Shipping Policies FAQ](https://support.discogs.com/hc/en-us/articles/360014127418-Shipping-Policies-FAQ) - access date 2026-07-09. Used for merged-order behavior, default-weight caveats, free-shipping thresholds, multiple methods, seller overrides, and checkout method selection.
- [How To Buy Music On Discogs](https://support.discogs.com/hc/en-us/articles/360001573434-How-To-Buy-Music-On-Discogs) - access date 2026-07-09. Used for cart/order/checkout behavior and final total visibility including shipping, handling, and taxes.
- [Discogs & Taxes: FAQ](https://support.discogs.com/hc/en-us/articles/26428614456077-Discogs-Taxes-FAQ) - access date 2026-07-09. Used for checkout tax calculation, shipping-location dependence, `ships from` tax relevance, import threshold caveats, and buyer responsibility for duties/import taxes.
- [What Are The Fees For Selling On Discogs?](https://support.discogs.com/hc/en-us/articles/360007521674-What-Are-The-Fees-For-Selling-On-Discogs) - access date 2026-07-09. Used for Discogs seller fee on item and shipping costs.
