// The interactive regions map, preview build. Five things, each on top of the plain picture:
//   1. tap a region, a ground or a water and a card says what it is;
//   2. tap a gold dot and the card names the gazetteer entry, and each entry links back to its dot;
//   3. the card gives the distance from where you stand and the walk call, ready to copy;
//   4. zoom and pan, with the lettering kept as type so it stays sharp;
//   5. the gazetteer's search box lights what it finds on the map.
// With scripts off none of this runs and the picture stays as it was.
// Every label here is a plain one of the pen's. No line is in Dom Pidgey's voice.
(function () {
  var fig = document.querySelector('[data-imap]');
  var dataEl = document.getElementById('imap-data');
  if (!fig || !dataEl) return;
  var D = JSON.parse(dataEl.textContent);
  var V = D.view, W = V.w, H = V.h;
  var wrap = fig.querySelector('.imap-wrap');
  var view = fig.querySelector('.imap-view');
  var img = view.querySelector('img');
  var layer = view.querySelector('.imap-layer');
  var svg = layer.querySelector('svg');
  var NS = 'http://www.w3.org/2000/svg';
  var KMAX = 8;
  // Town pace, from the note on travel in Appendix A: five kilometres an hour.
  var PACE = 5000 / 60;
  var narrow = window.matchMedia('(max-width: 700px)');
  var coarse = window.matchMedia('(pointer: coarse)');

  // The ground is the plate with its lettering left out. The lettering is drawn over it as type.
  // Until the ground has loaded, the plain picture stays, so nothing is ever shown doubled.
  // A small script in the page has held the plain plate back, so two pictures are not fetched.
  // If the ground cannot be had, the plain plate goes back and the map stays a picture.
  var ground = new Image();
  ground.onload = start;
  ground.onerror = function () {
    var plain = img.getAttribute('data-plain');
    if (plain && !img.getAttribute('src')) img.setAttribute('src', plain);
  };
  ground.src = fig.getAttribute('data-ground');

  // ------------------------------------------------------------------ small helpers
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function sv(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var a in attrs) e.setAttribute(a, attrs[a]);
    return e;
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function toUnits(x, y) { return [V.m + (x - V.x0) * V.s, V.m + (y - V.y0) * V.s]; }
  function toTown(ux, uy) { return [(ux - V.m) / V.s + V.x0, (uy - V.m) / V.s + V.y0]; }
  function tidy(n) { return String(Math.round(n * 10) / 10); }
  function pair(x, y) { return '(' + tidy(x) + ', ' + tidy(y) + ')'; }
  function meters(n) { return Math.round(n).toLocaleString('en-US') + ' m'; }
  function minutes(dist) {
    var mins = Math.round(dist / PACE);
    if (mins < 1) return 'under a minute';
    if (mins < 60) return 'about ' + mins + (mins === 1 ? ' minute' : ' minutes');
    var h = Math.floor(mins / 60), r = mins % 60;
    return 'about ' + h + (h === 1 ? ' hour' : ' hours') + (r ? ' ' + r + (r === 1 ? ' minute' : ' minutes') : '');
  }
  // The two walk calls are the shapes Appendix F prints.
  function callMark(mark) { return 'world { do: "walk", args: { mark_id: "' + mark + '" } }'; }
  function callPoint(x, y) { return 'world { do: "walk", args: { to_x: ' + tidy(x) + ', to_y: ' + tidy(y) + ' } }'; }

  function put(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return old(text); });
    }
    return old(text);
  }
  function old(text) {
    return new Promise(function (ok, no) {
      var box = document.createElement('textarea');
      box.value = text; box.setAttribute('readonly', ''); box.style.position = 'fixed'; box.style.opacity = '0';
      document.body.appendChild(box); box.select();
      var done = false;
      try { done = document.execCommand('copy'); } catch (e) { done = false; }
      document.body.removeChild(box);
      if (done) ok(); else no();
    });
  }
  function copyButton(get) {
    var b = el('button', 'wip-copy', 'Copy');
    b.type = 'button';
    b.addEventListener('click', function () {
      put(get()).then(function () { b.textContent = 'Copied'; }, function () { b.textContent = 'Select it and copy by hand'; })
        .then(function () { setTimeout(function () { b.textContent = 'Copy'; }, 1600); });
    });
    return b;
  }
  function button(label, cls, fn) {
    var b = el('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  // ------------------------------------------------------------------ what is on the map
  var places = {};
  D.places.forEach(function (p) { places[p.key] = p; });

  // The entries are read off the page itself, so a new entry needs nothing changed here.
  var entries = [].slice.call(document.querySelectorAll('article.place')).map(function (art) {
    var e = { id: art.id, art: art, pts: [], lamps: [] };
    var h = art.querySelector('.entry-copy h3') || art.querySelector('h3');
    e.name = h ? h.textContent.trim() : art.id;
    [].forEach.call(art.querySelectorAll('.place-meta > div'), function (row) {
      var dt = row.querySelector('dt'), dd = row.querySelector('dd');
      if (!dt || !dd) return;
      if (dt.textContent.trim() === 'Region') e.region = dd.textContent.trim();
      if (dt.textContent.trim() === 'XY') {
        e.xyRow = dd; e.xy = dd.textContent.trim();
        var re = /\((-?[\d.]+), (-?[\d.]+)\)/g, hit, plain = e.xy.replace(/−/g, '-');
        while ((hit = re.exec(plain))) e.pts.push([parseFloat(hit[1]), parseFloat(hit[2])]);
      }
    });
    return e;
  });
  var lamps = D.lamps.map(function (xy, i) {
    var l = { i: i, x: xy[0], y: xy[1], u: toUnits(xy[0], xy[1]), entries: [] };
    entries.forEach(function (e) {
      if (e.pts.some(function (p) { return Math.abs(p[0] - l.x) < 0.6 && Math.abs(p[1] - l.y) < 0.6; })) {
        l.entries.push(e); e.lamps.push(l);
      }
    });
    return l;
  });

  // ------------------------------------------------------------------ the view: zoom and pan
  var k = 1, tx = 0, ty = 0, lastW = 0;
  var picking = false, sel = null, stand = null, found = { lamps: [], keys: [] };
  var card, tip, bar, tools, standX, standY, pickBtn, goSel, zoomIn, zoomOut, zoomAll, foundLine;

  function unit() { return W / (view.clientWidth * k); }             // drawing units per screen pixel
  function unitsAt(cx, cy) { var r = view.getBoundingClientRect(), u = unit(); return [(cx - r.left - tx) * u, (cy - r.top - ty) * u]; }
  function pxOf(ux, uy) { var u = unit(); return [ux / u + tx, uy / u + ty]; }   // inside the view, in pixels

  function apply() {
    var w = view.clientWidth, h = view.clientHeight;
    if (!w) return;
    if (lastW && lastW !== w) { tx *= w / lastW; ty *= w / lastW; }
    lastW = w;
    tx = clamp(tx, w - w * k, 0); ty = clamp(ty, h - h * k, 0);
    img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + k + ')';
    var u = unit();
    svg.setAttribute('viewBox', (-tx * u) + ' ' + (-ty * u) + ' ' + (W / k) + ' ' + (H / k));
    // Markers keep their size on the screen whatever the zoom.
    [].forEach.call(svg.querySelectorAll('.imap-mark'), function (g) { g.setAttribute('transform', 'scale(' + u + ')'); });
    view.classList.toggle('imap-zoomed', k > 1.001);
    if (zoomOut) { zoomOut.disabled = k <= 1.001; zoomAll.disabled = k <= 1.001; zoomIn.disabled = k >= KMAX - 0.001; }
    ride();
    placeCard();
    if (tip) tip.hidden = true;
  }
  // The book's top bar, which stays on the screen and covers whatever is under it.
  function barFoot() { var nav = document.querySelector('.site-nav'); return (nav ? nav.getBoundingClientRect().bottom : 0) + 10; }
  // The zoom buttons ride down the map with the reader, so they are in reach wherever the page is.
  // The book's main block clips its overflow, which rules out sticky positioning here.
  function ride() {
    if (!tools) return;
    var r = view.getBoundingClientRect();
    tools.style.top = clamp(barFoot() - r.top, 0, Math.max(0, r.height - tools.offsetHeight)) + 'px';
  }
  function zoomTo(k2, px, py) {
    k2 = clamp(k2, 1, KMAX);
    var mx = (px - tx) / k, my = (py - ty) / k;
    k = k2; tx = px - mx * k; ty = py - my * k;
    apply();
  }
  // The middle of the part of the map that is on the screen, in the view's own pixels.
  function seen() {
    var r = view.getBoundingClientRect();
    var top = clamp(barFoot() - r.top, 0, r.height), bottom = clamp(window.innerHeight - r.top, 0, r.height);
    if (bottom <= top) { top = 0; bottom = r.height; }
    return [r.width / 2, (top + bottom) / 2, bottom - top];
  }
  function zoomBy(factor) { var c = seen(); zoomTo(k * factor, c[0], c[1]); }
  // Bring one or more points, given in drawing units, into view, and scroll the page to them.
  function focusOn(pts, wanted) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var w = view.clientWidth, h = view.clientHeight, room = Math.min(h, window.innerHeight - 110);
    var fit = Math.min(W / ((x1 - x0) * 1.5 || 1), room * W / (w * ((y1 - y0) * 1.5 || 1)));
    k = clamp(Math.min(wanted || KMAX, fit), 1, KMAX);
    var u = W / (w * k), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    tx = w / 2 - cx / u; ty = h / 2 - cy / u;
    apply();
    var p = pxOf(cx, cy), r = view.getBoundingClientRect();
    jump(r.top + p[1] - window.innerHeight * 0.45);
    placeCard();
  }
  // The book scrolls smoothly. The map's own jumps are made at once, so the card can be placed
  // against where the page really is.
  function jump(dy) {
    try { window.scrollBy({ top: dy, behavior: 'instant' }); } catch (err) { window.scrollBy(0, dy); }
  }

  // ------------------------------------------------------------------ pointers
  var pts = {}, moved = false, many = false, downAt = 0, pinch = 0, mid = null;
  function count() { return Object.keys(pts).length; }
  function two() { var a = Object.keys(pts); return [pts[a[0]], pts[a[1]]]; }

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pts[e.pointerId] = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
    if (count() === 1) { moved = false; many = false; downAt = Date.now(); }
    if (count() === 2) {
      many = true;
      var t = two(); pinch = Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y);
      mid = [(t[0].x + t[1].x) / 2, (t[0].y + t[1].y) / 2];
    }
  }
  function onMove(e) {
    var p = pts[e.pointerId];
    if (!p) { hover(e); return; }
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 6) moved = true;
    if (count() === 2) {
      var t = two(), d = Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y);
      var m2 = [(t[0].x + t[1].x) / 2, (t[0].y + t[1].y) / 2], r = view.getBoundingClientRect();
      tx += m2[0] - mid[0]; ty += m2[1] - mid[1];
      if (pinch > 0) zoomTo(k * d / pinch, m2[0] - r.left, m2[1] - r.top); else apply();
      pinch = d; mid = m2;
      e.preventDefault();
    } else if (count() === 1 && k > 1.001 && moved) {
      try { view.setPointerCapture(e.pointerId); } catch (err) {}
      tx += dx; ty += dy; apply();
      view.classList.add('imap-dragging');
      e.preventDefault();
    }
  }
  function onUp(e) {
    var p = pts[e.pointerId];
    if (!p) return;
    delete pts[e.pointerId];
    view.classList.remove('imap-dragging');
    if (e.type === 'pointercancel') return;
    if (count() === 0 && !moved && !many && Date.now() - downAt < 700) tap(e.clientX, e.clientY);
  }
  function onWheel(e) {
    if (!(e.ctrlKey || e.metaKey) && k <= 1.001) return;      // a plain scroll over the whole map scrolls the page
    e.preventDefault();
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1), r = view.getBoundingClientRect();
    var rate = Math.abs(dy) < 40 ? 0.012 : 0.002;
    zoomTo(k * Math.exp(-dy * rate), e.clientX - r.left, e.clientY - r.top);
  }
  function onKey(e) {
    var step = 70;
    if (e.key === '+' || e.key === '=') zoomBy(1.5);
    else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.5);
    else if (e.key === '0') { k = 1; tx = ty = 0; apply(); }
    else if (e.key === 'Escape') { setPicking(false); select(null); }
    else if (k > 1.001 && e.key.indexOf('Arrow') === 0) {
      if (e.key === 'ArrowLeft') tx += step; if (e.key === 'ArrowRight') tx -= step;
      if (e.key === 'ArrowUp') ty += step; if (e.key === 'ArrowDown') ty -= step;
      apply();
    } else return;
    e.preventDefault();
  }

  // ------------------------------------------------------------------ what a tap means
  function reach() { return (coarse.matches ? 22 : 14) * unit(); }
  function dotsNear(u) {
    var r = reach();
    return lamps.map(function (l) { return { l: l, d: Math.hypot(l.u[0] - u[0], l.u[1] - u[1]) }; })
      .filter(function (o) { return o.d <= r; }).sort(function (a, b) { return a.d - b.d; }).map(function (o) { return o.l; });
  }
  function shapeAt(cx, cy) {
    var stack = document.elementsFromPoint(cx, cy);
    for (var i = 0; i < stack.length; i++) {
      if (stack[i].classList && stack[i].classList.contains('imap-shape')) return stack[i];
      if (stack[i] === view) break;
    }
    return null;
  }
  function onSheet(u) { return u[0] >= V.m && u[0] <= W - V.m && u[1] >= V.m && u[1] <= H - V.m; }
  function onTitleCard(u) { return u[0] >= V.card[0] && u[0] <= V.card[2] && u[1] >= V.card[1] && u[1] <= V.card[3]; }

  function tap(cx, cy) {
    var u = unitsAt(cx, cy), t = toTown(u[0], u[1]);
    if (!onSheet(u)) { select(null); return; }
    var near = dotsNear(u);
    if (picking) {
      if (near.length) setStand(near[0].x, near[0].y); else setStand(Math.round(t[0]), Math.round(t[1]));
      setPicking(false);
      return;
    }
    if (near.length === 1) return select({ type: 'dot', lamp: near[0], anchor: near[0].u });
    if (near.length > 1) return select({ type: 'many', lamps: near, anchor: u });
    if (onTitleCard(u)) return select(null);
    var shape = shapeAt(cx, cy);
    var spot = [Math.round(t[0]), Math.round(t[1])];
    if (shape) return select({ type: 'place', place: places[shape.getAttribute('data-key')], spot: spot, anchor: u });
    select({ type: 'spot', spot: spot, anchor: u });
  }

  function hover(e) {
    if (e.pointerType !== 'mouse' || !tip) return;
    var u = unitsAt(e.clientX, e.clientY), near = onSheet(u) ? dotsNear(u) : [];
    view.classList.toggle('imap-over-dot', near.length > 0);
    if (!near.length) { tip.hidden = true; return; }
    var names = [];
    near.forEach(function (l) { l.entries.forEach(function (en) { if (names.indexOf(en.name) < 0) names.push(en.name); }); });
    tip.textContent = names.length ? names.join(' · ') : pair(near[0].x, near[0].y);
    var p = pxOf(near[0].u[0], near[0].u[1]);
    tip.hidden = false;
    tip.style.left = clamp(p[0], 60, view.clientWidth - 60) + 'px';
    tip.style.top = (p[1] - 14) + 'px';
  }

  // ------------------------------------------------------------------ selecting, and the card
  var pins;
  function select(s) {
    sel = s;
    [].forEach.call(svg.querySelectorAll('.is-sel'), function (n) { n.classList.remove('is-sel'); });
    while (pins.firstChild) pins.removeChild(pins.firstChild);
    if (stand) pins.appendChild(marker('imap-stand', toUnits(stand.x, stand.y)));
    if (s) {
      if (s.type === 'place') {
        var shape = svg.querySelector('.imap-shape[data-key="' + s.place.key + '"]');
        if (shape) shape.classList.add('is-sel');
        if (!s.place.at) pins.appendChild(marker('imap-spot', toUnits(s.spot[0], s.spot[1])));
      }
      if (s.type === 'dot') svg.querySelector('.imap-dot[data-i="' + s.lamp.i + '"]').classList.add('is-sel');
      if (s.type === 'many') s.lamps.forEach(function (l) { svg.querySelector('.imap-dot[data-i="' + l.i + '"]').classList.add('is-sel'); });
      if (s.type === 'spot') pins.appendChild(marker('imap-spot', toUnits(s.spot[0], s.spot[1])));
    }
    route();
    render();
    apply();
  }
  function marker(cls, u) {
    var g = sv('g', { 'class': cls, transform: 'translate(' + u[0] + ',' + u[1] + ')' });
    var inner = sv('g', { 'class': 'imap-mark' });
    if (cls === 'imap-stand') {
      inner.appendChild(sv('circle', { r: 7 }));
      inner.appendChild(sv('path', { d: 'M0,0 V-22 L14,-17 L0,-12' }));
    } else {
      inner.appendChild(sv('path', { d: 'M-8,0 H8 M0,-8 V8' }));
    }
    g.appendChild(inner);
    return g;
  }
  // Where a walk to the selected thing would end, in the town's coordinates.
  function target(s) {
    if (!s) return null;
    if (s.type === 'place') return s.place.at ? { x: s.place.at[0], y: s.place.at[1], to: 'its middle' } : { x: s.spot[0], y: s.spot[1], to: 'the spot you tapped' };
    if (s.type === 'dot') return { x: s.lamp.x, y: s.lamp.y, to: 'this dot' };
    if (s.type === 'spot') return { x: s.spot[0], y: s.spot[1], to: 'this spot' };
    return null;
  }
  function route() {
    var g = svg.querySelector('.imap-route'), t = target(sel);
    while (g.firstChild) g.removeChild(g.firstChild);
    if (!stand || !t) return;
    var a = toUnits(stand.x, stand.y), b = toUnits(t.x, t.y);
    g.appendChild(sv('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }));
  }

  function row(dl, label, value, code) {
    var d = el('div'), dd = el('dd');
    d.appendChild(el('dt', null, label));
    if (code) { dd.appendChild(el('code', null, value)); dd.appendChild(copyButton(function () { return value; })); }
    else dd.textContent = value;
    d.appendChild(dd); dl.appendChild(d);
  }
  function callLine(box, label, text) {
    var p = el('p', 'imap-call');
    p.appendChild(el('span', null, label));
    p.appendChild(el('code', null, text));
    p.appendChild(copyButton(function () { return text; }));
    box.appendChild(p);
  }
  function walkBlock(s) {
    var t = target(s), box = el('div', 'imap-walk'), water = s.type === 'place' && s.place.water;
    box.appendChild(el('h5', null, 'Walk there'));
    if (stand) {
      var dist = Math.hypot(t.x - stand.x, t.y - stand.y);
      box.appendChild(el('p', null, 'From where you stand, ' + pair(stand.x, stand.y) + ': ' + meters(dist) + ' in a straight line to ' + t.to +
        ', ' + minutes(dist) + ' at town pace, 5 km an hour.'));
      box.appendChild(el('p', 'imap-small', 'A straight line takes no account of water.'));
    } else {
      var p = el('p', null, 'Say where you stand and this card gives the distance. ');
      p.appendChild(button('Pick where I stand', 'imap-btn', function () { setPicking(true); }));
      box.appendChild(p);
    }
    if (water) {
      box.appendChild(el('p', 'imap-small', 'This is water, so no walk call is given.'));
      return box;
    }
    if (s.type === 'place') {
      callLine(box, 'To its mark', callMark(s.place.key));
      callLine(box, 'To its middle, ' + pair(t.x, t.y), callPoint(t.x, t.y));
      callLine(box, 'To the spot you tapped, ' + pair(s.spot[0], s.spot[1]), callPoint(s.spot[0], s.spot[1]));
    } else {
      callLine(box, 'To ' + t.to + ', ' + pair(t.x, t.y), callPoint(t.x, t.y));
    }
    var foot = el('p', 'imap-small', 'Before filing a walk, check the walkers door. The steps are in ');
    var a = el('a', null, 'Appendix B'); a.href = 'notes.html#the-mcp-door';
    foot.appendChild(a); foot.appendChild(document.createTextNode('.'));
    box.appendChild(foot);
    box.appendChild(button('I stand here', 'imap-btn', function () { setStand(t.x, t.y); }));
    return box;
  }

  function render() {
    while (card.firstChild) card.removeChild(card.firstChild);
    card.hidden = !sel;
    if (!sel) return;
    var close = button('×', 'imap-close', function () { select(null); });
    close.setAttribute('aria-label', 'Close this card');
    card.appendChild(close);
    if (sel.type === 'place') {
      var p = sel.place, dl = el('dl', 'imap-facts');
      card.appendChild(el('p', 'imap-kind', p.kind));
      card.appendChild(el('h4', null, p.name));
      if (!p.bare) { row(dl, D.heads[1], p.where); row(dl, D.heads[2], p.centre); row(dl, D.heads[3], p.size); }
      row(dl, D.heads[4], p.key, true);
      card.appendChild(dl);
      card.appendChild(walkBlock(sel));
    } else if (sel.type === 'dot') {
      card.appendChild(el('p', 'imap-kind', 'Ground the pigeon has stood on'));
      if (!sel.lamp.entries.length) card.appendChild(el('h4', null, pair(sel.lamp.x, sel.lamp.y)));
      sel.lamp.entries.forEach(function (en) {
        card.appendChild(el('h4', null, en.name));
        var dl = el('dl', 'imap-facts');
        if (en.region) row(dl, 'Region', en.region);
        if (en.xy) row(dl, 'XY', en.xy);
        card.appendChild(dl);
        var a = el('a', 'imap-read', 'Read its entry'); a.href = '#' + en.id;
        a.addEventListener('click', function () { showAll(); select(null); });
        card.appendChild(a);
      });
      card.appendChild(walkBlock(sel));
    } else if (sel.type === 'many') {
      card.appendChild(el('p', 'imap-kind', 'Close together'));
      card.appendChild(el('h4', null, sel.lamps.length + ' gold dots sit close together here'));
      var list = el('ul', 'imap-list');
      sel.lamps.forEach(function (l) {
        var li = el('li');
        li.appendChild(button(l.entries.length ? l.entries.map(function (en) { return en.name; }).join(' · ') : pair(l.x, l.y), 'imap-pick',
          function () { select({ type: 'dot', lamp: l, anchor: l.u }); focusOn([l.u], Math.max(k, 5)); }));
        list.appendChild(li);
      });
      card.appendChild(list);
      var where = sel.anchor;
      card.appendChild(button('Zoom in here', 'imap-btn', function () { focusOn([where], Math.min(KMAX, k * 2.5)); }));
    } else {
      card.appendChild(el('p', 'imap-kind', 'Outside every ring'));
      card.appendChild(el('h4', null, pair(sel.spot[0], sel.spot[1])));
      card.appendChild(walkBlock(sel));
    }
    // Every card says how old its facts are, so nobody takes it for the town as it is this minute.
    if (D.asof) card.appendChild(el('p', 'imap-small imap-asof-card', D.asof));
  }
  // The card sits beside the place on a wide screen. On a narrow one the styles pin it to the foot.
  function placeCard() {
    if (!card || card.hidden || !sel) return;
    if (narrow.matches) { card.style.left = card.style.top = ''; return; }
    var p = pxOf(sel.anchor[0], sel.anchor[1]), w = view.clientWidth, h = view.clientHeight;
    var x = clamp(p[0], 0, w), y = clamp(p[1], 0, h), cw = card.offsetWidth, ch = card.offsetHeight;
    var left = x + 18 + cw <= w ? x + 18 : x - 18 - cw;
    var top = y - 30, r = view.getBoundingClientRect();
    var floor = Math.min(h, window.innerHeight - r.top) - 8, roof = Math.max(0, barFoot() - r.top);
    if (top + ch > floor) top = floor - ch;
    if (top < roof) top = roof;
    card.style.left = clamp(left, 8, Math.max(8, w - cw - 8)) + 'px';
    card.style.top = top + 'px';
  }

  // ------------------------------------------------------------------ where you stand
  function setStand(x, y) {
    stand = (x == null || isNaN(x) || isNaN(y)) ? null : { x: x, y: y };
    standX.value = stand ? tidy(stand.x) : ''; standY.value = stand ? tidy(stand.y) : '';
    select(sel);
  }
  function setPicking(on) {
    picking = on;
    view.classList.toggle('imap-picking', on);
    pickBtn.setAttribute('aria-pressed', String(on));
    pickBtn.textContent = on ? 'Now tap the map' : 'Pick on the map';
  }

  // ------------------------------------------------------------------ the gazetteer's search, on the map
  function showAll() {
    var input = document.getElementById('placeFilter');
    if (input && input.value) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  function find(q) {
    [].forEach.call(svg.querySelectorAll('.is-found'), function (n) { n.classList.remove('is-found'); });
    found = { lamps: [], keys: [] };
    svg.classList.toggle('imap-finding', !!q);
    if (!q) { foundLine.hidden = true; return; }
    var hits = entries.filter(function (e) { return (e.art.getAttribute('data-search') || '').indexOf(q) > -1; });
    var on = hits.filter(function (e) { return e.lamps.length; });
    on.forEach(function (e) { e.lamps.forEach(function (l) { if (found.lamps.indexOf(l) < 0) found.lamps.push(l); }); });
    if (q.length >= 3) D.places.forEach(function (p) { if (p.name.toLowerCase().indexOf(q) > -1) found.keys.push(p.key); });
    found.lamps.forEach(function (l) { svg.querySelector('.imap-dot[data-i="' + l.i + '"]').classList.add('is-found'); });
    found.keys.forEach(function (key) { var s = svg.querySelector('.imap-shape[data-key="' + key + '"]'); if (s) s.classList.add('is-found'); });
    while (foundLine.firstChild) foundLine.removeChild(foundLine.firstChild);
    var say = [];
    if (hits.length === 1) say.push(on.length ? 'The entry found has a gold dot on the map.' : 'The entry found has no dot on the map.');
    else if (hits.length) say.push((on.length === hits.length ? 'All ' + hits.length : on.length + ' of the ' + hits.length) + ' entries found ' + (on.length === 1 ? 'has' : 'have') + ' a gold dot on the map.');
    if (found.keys.length) say.push('The map also names ' + found.keys.map(function (key) { return places[key].name; }).join(', ') + '.');
    if (!say.length) { foundLine.hidden = true; return; }
    foundLine.appendChild(el('span', null, say.join(' ') + ' '));
    if (found.lamps.length || found.keys.length) foundLine.appendChild(button('Show on the map', 'imap-btn', showFound));
    foundLine.hidden = false;
  }
  function showFound() {
    var pts = found.lamps.map(function (l) { return l.u; });
    found.keys.forEach(function (key) { var p = places[key]; if (p.at) pts.push(toUnits(p.at[0], p.at[1])); });
    if (!pts.length) { fig.scrollIntoView(); return; }
    if (found.lamps.length === 1 && !found.keys.length) select({ type: 'dot', lamp: found.lamps[0], anchor: found.lamps[0].u });
    else if (!found.lamps.length && found.keys.length === 1) select({ type: 'place', place: places[found.keys[0]], spot: places[found.keys[0]].at, anchor: pts[0] });
    else select(null);
    focusOn(pts, pts.length === 1 ? 4 : KMAX);
  }

  // ------------------------------------------------------------------ putting it together
  function start() {
    img.removeAttribute('loading');
    img.src = ground.src;
    img.setAttribute('draggable', 'false');
    fig.classList.add('imap-on');
    layer.hidden = false;
    pins = svg.querySelector('.imap-pins');
    view.tabIndex = 0;
    view.setAttribute('role', 'group');
    view.setAttribute('aria-label', 'The map of Postmark Town. Tap a region or a gold dot, or choose a place from the Go to list above the map.');

    // The bar above the map: a list to go by, and where you stand.
    bar = el('div', 'imap-bar');
    var go = el('label', 'imap-go'); go.appendChild(el('span', null, 'Go to'));
    goSel = el('select'); goSel.appendChild(new Option('Choose a place', ''));
    D.kinds.forEach(function (kind) {
      var og = el('optgroup'); og.label = kind;
      D.places.forEach(function (p) { if (p.kind === kind) og.appendChild(new Option(p.name, 'p:' + p.key)); });
      goSel.appendChild(og);
    });
    var og = el('optgroup'); og.label = 'Ground the pigeon has stood on';
    entries.forEach(function (e) { if (e.lamps.length) og.appendChild(new Option(e.name, 'e:' + e.id)); });
    goSel.appendChild(og);
    goSel.addEventListener('change', function () {
      var v = goSel.value; if (!v) return;
      if (v.charAt(0) === 'p') goPlace(places[v.slice(2)]); else goEntry(entries.filter(function (e) { return e.id === v.slice(2); })[0]);
      goSel.value = '';
    });
    go.appendChild(goSel); bar.appendChild(go);

    var st = el('span', 'imap-standing'); st.appendChild(el('span', null, 'You stand at'));
    standX = el('input'); standY = el('input');
    [[standX, 'x'], [standY, 'y']].forEach(function (pairOf) {
      var lab = el('label', null, pairOf[1] + ' ');
      pairOf[0].type = 'number'; pairOf[0].step = 'any'; pairOf[0].setAttribute('aria-label', 'Where you stand, ' + pairOf[1]);
      pairOf[0].addEventListener('change', function () {
        if (standX.value === '' || standY.value === '') { if (standX.value === '' && standY.value === '') setStand(null); return; }
        setStand(parseFloat(standX.value), parseFloat(standY.value));
      });
      lab.appendChild(pairOf[0]); st.appendChild(lab);
    });
    pickBtn = button('Pick on the map', 'imap-btn', function () { setPicking(!picking); });
    pickBtn.setAttribute('aria-pressed', 'false');
    st.appendChild(pickBtn);
    st.appendChild(button('Clear', 'imap-btn', function () { setPicking(false); setStand(null); }));
    bar.appendChild(st);
    bar.appendChild(el('p', 'imap-hint', coarse.matches ? 'Pinch to zoom. Drag to move once zoomed in.' : 'Hold Ctrl and scroll to zoom, or use the buttons. Drag to move once zoomed in.'));
    fig.insertBefore(bar, wrap);

    // The zoom buttons stay in reach while the map is on the screen.
    tools = el('div', 'imap-tools');
    var stack = el('div');
    zoomIn = button('+', 'imap-zoom', function () { zoomBy(1.6); }); zoomIn.setAttribute('aria-label', 'Zoom in');
    zoomOut = button('−', 'imap-zoom', function () { zoomBy(1 / 1.6); }); zoomOut.setAttribute('aria-label', 'Zoom out');
    zoomAll = button('Whole map', 'imap-zoom imap-whole', function () { k = 1; tx = ty = 0; apply(); });
    stack.appendChild(zoomIn); stack.appendChild(zoomOut); stack.appendChild(zoomAll);
    tools.appendChild(stack);
    wrap.insertBefore(tools, view);

    tip = el('div', 'imap-tip'); tip.hidden = true; view.appendChild(tip);
    card = el('div', 'imap-card'); card.hidden = true; card.setAttribute('role', 'group'); card.setAttribute('aria-live', 'polite');
    wrap.appendChild(card);

    view.addEventListener('pointerdown', onDown);
    view.addEventListener('pointermove', onMove);
    view.addEventListener('pointerup', onUp);
    view.addEventListener('pointercancel', onUp);
    view.addEventListener('pointerleave', function () { if (tip) tip.hidden = true; view.classList.remove('imap-over-dot'); });
    view.addEventListener('wheel', onWheel, { passive: false });
    view.addEventListener('dblclick', function (e) { var r = view.getBoundingClientRect(); zoomTo(k * (e.shiftKey ? 0.5 : 2), e.clientX - r.left, e.clientY - r.top); e.preventDefault(); });
    view.addEventListener('keydown', onKey);
    window.addEventListener('resize', apply);
    window.addEventListener('scroll', ride, { passive: true });

    // Each entry that has a dot gets a link back to it.
    entries.forEach(function (e) {
      if (!e.lamps.length || !e.xyRow) return;
      var a = el('a', 'imap-show', 'Show on map'); a.href = '#town-map';
      a.addEventListener('click', function (ev) { ev.preventDefault(); goEntry(e); });
      e.xyRow.appendChild(document.createTextNode(' ')); e.xyRow.appendChild(a);
    });

    // The search box under the map.
    var input = document.getElementById('placeFilter');
    if (input) {
      foundLine = el('p', 'imap-found'); foundLine.hidden = true; foundLine.setAttribute('aria-live', 'polite');
      var holder = input.closest('.filter-wrap') || input;
      holder.parentNode.insertBefore(foundLine, holder.nextSibling);
      input.addEventListener('input', function () { find(input.value.trim().toLowerCase()); });
      if (input.value) find(input.value.trim().toLowerCase());
    } else { foundLine = el('p'); }

    apply();
  }
  function goPlace(p) {
    var u = p.at ? toUnits(p.at[0], p.at[1]) : null;
    if (!u) {           // the Main Channel and the Sea have no middle printed, so show the whole map
      k = 1; tx = ty = 0;
      var shape = svg.querySelector('.imap-shape[data-key="' + p.key + '"]'), b = shape.getBBox();
      u = [b.x + b.width / 2, b.y + b.height / 2];
      var t = toTown(u[0], u[1]);
      select({ type: 'place', place: p, spot: [Math.round(t[0]), Math.round(t[1])], anchor: u });
      fig.scrollIntoView();
      return;
    }
    select({ type: 'place', place: p, spot: p.at, anchor: u });
    focusOn([u], 2.2);
  }
  function goEntry(e) {
    if (!e || !e.lamps.length) return;
    var first = e.lamps[0];
    select({ type: 'dot', lamp: first, anchor: first.u });
    e.lamps.forEach(function (l) { svg.querySelector('.imap-dot[data-i="' + l.i + '"]').classList.add('is-sel'); });
    focusOn(e.lamps.map(function (l) { return l.u; }), e.lamps.length === 1 ? 4 : KMAX);
  }

  // For checking the page from the console, nothing more.
  window.pidgeyMap = {
    state: function () { return { k: k, tx: tx, ty: ty, sel: sel && sel.type, stand: stand, found: { lamps: found.lamps.length, keys: found.keys.slice() } }; },
    tap: function (x, y) {            // a tap at a place given in the town's coordinates, scrolled onto the screen first
      var u = toUnits(x, y), p = pxOf(u[0], u[1]), r = view.getBoundingClientRect();
      jump(r.top + p[1] - window.innerHeight / 2);
      r = view.getBoundingClientRect();
      tap(r.left + p[0], r.top + p[1]);
    },
    zoomBy: function (factor) { zoomBy(factor); }
  };
})();
