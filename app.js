/**
 * MetaGone — client-side photo metadata scrubber + proof slip
 * Unlock ONLY via valid license key (no honor / "I paid" path).
 * VALID_KEYS: seed from KEYS.PRIVATE.md (operator machine only; never commit).
 */
(function () {
  "use strict";

  const STORAGE_KEY = "metagone_unlocked_v1";
  const SOURCE_KEY = "metagone_unlock_src_v1";
  const FREE_USED_KEY = "metagone_free_scrub_used_v1";
  const DEMO_KEY = "IB-META-DEMO-TEST";
  /* First 15 sale keys from KEYS.PRIVATE.md + demo (?demo=1 only). */
  const VALID_KEYS = new Set([
    DEMO_KEY,
    "IB-META-NWDK-JYUU",
    "IB-META-U7TF-U9AA",
    "IB-META-THCX-9XKB",
    "IB-META-CAMX-65ZL",
    "IB-META-MCQ9-TW8T",
    "IB-META-Q96D-EWNJ",
    "IB-META-NPV7-JF59",
    "IB-META-ZFEW-5UJZ",
    "IB-META-RVB3-M2PK",
    "IB-META-5UYR-EQFA",
    "IB-META-4LY9-R4QS",
    "IB-META-BJE6-YKM3",
    "IB-META-N8T2-PTFC",
    "IB-META-CLS6-H83U",
    "IB-META-NMTT-6VZT"
  ]);

  const CFG = (typeof window !== "undefined" && window.METAGONE_CONFIG) || {};
  const PLACEHOLDER_ADS = {
    top: "<strong>Sponsored</strong> — Scrub without ads. Unlock MetaGone lifetime for $2.99 → clean proof slips, batch scrub.",
    mid: "<strong>FakeSponsor Cloud</strong> — Upload photos to “strip EXIF.” Or stay private with MetaGone Unlock ($2.99).",
    scrub: "<strong>Batch scrub — Unlock MetaGone $2.99</strong><br />Clean proof slips. Unlimited files. One license key after checkout.",
    footer: "<strong>Sponsored · MetaGone Unlock</strong> — Kill ads + watermark with one $2.99 license key from the store."
  };

  let items = [];
  let activeIndex = -1;
  let unlocked = false;
  let lastReportHtml = "";
  let lastReportText = "";

  function byId(id) { return document.getElementById(id); }
  const els = {
    dropZone: byId("dropZone"), dropEmpty: byId("dropEmpty"), fileInput: byId("fileInput"),
    pickBtn: byId("pickBtn"), addMoreBtn: byId("addMoreBtn"), fileListWrap: byId("fileListWrap"),
    fileList: byId("fileList"), scrubBtn: byId("scrubBtn"), reportBtn: byId("reportBtn"),
    clearBtn: byId("clearBtn"), freeNote: byId("freeNote"), scrubsLeft: byId("scrubsLeft"),
    metaSummary: byId("metaSummary"), fieldsBox: byId("fieldsBox"),
    reportPanel: byId("reportPanel"), reportPreview: byId("reportPreview"),
    reportWatermark: byId("reportWatermark"),
    unlockBtn: byId("unlockBtn"), unlockLink: byId("unlockLink"),
    unlockNearExport: byId("unlockNearExport"), unlockInline: byId("unlockInline"),
    stickyUnlock: byId("stickyUnlock"), stickyUnlockBtn: byId("stickyUnlockBtn"),
    footerUnlock: byId("footerUnlock"), footerBuy: byId("footerBuy"),
    unlockBadge: byId("unlockBadge"), unlockModal: byId("unlockModal"), modalClose: byId("modalClose"),
    licenseKey: byId("licenseKey"), applyKeyBtn: byId("applyKeyBtn"), demoUnlockBtn: byId("demoUnlockBtn"),
    unlockError: byId("unlockError"), buyBtn: byId("buyBtn"), checkoutHint: byId("checkoutHint"),
    nagModal: byId("nagModal"), nagClose: byId("nagClose"), nagUnlockBtn: byId("nagUnlockBtn"),
    nagDismiss: byId("nagDismiss")
  };

  function normalizeKey(raw) {
    return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function isUnlocked() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (!v) return false;
      const k = normalizeKey(v);
      if (!k || k === "1") return false;
      if (VALID_KEYS.has(k)) return true;
      return localStorage.getItem(SOURCE_KEY) === "gumroad";
    } catch (e) {
      return false;
    }
  }

  function freeUsed() {
    try { return localStorage.getItem(FREE_USED_KEY) === "1"; } catch (e) { return false; }
  }

  function markFreeUsed() {
    try { localStorage.setItem(FREE_USED_KEY, "1"); } catch (e) {}
  }

  function freeScrubsLeft() {
    if (unlocked) return Infinity;
    return freeUsed() ? 0 : 1;
  }

  function setUnlocked(key, viaGumroad) {
    const k = normalizeKey(key);
    if (!k || k === "1") return false;
    if (!viaGumroad) {
      if (!VALID_KEYS.has(k)) return false;
      if (k === DEMO_KEY && !demoMode()) return false;
    }
    unlocked = true;
    try {
      localStorage.setItem(STORAGE_KEY, k);
      localStorage.setItem(SOURCE_KEY, viaGumroad ? "gumroad" : "seed");
    } catch (e) {}
    refreshUnlockUI();
    return true;
  }

  async function verifyGumroadLicense(rawKey) {
    const productId = String(CFG.productId || CFG.product_id || "").trim();
    const permalink = String(CFG.productPermalink || CFG.product_permalink || "").trim();
    if (!productId && !permalink) {
      return { ok: false, message: "Product not configured for license verify." };
    }
    const body = new URLSearchParams();
    if (productId) body.set("product_id", productId);
    else body.set("product_permalink", permalink);
    body.set("license_key", String(rawKey || "").trim());
    const res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (data && data.success === true) {
      const p = data.purchase || {};
      if (p.refunded || p.chargebacked || p.disputed) {
        return { ok: false, message: "This license is no longer valid." };
      }
      return { ok: true, data: data };
    }
    return {
      ok: false,
      message: (data && (data.message || data.error)) || "Invalid license key. Check your purchase email and try again."
    };
  }

  async function tryUnlock(raw) {
    const rawStr = String(raw || "").trim();
    const k = normalizeKey(rawStr);
    if (!k) {
      els.unlockError.hidden = false;
      els.unlockError.textContent = "Paste your license key from the store receipt, then tap Apply.";
      return false;
    }
    if (k === DEMO_KEY && !demoMode()) {
      els.unlockError.hidden = false;
      els.unlockError.textContent = "Demo key only works with ?demo=1";
      return false;
    }
    if (VALID_KEYS.has(k)) {
      if (setUnlocked(k, false)) {
        els.unlockError.hidden = true;
        closeUnlockModal();
        return true;
      }
      els.unlockError.hidden = false;
      els.unlockError.textContent = "Invalid license key. Check your purchase email and try again.";
      return false;
    }
    if (els.applyKeyBtn) els.applyKeyBtn.disabled = true;
    els.unlockError.hidden = false;
    els.unlockError.textContent = "Checking license…";
    try {
      const result = await verifyGumroadLicense(rawStr);
      if (result.ok && setUnlocked(k, true)) {
        els.unlockError.hidden = true;
        closeUnlockModal();
        return true;
      }
      els.unlockError.hidden = false;
      els.unlockError.textContent = (result && result.message) || "Invalid license key. Check your purchase email and try again.";
      return false;
    } catch (e) {
      els.unlockError.hidden = false;
      els.unlockError.textContent = "Could not verify license. Check your connection and try again.";
      return false;
    } finally {
      if (els.applyKeyBtn) els.applyKeyBtn.disabled = false;
    }
  }

  function demoMode() {
    try { return new URLSearchParams(location.search).get("demo") === "1"; } catch (e) { return false; }
  }

  function hideAllAds() {
    document.querySelectorAll("[data-ad]").forEach(function (el) {
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
    });
  }

  function showAllAds() {
    document.querySelectorAll("[data-ad]").forEach(function (el) {
      el.hidden = false;
      el.removeAttribute("aria-hidden");
    });
  }

  function refreshUnlockUI() {
    unlocked = isUnlocked();
    if (unlocked) {
      els.unlockBadge.textContent = "Unlocked";
      els.unlockBadge.className = "badge pro";
      els.unlockBtn.hidden = true;
      els.unlockBtn.textContent = "Unlocked ✓";
      els.unlockBtn.disabled = true;
      els.freeNote.hidden = true;
      if (els.unlockInline) els.unlockInline.hidden = true;
      if (els.stickyUnlock) els.stickyUnlock.hidden = true;
      document.body.classList.remove("has-sticky-unlock");
      if (els.footerUnlock) els.footerUnlock.hidden = true;
      if (els.footerBuy) els.footerBuy.hidden = true;
      hideAllAds();
    } else {
      els.unlockBadge.textContent = "Free";
      els.unlockBadge.className = "badge free";
      els.unlockBtn.hidden = false;
      els.unlockBtn.textContent = "Unlock $2.99";
      els.unlockBtn.disabled = false;
      els.freeNote.hidden = false;
      if (els.unlockInline) els.unlockInline.hidden = false;
      if (els.stickyUnlock) els.stickyUnlock.hidden = false;
      document.body.classList.add("has-sticky-unlock");
      if (els.footerUnlock) els.footerUnlock.hidden = false;
      if (els.footerBuy) els.footerBuy.hidden = false;
      const left = freeScrubsLeft();
      els.scrubsLeft.textContent = left === 1 ? "1 scrub left" : "0 scrubs left";
      showAllAds();
      fillPlaceholderAds();
    }
    if (els.demoUnlockBtn) els.demoUnlockBtn.hidden = !demoMode();
    updateActions();
  }

  function fillPlaceholderAds() {
    document.querySelectorAll("[data-ad]").forEach(function (el) {
      const slot = el.getAttribute("data-ad-slot") || el.getAttribute("data-ad");
      const inner = el.querySelector("[data-ad-creative]");
      if (inner && PLACEHOLDER_ADS[slot]) inner.innerHTML = PLACEHOLDER_ADS[slot];
    });
  }

  function setupCheckout() {
    const url = (CFG.checkoutUrl || "").trim();
    const hint = els.checkoutHint;
    const links = document.querySelectorAll("[data-checkout]");
    links.forEach(function (el) {
      if (url) {
        el.href = url;
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
        el.removeAttribute("aria-disabled");
        el.onclick = null;
      } else {
        el.href = "#";
        el.setAttribute("aria-disabled", "true");
        el.onclick = function (e) {
          e.preventDefault();
          if (hint) {
            hint.hidden = false;
            hint.style.color = "var(--danger)";
            hint.textContent =
              "Checkout URL not set — operator: paste Gumroad metagone-lifetime URL into config.js → checkoutUrl, then redeploy.";
          }
          if (els.unlockError) {
            els.unlockError.textContent =
              "Checkout URL not set. Operator: paste Gumroad URL into config.js → checkoutUrl, then redeploy.";
            els.unlockError.hidden = false;
          }
        };
      }
    });
    if (els.buyBtn && url) {
      els.buyBtn.href = url;
      els.buyBtn.setAttribute("target", "_blank");
      els.buyBtn.setAttribute("rel", "noopener");
    }
    if (hint) {
      if (url) {
        hint.hidden = false;
        hint.style.color = "var(--muted)";
        hint.textContent =
          "After checkout, your store email includes a license key. Paste it below.";
      } else {
        hint.hidden = false;
        hint.style.color = "var(--danger)";
        hint.textContent =
          "Checkout URL not set — operator: paste Gumroad metagone-lifetime URL into config.js → checkoutUrl, then redeploy.";
      }
    }
  }

  function openUnlockModal() {
    els.unlockError.hidden = true;
    els.unlockModal.hidden = false;
    els.licenseKey.focus();
  }

  function closeUnlockModal() { els.unlockModal.hidden = true; }
  function openNag() { els.nagModal.hidden = false; }
  function closeNag() { els.nagModal.hidden = true; }

  function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }

  function fmtVal(v) {
    if (v == null) return "";
    if (typeof v === "object") {
      if (v instanceof Date) return v.toISOString();
      try { return JSON.stringify(v); } catch (e) { return String(v); }
    }
    return String(v);
  }

  function extractFields(parsed, rawTextHints) {
    const fields = [];
    const push = function (group, label, value) {
      if (value == null || value === "" || value === "undefined") return;
      const s = fmtVal(value);
      if (!s || s === "{}" || s === "[]") return;
      fields.push({ group: group, label: label, value: s.slice(0, 500) });
    };

    if (!parsed) parsed = {};

    push("GPS", "Latitude", parsed.latitude != null ? parsed.latitude : parsed.GPSLatitude);
    push("GPS", "Longitude", parsed.longitude != null ? parsed.longitude : parsed.GPSLongitude);
    push("GPS", "Altitude", parsed.GPSAltitude != null ? parsed.GPSAltitude : parsed.altitude);
    push("GPS", "GPS Date", parsed.GPSDateStamp);
    push("GPS", "GPS Time", parsed.GPSTimeStamp);

    push("Camera", "Make", parsed.Make);
    push("Camera", "Model", parsed.Model);
    push("Camera", "Lens", parsed.LensModel || parsed.LensMake);
    push("Camera", "Focal length", parsed.FocalLength);
    push("Camera", "F-number", parsed.FNumber);
    push("Camera", "ISO", parsed.ISO || parsed.ISOSpeedRatings);
    push("Camera", "Exposure", parsed.ExposureTime);
    push("Camera", "Flash", parsed.Flash);

    push("Software", "Software", parsed.Software);
    push("Software", "Artist", parsed.Artist);
    push("Software", "Copyright", parsed.Copyright);
    push("Software", "Host computer", parsed.HostComputer);

    push("Dates", "Date taken", parsed.DateTimeOriginal || parsed.CreateDate || parsed.DateTime);
    push("Dates", "Date digitized", parsed.DateTimeDigitized);
    push("Dates", "Modify date", parsed.ModifyDate || parsed.DateTime);

    push("Device", "Serial number", parsed.SerialNumber || parsed.BodySerialNumber);
    push("Device", "Lens serial", parsed.LensSerialNumber);
    push("Device", "Unique camera ID", parsed.ImageUniqueID);

    push("Image", "Orientation", parsed.Orientation);
    push("Image", "Color space", parsed.ColorSpace);
    push("Image", "X resolution", parsed.XResolution);
    push("Image", "Y resolution", parsed.YResolution);

    const xmp = parsed.xmp || parsed.XMP || {};
    push("AI / C2PA", "Creator tool", xmp.CreatorTool || parsed.CreatorTool);
    push("AI / C2PA", "History", xmp.History);
    push("AI / C2PA", "Document ID", xmp.DocumentID || parsed.DocumentID);
    push("AI / C2PA", "Instance ID", xmp.InstanceID);

    if (rawTextHints) {
      if (rawTextHints.hasC2PA) push("AI / C2PA", "C2PA / JUMBF marker", "Detected in file bytes");
      if (rawTextHints.hasXmp) push("AI / C2PA", "XMP packet", "Detected in file bytes");
      if (rawTextHints.hasIptc) push("IPTC", "IPTC block", "Detected in file bytes");
    }

    const skip = {
      latitude:1,longitude:1,altitude:1,GPSLatitude:1,GPSLongitude:1,GPSAltitude:1,
      Make:1,Model:1,LensModel:1,LensMake:1,FocalLength:1,FNumber:1,ISO:1,ISOSpeedRatings:1,
      ExposureTime:1,Flash:1,Software:1,Artist:1,Copyright:1,HostComputer:1,
      DateTimeOriginal:1,CreateDate:1,DateTime:1,DateTimeDigitized:1,ModifyDate:1,
      SerialNumber:1,BodySerialNumber:1,LensSerialNumber:1,ImageUniqueID:1,
      Orientation:1,ColorSpace:1,XResolution:1,YResolution:1,xmp:1,XMP:1,
      thumbnail:1,Thumbnail:1,exif:1,Exif:1,gps:1,GPS:1,interop:1,Interop:1,
      GPSDateStamp:1,GPSTimeStamp:1,CreatorTool:1,DocumentID:1,InstanceID:1
    };
    Object.keys(parsed).forEach(function (k) {
      if (skip[k]) return;
      if (typeof parsed[k] === "object" && parsed[k] !== null && !(parsed[k] instanceof Date)) return;
      push("Other", k, parsed[k]);
    });

    return fields;
  }

  function scanBinaryHints(buffer) {
    const u8 = new Uint8Array(buffer);
    function hasAscii(needle) {
      const n = needle.length;
      const lim = Math.min(u8.length, 512 * 1024);
      for (let i = 0; i < lim - n; i++) {
        let ok = true;
        for (let j = 0; j < n; j++) {
          if (u8[i + j] !== needle.charCodeAt(j)) { ok = false; break; }
        }
        if (ok) return true;
      }
      const start = Math.max(0, u8.length - 256 * 1024);
      for (let i = start; i < u8.length - n; i++) {
        let ok = true;
        for (let j = 0; j < n; j++) {
          if (u8[i + j] !== needle.charCodeAt(j)) { ok = false; break; }
        }
        if (ok) return true;
      }
      return false;
    }
    return {
      hasC2PA: hasAscii("c2pa") || hasAscii("C2PA") || hasAscii("jumb") || hasAscii("JUMBF"),
      hasXmp: hasAscii("http://ns.adobe.com/xap/") || hasAscii("<x:xmpmeta"),
      hasIptc: hasAscii("Photoshop 3.0") || hasAscii("8BIM")
    };
  }

  async function parseMetadata(file, buffer) {
    let parsed = {};
    try {
      if (typeof exifr !== "undefined") {
        parsed = await exifr.parse(file, {
          tiff: true, xmp: true, icc: false, iptc: true, jfif: true, ihdr: true,
          gps: true, interop: true, translateKeys: true, translateValues: true,
          reviveValues: true, sanitize: true, mergeOutput: true
        }) || {};
      }
    } catch (e) {
      console.warn("exifr parse", e);
    }
    const hints = scanBinaryHints(buffer);
    const fields = extractFields(parsed, hints);
    return { parsed: parsed, hints: hints, fields: fields };
  }

  function loadImageFromBlob(blob) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Could not decode image"));
      };
      img.src = url;
    });
  }

  async function scrubImage(file) {
    const img = await loadImageFromBlob(file);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const quality = type === "image/jpeg" ? 0.92 : undefined;
    const blob = await new Promise(function (resolve) {
      canvas.toBlob(resolve, type, quality);
    });
    if (!blob) throw new Error("Export failed");

    let outBlob = blob;
    if (type === "image/jpeg" && typeof piexif !== "undefined") {
      try {
        const dataUrl = await blobToDataUrl(blob);
        const cleaned = piexif.remove(dataUrl);
        outBlob = dataUrlToBlob(cleaned, "image/jpeg");
      } catch (e) { /* canvas output already clean */ }
    }
    return { blob: outBlob, width: canvas.width, height: canvas.height, type: type };
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl, mime) {
    const parts = dataUrl.split(",");
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  async function sha256Hex(buffer) {
    try {
      const hash = await crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(hash)).map(function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    } catch (e) {
      return "(hash unavailable)";
    }
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function scrubbedName(name, type) {
    const base = name.replace(/\.[^.]+$/, "") || "photo";
    const ext = type === "image/png" ? "png" : "jpg";
    return base + "-metagone." + ext;
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []).filter(function (f) {
      return /^image\//.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);
    });
    if (!files.length) return;

    if (!unlocked && items.length >= 1) {
      openUnlockModal();
      els.unlockError.hidden = false;
      els.unlockError.textContent = "Free tier: 1 photo. Unlock $2.99 for batch.";
      return;
    }

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      if (!unlocked && items.length >= 1) break;
      const buffer = await file.arrayBuffer();
      const meta = await parseMetadata(file, buffer);
      const thumbUrl = URL.createObjectURL(file);
      const hashBefore = await sha256Hex(buffer);
      items.push({
        file: file, buffer: buffer, meta: meta, thumbUrl: thumbUrl, hashBefore: hashBefore,
        scrubbed: null, hashAfter: null, status: "ready"
      });
    }
    activeIndex = items.length - 1;
    renderList();
    renderActive();
    updateActions();
  }

  function renderList() {
    if (!items.length) {
      els.dropEmpty.hidden = false;
      els.fileListWrap.hidden = true;
      return;
    }
    els.dropEmpty.hidden = true;
    els.fileListWrap.hidden = false;
    els.fileList.innerHTML = "";
    items.forEach(function (item, i) {
      const li = document.createElement("li");
      li.className = "file-item" + (i === activeIndex ? " active" : "");
      li.innerHTML =
        '<img alt="" />' +
        '<div><div class="name"></div><div class="sub"></div></div>' +
        '<span class="status"></span>';
      li.querySelector("img").src = item.thumbUrl;
      li.querySelector(".name").textContent = item.file.name;
      const n = item.meta.fields.length;
      li.querySelector(".sub").textContent = formatBytes(item.file.size) + " · " + n + " field" + (n === 1 ? "" : "s");
      const st = li.querySelector(".status");
      if (item.status === "scrubbed") { st.textContent = "Scrubbed"; st.className = "status ok"; }
      else if (n > 0) { st.textContent = "Meta"; st.className = "status warn"; }
      else { st.textContent = "Clean"; st.className = "status"; }
      li.addEventListener("click", function () {
        activeIndex = i;
        renderList();
        renderActive();
      });
      els.fileList.appendChild(li);
    });
  }

  function renderActive() {
    const item = items[activeIndex];
    if (!item) {
      els.metaSummary.innerHTML = '<p class="preview-meta">No photos loaded</p>';
      els.fieldsBox.innerHTML = '<p class="preview-meta">Load a photo to inspect GPS, camera, software, dates, and AI tags.</p>';
      return;
    }
    const f = item.meta.fields;
    const groups = {};
    f.forEach(function (x) {
      groups[x.group] = groups[x.group] || [];
      groups[x.group].push(x);
    });
    const chips = [];
    if (groups["GPS"]) chips.push('<span class="chip danger">GPS</span>');
    if (groups["Camera"]) chips.push('<span class="chip">Camera</span>');
    if (groups["Software"]) chips.push('<span class="chip">Software</span>');
    if (groups["Dates"]) chips.push('<span class="chip neutral">Dates</span>');
    if (groups["AI / C2PA"]) chips.push('<span class="chip danger">AI / C2PA</span>');
    if (groups["IPTC"]) chips.push('<span class="chip">IPTC</span>');
    if (!f.length) chips.push('<span class="chip">No metadata found</span>');

    els.metaSummary.innerHTML =
      "<strong>" + escapeHtml(item.file.name) + "</strong><br />" +
      formatBytes(item.file.size) + " · " + f.length + " field(s) detected" +
      '<div class="chip-row">' + chips.join("") + "</div>";

    if (!f.length) {
      els.fieldsBox.innerHTML = '<p class="preview-meta">No EXIF / GPS / XMP / C2PA markers detected. You can still re-export a scrubbed copy.</p>';
      return;
    }
    let html = "";
    Object.keys(groups).forEach(function (g) {
      html += '<div class="field-group">' + escapeHtml(g) + "</div>";
      html += '<table class="field-table"><tbody>';
      groups[g].forEach(function (row) {
        html += "<tr><th>" + escapeHtml(row.label) + "</th><td>" + escapeHtml(row.value) + "</td></tr>";
      });
      html += "</tbody></table>";
    });
    els.fieldsBox.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateActions() {
    const has = items.length > 0;
    els.scrubBtn.disabled = !has;
    els.reportBtn.disabled = !has || !items.some(function (i) { return i.status === "scrubbed"; });
    els.clearBtn.disabled = !has;
  }

  function buildProofSlip(scrubbedItems, watermark) {
    const now = new Date();
    const tsLocal = now.toLocaleString("en-US", {
      timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "medium"
    }) + " CT";
    const tsIso = now.toISOString();

    let rows = "";
    let text = "MetaGone Scrub Report / Proof Slip\n";
    text += "Generated: " + tsLocal + " (" + tsIso + ")\n";
    text += "Product: MetaGone — client-side metadata scrubber\n";
    text += watermark ? "Tier: FREE (watermarked)\n" : "Tier: UNLOCKED\n";
    text += "========================================\n\n";

    scrubbedItems.forEach(function (item, idx) {
      text += "File " + (idx + 1) + ": " + item.file.name + "\n";
      text += "  Original SHA-256: " + item.hashBefore + "\n";
      text += "  Scrubbed SHA-256: " + (item.hashAfter || "") + "\n";
      text += "  Fields found → removed:\n";
      if (!item.meta.fields.length) {
        text += "    (none detected)\n";
      } else {
        item.meta.fields.forEach(function (f) {
          text += "    [" + f.group + "] " + f.label + ": " + f.value + "  → REMOVED\n";
        });
      }
      text += "\n";

      rows += "<h4 style='margin:1rem 0 0.35rem'>" + escapeHtml(item.file.name) + "</h4>";
      rows += "<p style='margin:0;color:#64748b;font-size:0.75rem'>Original SHA-256: <code>" + escapeHtml(item.hashBefore) + "</code><br/>";
      rows += "Scrubbed SHA-256: <code>" + escapeHtml(item.hashAfter || "") + "</code></p>";
      rows += "<table><thead><tr><th>Group</th><th>Field</th><th>Value (before)</th><th>Status</th></tr></thead><tbody>";
      if (!item.meta.fields.length) {
        rows += "<tr><td colspan='4'>No metadata fields detected</td></tr>";
      } else {
        item.meta.fields.forEach(function (f) {
          rows += "<tr><td>" + escapeHtml(f.group) + "</td><td>" + escapeHtml(f.label) +
            "</td><td>" + escapeHtml(f.value) + "</td><td><strong>REMOVED</strong></td></tr>";
        });
      }
      rows += "</tbody></table>";
    });

    text += "========================================\n";
    text += "Method: Browser canvas rewrite (+ JPEG EXIF strip). ";
    text += "GPS, EXIF, XMP, and C2PA/JUMBF markers removed as completely as practical client-side.\n";
    text += "Photos never left this device.\n";

    const wmOverlay = watermark
      ? '<div class="wm-overlay">MetaGone Free · Unlock $2.99</div>'
      : "";

    const html =
      "<h3>MetaGone Scrub Report</h3>" +
      '<p class="sub">Proof slip · ' + escapeHtml(tsLocal) + "<br/>ISO: " + escapeHtml(tsIso) +
      (watermark ? " · FREE watermarked" : " · Unlocked") + "</p>" +
      rows +
      '<p class="sub" style="margin-top:1rem">Method: on-device canvas rewrite. Nothing uploaded. ' +
      "EXIF / XMP / GPS / C2PA stripped as completely as practical in-browser.</p>" +
      wmOverlay;

    return { html: html, text: text, tsLocal: tsLocal };
  }

  async function doScrub() {
    if (!items.length) return;
    if (!unlocked && freeScrubsLeft() <= 0) {
      openNag();
      return;
    }
    if (!unlocked && items.length > 1) {
      openUnlockModal();
      els.unlockError.hidden = false;
      els.unlockError.textContent = "Batch scrub requires unlock ($2.99).";
      return;
    }

    els.scrubBtn.disabled = true;
    els.scrubBtn.textContent = "Scrubbing…";

    try {
      const targets = unlocked ? items : items.slice(0, 1);
      for (let ti = 0; ti < targets.length; ti++) {
        const item = targets[ti];
        const result = await scrubImage(item.file);
        item.scrubbed = result;
        const ab = await result.blob.arrayBuffer();
        item.hashAfter = await sha256Hex(ab);
        item.status = "scrubbed";
        downloadBlob(result.blob, scrubbedName(item.file.name, result.type));
      }

      if (!unlocked) markFreeUsed();

      const report = buildProofSlip(
        items.filter(function (i) { return i.status === "scrubbed"; }),
        !unlocked
      );
      lastReportHtml = report.html;
      lastReportText = report.text;
      els.reportPanel.hidden = false;
      els.reportPreview.innerHTML = report.html;
      els.reportWatermark.hidden = unlocked;

      downloadBlob(new Blob([report.text], { type: "text/plain;charset=utf-8" }), "metagone-proof-slip.txt");

      const htmlDoc = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>MetaGone Proof Slip</title>" +
        "<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:1rem;color:#0f172a}" +
        "table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e2e8f0;padding:0.35rem;text-align:left;font-size:0.85rem}" +
        ".wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-size:3rem;font-weight:900;color:rgba(248,113,113,0.15);transform:rotate(-24deg);pointer-events:none}</style></head><body>" +
        report.html.replace('class="wm-overlay"', 'class="wm"') + "</body></html>";
      downloadBlob(new Blob([htmlDoc], { type: "text/html;charset=utf-8" }), "metagone-proof-slip.html");

      renderList();
      renderActive();
      refreshUnlockUI();
    } catch (err) {
      console.error(err);
      alert("Scrub failed: " + (err && err.message ? err.message : err));
    } finally {
      els.scrubBtn.textContent = "Scrub & download";
      updateActions();
    }
  }

  function downloadReportOnly() {
    if (!lastReportText) {
      const scrubbed = items.filter(function (i) { return i.status === "scrubbed"; });
      if (!scrubbed.length) return;
      const report = buildProofSlip(scrubbed, !unlocked);
      lastReportText = report.text;
      lastReportHtml = report.html;
    }
    downloadBlob(new Blob([lastReportText], { type: "text/plain;charset=utf-8" }), "metagone-proof-slip.txt");
  }

  function clearAll() {
    items.forEach(function (i) { if (i.thumbUrl) URL.revokeObjectURL(i.thumbUrl); });
    items = [];
    activeIndex = -1;
    lastReportHtml = "";
    lastReportText = "";
    els.reportPanel.hidden = true;
    els.reportPreview.innerHTML = "";
    renderList();
    renderActive();
    updateActions();
    els.fileInput.value = "";
  }

  els.pickBtn.addEventListener("click", function () { els.fileInput.click(); });
  els.addMoreBtn.addEventListener("click", function () { els.fileInput.click(); });
  els.fileInput.addEventListener("change", function () {
    addFiles(els.fileInput.files);
    els.fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach(function (ev) {
    els.dropZone.addEventListener(ev, function (e) {
      e.preventDefault();
      els.dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    els.dropZone.addEventListener(ev, function (e) {
      e.preventDefault();
      els.dropZone.classList.remove("dragover");
    });
  });
  els.dropZone.addEventListener("drop", function (e) {
    addFiles(e.dataTransfer.files);
  });

  els.scrubBtn.addEventListener("click", doScrub);
  els.reportBtn.addEventListener("click", downloadReportOnly);
  els.clearBtn.addEventListener("click", clearAll);

  [els.unlockBtn, els.unlockLink, els.unlockNearExport, els.stickyUnlockBtn, els.footerUnlock].forEach(function (btn) {
    if (btn) btn.addEventListener("click", openUnlockModal);
  });
  els.modalClose.addEventListener("click", closeUnlockModal);
  els.unlockModal.addEventListener("click", function (e) {
    if (e.target === els.unlockModal) closeUnlockModal();
  });
  els.applyKeyBtn.addEventListener("click", function () {
    tryUnlock(els.licenseKey && els.licenseKey.value);
  });
  els.licenseKey.addEventListener("keydown", function (e) {
    if (e.key === "Enter") els.applyKeyBtn.click();
  });
  if (els.demoUnlockBtn) {
    els.demoUnlockBtn.addEventListener("click", function () {
      if (setUnlocked(DEMO_KEY, false)) closeUnlockModal();
    });
  }

  els.nagClose.addEventListener("click", closeNag);
  els.nagDismiss.addEventListener("click", closeNag);
  els.nagUnlockBtn.addEventListener("click", function () { closeNag(); openUnlockModal(); });

  unlocked = isUnlocked();
  setupCheckout();
  refreshUnlockUI();
})();
