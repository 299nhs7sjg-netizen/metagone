# MetaGone payments & monetization

Hosting stays **GitHub Pages** (static, $0). No backend required for MVP.

Unlock is **license-key only**. There is no “I paid — unlock” honor button.

---

## 1. Sell $0.99 lifetime unlock (required)

Prefer **Stripe Payment Link** at $0.99 (better net than Gumroad at this price). Gumroad / Lemon Squeezy also work.

1. Create a product: **MetaGone Lifetime Unlock** — price **$0.99** (one-time).
2. Deliver **license keys** after purchase:
   - Upload codes from **`KEYS.PRIVATE.md` on the operator machine only** (never commit this file; never put it in the public repo).
   - Format: `IB-META-XXXX-XXXX`
   - Stripe: email a key manually or use a fulfillment tool; Gumroad/LS: license keys / unique codes.
3. Copy the product **checkout URL**.
4. Paste it into `config.js`:

```js
checkoutUrl: "https://your-store-link-here",
```

5. Commit and push to `main` so GitHub Pages redeploys.

Buyers pay → receive a key → paste it in MetaGone → `VALID_KEYS` validates → unlock (ads + free cap + watermark off).

### When keys run low

1. Generate more `IB-META-XXXX-XXXX` codes into **`KEYS.PRIVATE.md`** (local only).
2. Add the new codes to `VALID_KEYS` in `app.js`.
3. Upload the new codes to the store.
4. Redeploy (push to `main`).

The first **15** sale keys from `KEYS.PRIVATE.md` are seeded in `app.js` so early sales work once the store is live.

---

## 2. Google AdSense (free-tier revenue)

1. Create / apply for [Google AdSense](https://www.google.com/adsense/).
2. When approved, paste your publisher id into `config.js`:

```js
adsenseClient: "ca-pub-XXXXXXXXXXXXXXXX",
adSlots: { top: "SLOT", mid: "SLOT", scrub: "SLOT", footer: "SLOT" },
```

3. Redeploy. Until AdSense is approved, the site shows **loud placeholder ads** so free users feel the free tier immediately.
4. Unlocked users: all `[data-ad]` regions are hidden.

---

## 3. Why honor-path unlock is forbidden

A PayPal.me or “I paid” button does **not** prove payment on a static site. Anyone could click it without paying. That path is **removed**. Checkout issues a key; MetaGone accepts only keys in `VALID_KEYS`.

---

## 4. Redeploy checklist

After any `config.js` or `app.js` key change:

```bash
git add -A && git commit -m "Update MetaGone config / keys" && git push origin main
```

**Never** `git add KEYS.PRIVATE.md` or `KEYS.md`. Both are gitignored.

---

## Free vs unlocked

| | Free | Unlocked ($0.99) |
|--|------|------------------|
| Scrubs | 1 | Unlimited |
| Batch | No | Yes |
| Proof slip | Watermarked | Clean |
| Ads | Shown | Hidden |
