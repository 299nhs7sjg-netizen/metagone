# MetaGone

**Strip GPS, camera, and AI (C2PA) tags from photos — then download a one-page proof of what was removed.**

Price: **$0.99** lifetime unlock via license key.  
Private: photos never leave your browser. Hosted as a static site (GitHub Pages).

## Features

1. Upload one or more photos (JPEG / PNG / WebP)
2. Inspect detected metadata (GPS, camera, software, dates, XMP/C2PA hints)
3. Scrub on export — canvas rewrite strips EXIF/XMP as completely as practical in-browser
4. Download a **proof slip** (fields found → removed, timestamp, SHA-256 hashes)
5. **Free:** 1 scrub + watermarked report · **Unlock $0.99:** batch + clean report + no ads

## Files

| File | Role |
|------|------|
| `index.html` | UI |
| `app.js` | Scrub logic + key unlock (`VALID_KEYS`) |
| `styles.css` | Dark UI |
| `config.js` | Public checkout URL + AdSense slots (no keys) |
| `favicon.svg` | Icon |
| `PAYMENTS.md` | How to sell keys / AdSense |
| `KEYS.PRIVATE.md` | **Operator only — gitignored — never commit** |

## Unlock model

- Unlock is **license-key only**. There is no “I paid” honor button.
- Paste `checkoutUrl` in `config.js` when your Stripe / Gumroad / Lemon Squeezy product is live.
- Seed ~15 keys from `KEYS.PRIVATE.md` into `VALID_KEYS` in `app.js` (already done for first 15).
- Demo key `IB-META-DEMO-TEST` works only with `?demo=1`.

## Local preview

```bash
cd metagone
python3 -m http.server 8765
# open http://localhost:8765
```

## Deploy

Push to GitHub Pages (`main` branch root). Ensure `.nojekyll` is present.

**Never** commit `KEYS.PRIVATE.md` or `.seed-keys.txt`.
