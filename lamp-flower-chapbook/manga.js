// NO NOTES (Season 1): the code boxes, the tracker, the teaser and the enlarged view.
// Added 2026-10-16. Each torn-out page ships scrambled. The word on its mark in the town is
// turned into a key with PBKDF2-SHA256, a check value says whether the word was right, and the
// page is unscrambled here by XOR with SHA-256 of the key and a block counter, the same sums
// build_wip.py ran. The words a reader has found are kept in the reader's own browser, under
// pidgeyMangaWords, and nowhere else. Nothing is sent anywhere.
(function () {
  var sec = document.getElementById('manga');
  if (!sec || !window.crypto || !crypto.subtle) return;
  var ITER = +sec.dataset.iter, STORE = 'pidgeyMangaWords';
  var slots = [].slice.call(sec.querySelectorAll('.nn-slotpage'));
  // The pages that open only when all five are back: the Season 2 teaser and the omake.
  var teasers = [].slice.call(sec.querySelectorAll('.nn-teaser'));
  var enc = new TextEncoder();
  var words = {};
  try { words = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { words = {}; }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(words)); } catch (e) {} }
  function norm(s) { return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function fromHex(h) { var b = new Uint8Array(h.length / 2); for (var i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16); return b; }
  function toHex(b) { return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function join(a, b) { var c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c; }
  async function sha(u) { return new Uint8Array(await crypto.subtle.digest('SHA-256', u)); }
  async function derive(word, saltHex) {
    var k = await crypto.subtle.importKey('raw', enc.encode(word), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: ITER }, k, 256));
  }
  // Returns a picture address for the unscrambled page, or null for a wrong word.
  async function unlock(el, word) {
    var key = await derive(word, el.dataset.salt);
    if (toHex(await sha(join(key, enc.encode('check')))) !== el.dataset.check) return null;
    var data = new Uint8Array(await (await fetch(el.dataset.src)).arrayBuffer());
    var blocks = Math.ceil(data.length / 32), out = new Uint8Array(data.length), BATCH = 2048;
    for (var start = 0; start < blocks; start += BATCH) {
      var jobs = [];
      for (var n = start; n < Math.min(blocks, start + BATCH); n++) {
        var ctr = new Uint8Array(8); new DataView(ctr.buffer).setUint32(4, n);
        jobs.push(sha(join(key, ctr)));
      }
      var streams = await Promise.all(jobs);
      for (var j = 0; j < streams.length; j++) {
        var at = (start + j) * 32, s = streams[j];
        for (var i = 0; i < 32 && at + i < data.length; i++) out[at + i] = data[at + i] ^ s[i];
      }
    }
    return URL.createObjectURL(new Blob([out], { type: 'image/webp' }));
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function show(el, url, fresh) {
    el.innerHTML = '<figure class="nn-page' + (el.classList.contains('wide') ? ' wide' : '') + (fresh ? ' returned' : '') + '"><img src="' + url + '" alt="' + esc(el.dataset.alt) + '"><figcaption>' +
      esc(el.dataset.cap) + '</figcaption>' + (!el.classList.contains('nn-slotpage') ? '' : '<span class="nn-returned-tag">' + esc(sec.dataset.returned) + '</span>') + '</figure>';
    el.classList.add('is-open');
  }
  function count() {
    var n = 0;
    sec.querySelectorAll('.nn-slot').forEach(function (s) { var on = !!words[s.dataset.k]; s.classList.toggle('found', on); if (on) n++; });
    document.getElementById('nnCount').textContent = n + ' of 5 pages returned. ' + (n === slots.length ? sec.dataset.done : sec.dataset.open);
    return n;
  }
  async function openTeaser(fresh) {
    var all = slots.map(function (el) { return words[el.dataset.k]; });
    if (all.some(function (w) { return !w; })) return;
    // Their word is all five words run together, in page order.
    for (var i = 0; i < teasers.length; i++) {
      var t = teasers[i];
      if (t.classList.contains('is-open')) continue;
      var url = await unlock(t, all.join(''));
      if (url) show(t, url, fresh);
    }
  }
  slots.forEach(function (el) {
    var form = el.querySelector('form'), msg = el.querySelector('.nn-msg'), stub = el.querySelector('.nn-stub-img');
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var w = norm(form.querySelector('input').value);
      if (!w) return;
      var url = await unlock(el, w);
      if (url) { words[el.dataset.k] = w; save(); show(el, url, true); if (count() === slots.length) openTeaser(true); }
      else { msg.textContent = sec.dataset.wrong; msg.className = 'nn-msg bad'; stub.classList.remove('shake'); void stub.offsetWidth; stub.classList.add('shake'); }
    });
  });
  // Pages found on an earlier visit are set back in again. A word that no longer opens its page
  // is forgotten rather than kept.
  (async function () {
    for (var i = 0; i < slots.length; i++) {
      var el = slots[i], w = words[el.dataset.k];
      if (!w) continue;
      var url = await unlock(el, w);
      if (url) show(el, url, false); else delete words[el.dataset.k];
    }
    save();
    if (count() === slots.length) openTeaser(false);
  })();
  count();
  // Chapters that come out on a Friday: each is set in once the reader's clock passes its hour,
  // checked at load and again every minute while the page is open.
  function release() {
    sec.querySelectorAll('.nn-later:not(.is-open)').forEach(function (el) {
      if (Date.now() >= Date.parse(el.dataset.release)) show(el, el.dataset.src, false);
    });
  }
  release();
  setInterval(release, 60000);
  // Any page, a stub or a returned page opens larger when it is pressed.
  var lb = document.createElement('div');
  lb.className = 'nn-lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', 'Enlarged page');
  lb.innerHTML = '<button type="button" aria-label="Close">&times;</button><img alt="">';
  document.body.appendChild(lb);
  var big = lb.querySelector('img');
  function close() { lb.classList.remove('open'); document.body.style.overflow = ''; }
  sec.querySelector('.nn-pages').addEventListener('click', function (e) {
    var im = e.target.closest('img');
    if (!im) return;
    big.src = im.currentSrc || im.src; big.alt = im.alt;
    lb.classList.add('open'); document.body.style.overflow = 'hidden';
  });
  lb.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
