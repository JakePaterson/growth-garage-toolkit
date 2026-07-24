/**
 * Example map for a made-up online bookshop, "Foxglove Books".
 * Nothing here is real. It exists to show the shape of a finished data file.
 *
 * Build it:  node ../build.js system-map.data.js
 */

module.exports = {
  title: 'Foxglove Books: System Map',
  kicker: 'System Map',
  subtitle: 'How everything connects',

  // Horizontal bands, top to bottom. These should read as the journey through
  // your product. `numbered: false` keeps a band out of the 1-2-3 sequence:
  // use it for the things that sit underneath everything else.
  stages: [
    { id: 'browse',  label: 'Browse' },
    { id: 'buy',     label: 'Buy' },
    { id: 'fulfil',  label: 'Fulfil' },
    { id: 'aftercare', label: 'Aftercare' },
    { id: 'cross',   label: 'Cross-cutting', numbered: false },
  ],

  // Colour families. Group by "who owns this" or "what kind of thing is it".
  // Omit `color` to take the built-in palette.
  domains: [
    { id: 'shop',     label: 'Storefront' },
    { id: 'orders',   label: 'Orders' },
    { id: 'money',    label: 'Money' },
    { id: 'platform', label: 'Platform' },
  ],

  // How finished each thing is. Keep this to 3-5 values you actually use.
  statuses: [
    { id: 'live',     label: 'Live' },
    { id: 'beta',     label: 'Beta' },
    { id: 'internal', label: 'Internal only' },
    { id: 'partial',  label: 'Half-built' },
  ],

  nodes: [
    {
      id: 'catalogue',
      name: 'Catalogue & Search',
      domain: 'shop',
      stage: 'browse',
      status: 'live',
      hub: true,
      role: 'The searchable list of every book we stock, and the filters shoppers use to narrow it down.',
      how: `
        <p>Search runs against a denormalised <code>book_search</code> table that is rebuilt
        nightly, not against the live catalogue. That keeps a slow query from taking the
        shop down, at the cost of new stock taking up to a day to appear.</p>
        <p class="sub">Ranking</p>
        <ul>
          <li>Exact title match wins outright.</li>
          <li>Then in-stock items, then everything else.</li>
          <li>Staff picks get a fixed boost, applied last so it never buries an exact match.</li>
        </ul>`,
      steps: {
        spine: [
          { id: 'parse', tag: 'Step 1', name: 'Parse the query',
            what: 'Splits the raw search box text into title words, an optional author, and any ISBN.',
            files: [{ path: 'src/search/parse.ts', role: 'tokeniser and ISBN detector' }] },
          { id: 'match', tag: 'Step 2', name: 'Match against the index',
            what: 'Looks the tokens up in the nightly search table and returns candidate book ids.',
            quirk: 'Books added today will not appear until the next rebuild.' },
          { id: 'rank', tag: 'Step 3', name: 'Rank and page',
            what: 'Applies the ranking rules, then cuts the list into pages of 24.',
            note: 'Page size is hardcoded; the mobile grid assumes a multiple of 3.' },
        ],
        parallel: [
          { id: 'facets', tag: 'Alongside', name: 'Count the facets',
            what: 'Counts how many results fall into each genre and price band, for the filter sidebar.' },
        ],
        branchFrom: 'match',
        branchLabel: 'Runs in parallel',
      },
    },
    {
      id: 'recommend',
      name: 'Recommendations',
      domain: 'shop',
      stage: 'browse',
      status: 'beta',
      role: 'Suggests three more books on every product page, based on what other people bought together.',
    },
    {
      id: 'cart',
      name: 'Cart',
      domain: 'orders',
      stage: 'buy',
      status: 'live',
      role: 'Holds what a shopper has picked, survives them closing the tab, and works before they log in.',
    },
    {
      id: 'checkout',
      name: 'Checkout',
      domain: 'money',
      stage: 'buy',
      status: 'live',
      hub: true,
      role: 'Takes payment and turns a cart into a real order.',
      how: `
        <p>The amount charged is always recomputed on the server from the cart's book ids.
        The number the browser sends is only ever used to check the two agree: if they
        differ, the payment is refused rather than adjusted.</p>`,
      steps: {
        spine: [
          { id: 'price', tag: 'Step 1', name: 'Re-price the cart',
            what: 'Fetches current prices and stock for every book id in the cart, server-side.',
            quirk: 'A price change between adding to cart and paying shows an interstitial rather than silently charging the new amount.' },
          { id: 'pay', tag: 'Step 2', name: 'Take the payment',
            what: 'Creates the payment intent and confirms it.',
            fallback: [
              { when: 'The card is declined', then: 'Keep the cart intact and show the decline reason', why: 'Shoppers almost always retry with a second card.' },
            ] },
          { id: 'commit', tag: 'Step 3', name: 'Write the order',
            what: 'Writes the order row and decrements stock in one transaction.',
            note: 'If this fails after payment succeeded, the reconciliation job picks it up within the hour.' },
        ],
      },
    },
    {
      id: 'accounts',
      name: 'Accounts & Login',
      domain: 'platform',
      stage: 'buy',
      status: 'live',
      role: 'Lets someone check out as a guest and claim the order later by signing up with the same email.',
    },
    {
      id: 'stock',
      name: 'Stock & Warehouse',
      domain: 'orders',
      stage: 'fulfil',
      status: 'live',
      role: 'Tracks what is physically on the shelves and reserves copies the moment an order lands.',
    },
    {
      id: 'shipping',
      name: 'Shipping & Labels',
      domain: 'orders',
      stage: 'fulfil',
      status: 'live',
      role: 'Books a courier, prints the label, and pushes tracking numbers back onto the order.',
    },
    {
      id: 'returns',
      name: 'Returns',
      domain: 'orders',
      stage: 'aftercare',
      status: 'partial',
      role: 'Issues a return label and refunds once the parcel is scanned back in. Refunds are still manual.',
    },
    {
      id: 'reviews',
      name: 'Reviews',
      domain: 'shop',
      stage: 'aftercare',
      status: 'beta',
      role: 'Collects star ratings from verified buyers and feeds them back onto the product page.',
    },
    {
      id: 'email',
      name: 'Transactional Email',
      domain: 'platform',
      stage: 'cross',
      status: 'live',
      role: 'Every automated email the shop sends, from order confirmations to review requests.',
    },
    {
      id: 'analytics',
      name: 'Analytics',
      domain: 'platform',
      stage: 'cross',
      status: 'live',
      hub: true,
      role: 'The single pipe every tracked shopper action flows through on its way to the dashboard.',
    },
    {
      id: 'admin',
      name: 'Admin Console',
      domain: 'platform',
      stage: 'cross',
      status: 'internal',
      role: 'Where staff edit stock, refund orders by hand, and look up a customer.',
    },
  ],

  // from/to are node ids. kind is one of: triggers | feeds | calls | reads | emits
  // label finishes the sentence "<from> ___ <to>".
  edges: [
    { from: 'catalogue', to: 'cart',      kind: 'feeds',    label: 'Add to basket puts a book in' },
    { from: 'catalogue', to: 'recommend', kind: 'calls',    label: 'product pages ask for three more' },
    { from: 'recommend', to: 'cart',      kind: 'feeds',    label: 'suggested books can be added straight to' },
    { from: 'cart',      to: 'checkout',  kind: 'triggers', label: 'Pay now hands the basket to' },
    { from: 'checkout',  to: 'accounts',  kind: 'calls',    label: 'guest checkout creates a shell account via' },
    { from: 'checkout',  to: 'stock',     kind: 'triggers', label: 'a paid order reserves copies in' },
    { from: 'checkout',  to: 'email',     kind: 'emits',    label: 'sends the order confirmation through' },
    { from: 'checkout',  to: 'analytics', kind: 'emits',    label: 'fires the purchase event into' },
    { from: 'stock',     to: 'shipping',  kind: 'triggers', label: 'a picked order releases to' },
    { from: 'shipping',  to: 'email',     kind: 'emits',    label: 'sends the tracking number through' },
    { from: 'shipping',  to: 'reviews',   kind: 'triggers', label: 'delivery starts the review-request timer in' },
    { from: 'reviews',   to: 'catalogue', kind: 'feeds',    label: 'star ratings show back on' },
    { from: 'returns',   to: 'stock',     kind: 'feeds',    label: 'a scanned-in parcel puts the copy back into' },
    { from: 'returns',   to: 'checkout',  kind: 'calls',    label: 'refunds go back through' },
    { from: 'accounts',  to: 'analytics', kind: 'emits',    label: 'sign-up and sign-in events go to' },
    { from: 'admin',     to: 'stock',     kind: 'calls',    label: 'staff correct shelf counts in' },
    { from: 'admin',     to: 'returns',   kind: 'calls',    label: 'staff approve refunds in' },
    { from: 'admin',     to: 'catalogue', kind: 'reads',    label: 'the stock screen reads from' },
  ],
};
