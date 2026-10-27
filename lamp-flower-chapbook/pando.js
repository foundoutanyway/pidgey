/* The Pando Peak map, opened large: zoom, drag, and tap a place for its name, its mark and its
   place in the town's coordinates. Its tap points come from ../world-map/pando-hotspots.json, set in
   the page as #pando-data by build_wip.py. Added 2026-10-27 at her pick of the lighter build, "1".
   Without scripts the small picture is a plain link to the full one. */
(function () {
  var f = document.getElementById('pando-map');
  if (!f) return;
  // The map sits in a fold; a link that lands on it opens the fold first.
  var fold = f.closest && f.closest('details');
  function unfold() {
    if (fold && location.hash === '#pando-map') {
      fold.open = true;
      fold.scrollIntoView({ behavior: 'instant', block: 'start' });
      window.scrollBy({ top: -70, behavior: 'instant' });   // clear of the top bar
    }
  }
  window.addEventListener('hashchange', unfold);
  unfold();
  var d = f.querySelector('dialog'), a = f.querySelector('[data-pando-open]');
  if (!d || !d.showModal || !a) return;
  var data = { points: [] };
  try { data = JSON.parse(document.getElementById('pando-data').textContent); } catch (e) {}
  var W = data.w || 2322, H = data.h || 1482;
  var stage = d.querySelector('.pando-stage'), canvas = d.querySelector('.pando-canvas');
  var img = canvas.querySelector('img'), dots = d.querySelector('.pando-dots'), info = d.querySelector('.pando-info');
  var s = 1, min = 1, x = 0, y = 0, sel = null, atFit = true, seen = { w: 0, h: 0 };
  var KIND = { place: 'a place on the mountain', room: 'a room of the Haunted Caves', tree: 'one of Vermillion’s named trees',
               water: 'water', stood: 'where the pigeon has stood' };

  data.points.forEach(function (p, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pando-dot pando-' + p.kind;
    b.style.left = (p.p[0] * 100) + '%';
    b.style.top = (p.p[1] * 100) + '%';
    b.setAttribute('aria-label', p.n);
    b.title = p.n;
    b.setAttribute('data-i', i);
    dots.appendChild(b);
  });

  function box() { return stage.getBoundingClientRect(); }
  function clamp() {
    var r = box(), cw = W * s, ch = H * s;
    x = cw <= r.width ? (r.width - cw) / 2 : Math.min(0, Math.max(r.width - cw, x));
    y = ch <= r.height ? (r.height - ch) / 2 : Math.min(0, Math.max(r.height - ch, y));
  }
  function apply() {
    clamp();
    var r = box();
    seen = { w: r.width, h: r.height };
    canvas.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
    canvas.style.setProperty('--inv', String(1 / s));
  }
  function fit() {
    var r = box();
    if (!r.width || !r.height) return;
    min = Math.min(r.width / W, r.height / H);
    s = min;
    atFit = true;
    apply();
  }
  // When the window changes size, a fitted map fits again, and a zoomed one keeps its scale and the
  // spot that was in the middle of the view.
  function refit() {
    var r = box();
    if (!r.width || !r.height) return;
    if (atFit) { fit(); return; }
    var cx = (seen.w / 2 - x) / s, cy = (seen.h / 2 - y) / s;
    min = Math.min(r.width / W, r.height / H);
    s = Math.max(min, s);
    x = r.width / 2 - cx * s;
    y = r.height / 2 - cy * s;
    apply();
  }
  function zoomAt(k, cx, cy) {
    atFit = false;
    var r = box(), ns = Math.max(min, Math.min(min * 8, s * k));
    var px = cx - r.left, py = cy - r.top;
    x = px - (px - x) * ns / s;
    y = py - (py - y) * ns / s;
    s = ns;
    apply();
  }
  function zoomMid(k) { var r = box(); zoomAt(k, r.left + r.width / 2, r.top + r.height / 2); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function show(i) {
    var p = data.points[i];
    if (!p) return;
    if (sel) sel.classList.remove('is-sel');
    sel = dots.querySelector('[data-i="' + i + '"]');
    if (sel) sel.classList.add('is-sel');
    info.textContent = '';
    var x0 = el('button', 'pando-info-x', '×');
    x0.type = 'button';
    x0.setAttribute('aria-label', 'Close this note');
    x0.addEventListener('click', hide);
    info.appendChild(x0);
    info.appendChild(el('h4', '', p.n));
    info.appendChild(el('p', 'pando-info-kind', KIND[p.kind] || ''));
    if (p.t) info.appendChild(el('p', '', p.t));
    if (p.l) p.l.forEach(function (l) {
      var q = el('p', 'pando-info-link'), k = el('a', '', l[0]);
      k.href = l[1];
      q.appendChild(k);
      info.appendChild(q);
    });
    var meta = '(' + p.at[0] + ', ' + p.at[1] + ')';
    if (p.k) meta = 'Its mark: ' + p.k + ' · ' + meta;
    info.appendChild(el('p', 'pando-info-meta', meta));
    info.hidden = false;
  }
  function hide() {
    info.hidden = true;
    if (sel) sel.classList.remove('is-sel');
    sel = null;
  }

  // dragging, pinching and tapping, all through pointer events
  var ptrs = {}, start = null, moved = 0, pinch = null;
  stage.addEventListener('pointerdown', function (e) {
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    var ids = Object.keys(ptrs);
    if (ids.length === 1) { start = { x: e.clientX, y: e.clientY, ox: x, oy: y, target: e.target }; moved = 0; }
    if (ids.length === 2) {
      var p1 = ptrs[ids[0]], p2 = ptrs[ids[1]];
      pinch = { dist: Math.hypot(p1.x - p2.x, p1.y - p2.y), s: s };
      moved = 99;
    }
    stage.classList.add('is-grab');
  });
  stage.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(ptrs);
    if (ids.length === 2 && pinch) {
      var p1 = ptrs[ids[0]], p2 = ptrs[ids[1]];
      var dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      zoomAt((pinch.s * dist / pinch.dist) / s, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    } else if (ids.length === 1 && start) {
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      if (moved > 5) { atFit = false; x = start.ox + dx; y = start.oy + dy; apply(); }
    }
  });
  function up(e) {
    if (!ptrs[e.pointerId]) return;
    delete ptrs[e.pointerId];
    if (Object.keys(ptrs).length < 2) pinch = null;
    if (Object.keys(ptrs).length === 0) {
      stage.classList.remove('is-grab');
      if (start && moved <= 5 && e.type === 'pointerup') {
        var t = start.target.closest && start.target.closest('.pando-dot');
        if (t) show(t.getAttribute('data-i')); else hide();
      }
      start = null;
    }
  }
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', function (e) { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY); }, { passive: false });
  // a keyboard press on a place opens it too; a tap is handled above, so a click with detail 0 is the keyboard
  dots.addEventListener('click', function (e) {
    var t = e.target.closest('.pando-dot');
    if (t && e.detail === 0) show(t.getAttribute('data-i'));
  });

  d.querySelectorAll('[data-z]').forEach(function (b) {
    b.addEventListener('click', function () {
      var z = b.getAttribute('data-z');
      if (z === 'in') zoomMid(1.5); else if (z === 'out') zoomMid(1 / 1.5); else fit();
    });
  });
  a.addEventListener('click', function (e) {
    e.preventDefault();
    if (!img.getAttribute('src')) img.setAttribute('src', img.getAttribute('data-src'));
    d.showModal();
    hide();
    requestAnimationFrame(fit);
  });
  d.querySelector('.pando-close').addEventListener('click', function () { d.close(); });
  d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  window.addEventListener('resize', function () { if (d.open) refit(); });
})();
