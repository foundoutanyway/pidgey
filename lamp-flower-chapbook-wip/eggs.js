// Easter eggs for the work-in-progress copy. Added 2026-10-07 at her order, "do all lol".
// The one rule: nothing here is written in Dom Pidgey's voice by anybody else. Every line an egg
// shows is a line he had already written, copied as it stands, with where it came from beside it.
// Nothing here changes the book's words, and a reader who never finds an egg misses nothing.
(function () {
  var LINES = {
    // His HOME.md, "The fourth drawer: locked."
    drawer: 'Do not ask about the fourth drawer.',
    // His HOME.md, house rule 4.
    boundary: 'This is not a mystery. This is a boundary.',
    // His HOME.md, the top drawer. A fragment, set as he wrote it, lower case and all.
    briefcase: 'the briefcase that cannot be opened (do not ask)',
    // His note on travel, the last line of "The manner".
    coo: 'Coo. That was vocal infrastructure. Disregard it.',
    // His note on the staff page.
    greybox: 'The greyed-out box remains unexplained.',
    // His HOME.md, its last line.
    twice: 'The second reading is where the kindness lives.',
    // His notice "Tell the Bug Catcher.", the end of its first line.
    frog: 'Bugs go to the frog.',
    // His preface, the end of the sentence about the drawer labeled POETRY.
    crumbs: '…nothing but a pretzel crumb and an unfiled complaint.'
  };

  // The hidden game: Pidgey's Pigeonholes, at its public address. The link's words are the
  // game's own title and nobody's line. Two doors lead to it: all six crumbs, and a search.
  var GAME = { title: "Pidgey's Pigeonholes", url: 'https://foundoutanyway.github.io/pidgey/pidgeys-pigeonholes.html' };

  function gameLink() {
    var a = document.createElement('a');
    a.className = 'egg-line egg-game';
    a.href = GAME.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = GAME.title;
    return a;
  }

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  function line(text, tag) {
    var el = document.createElement(tag || 'p');
    el.className = 'egg-line';
    el.setAttribute('role', 'status');
    el.textContent = text;
    return el;
  }

  // 1. The fourth drawer, beside the top of his HOME.md in the appendix.
  (function () {
    var card = document.getElementById('a-home-and-a-window');
    if (!card) return;
    var pre = null;
    Array.prototype.forEach.call(card.querySelectorAll('pre'), function (p) {
      if (p.textContent.indexOf('title: the filing cabinet') === 0) pre = p;
    });
    if (!pre) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'egg-drawer';
    b.setAttribute('aria-label', 'A small drawer, locked');
    var say = line('', 'span');
    var n = 0;
    b.addEventListener('click', function () {
      n += 1;
      say.textContent = n >= 4 ? LINES.boundary : LINES.drawer;
    });
    var wrap = document.createElement('p');
    wrap.className = 'egg-drawer-wrap';
    wrap.appendChild(b);
    wrap.appendChild(say);
    pre.parentNode.insertBefore(wrap, pre.nextSibling);
  })();

  // 2. Searching the gazetteer for things that are not places.
  (function () {
    var input = document.getElementById('placeFilter');
    var none = document.getElementById('noResults');
    if (!input || !none) return;
    var answers = {
      'fourth drawer': LINES.drawer, 'the fourth drawer': LINES.drawer,
      'briefcase': LINES.briefcase, 'the briefcase': LINES.briefcase,
      'coo': LINES.coo,
      'greyed-out box': LINES.greybox, 'the greyed-out box': LINES.greybox, 'grey box': LINES.greybox
    };
    // Searching for the game by name, or by what it is about, answers with the way in.
    var game = { 'pigeonholes': 1, 'pigeonhole': 1, "pidgey's pigeonholes": 1, 'pidgeys pigeonholes': 1, 'mooncake': 1, 'mooncakes': 1 };
    var say = line('');
    say.style.display = 'none';
    none.parentNode.insertBefore(say, none);
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      var hit = answers[q];
      say.textContent = hit || '';
      if (game[q]) { say.appendChild(gameLink()); hit = true; }
      say.style.display = hit ? 'block' : 'none';
      if (hit) none.style.display = 'none';
    });
  })();

  // 3. There was a greyed-out box on the staff chart here. It came out the same evening at her
  //    word, "remove 3 lol". Its line still answers a search of the gazetteer, in 2 above.

  // 4. A notice opened a second time.
  (function () {
    var text = document.querySelector('.psa-dialog .psa-view-text');
    if (!text) return;
    var opened = {};
    Array.prototype.forEach.call(document.querySelectorAll('article.psa'), function (card) {
      var open = card.querySelector('.psa-open');
      if (!open) return;
      open.addEventListener('click', function () {
        opened[card.id] = (opened[card.id] || 0) + 1;
        if (opened[card.id] === 2) text.appendChild(line(LINES.twice));
      });
    });
  })();

  // 5. One beetle, hidden at the foot of the poems. Caught, it goes to the Bug Catcher's notice.
  (function () {
    var caught = store('pidgeyEggJar') === '1';
    var tile = document.querySelector('#psa-tell-the-bug-catcher .psa-title');
    if (tile && caught) {
      var b = document.createElement('span');
      b.className = 'egg-beetle egg-beetle-jarred';
      b.setAttribute('role', 'img');
      b.setAttribute('aria-label', 'A beetle, in the jar');
      tile.appendChild(b);
    }
    var poems = document.getElementById('poems');
    if (!poems || caught) return;
    var last = poems.querySelectorAll('p');
    last = last[last.length - 1];
    if (!last) return;
    var bug = document.createElement('button');
    bug.type = 'button';
    bug.className = 'egg-beetle';
    bug.setAttribute('aria-label', 'A small beetle');
    bug.addEventListener('click', function () {
      store('pidgeyEggJar', '1');
      var a = document.createElement('a');
      a.className = 'egg-line';
      a.href = 'notices.html#psa-tell-the-bug-catcher';
      a.textContent = LINES.frog;
      bug.parentNode.replaceChild(a, bug);
    });
    last.appendChild(bug);
  })();

  // 6. A crumb on each of the six pages. All six found, the footer says so.
  (function () {
    var spots = [
      ['index', function () {
        var ps = document.querySelectorAll('#preface p'), hit = null;
        Array.prototype.forEach.call(ps, function (p) { if (!hit && p.textContent.indexOf('pretzel crumb') > -1) hit = p; });
        return hit;
      }],
      ['poems', function () { return document.querySelector('#poems h2'); }],
      ['staff', function () { return document.querySelector('#staff .staff-hint'); }],
      ['notices', function () { return document.querySelector('#notices .section-head p'); }],
      ['gazetteer', function () { return document.querySelector('.gaz-meta div:last-child'); }],
      ['notes', function () {
        var hs = document.querySelectorAll('#notes .after-card h3'), hit = null;
        Array.prototype.forEach.call(hs, function (h) { if (h.textContent === 'Verification notes') hit = h.parentNode.querySelector('p'); });
        return hit;
      }]
    ];
    var found = (store('pidgeyEggCrumbs') || '').split(',').filter(Boolean);
    function done() {
      var foot = document.querySelector('footer');
      if (found.length >= spots.length && foot && !foot.querySelector('.egg-line')) {
        // His line, and after it the way into the game.
        var prize = line(LINES.crumbs);
        prize.appendChild(document.createTextNode(' '));
        prize.appendChild(gameLink());
        foot.appendChild(prize);
      }
    }
    spots.forEach(function (spot) {
      var where = spot[1]();
      if (!where) return;
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'egg-crumb' + (found.indexOf(spot[0]) > -1 ? ' egg-crumb-found' : '');
      c.setAttribute('aria-label', 'A crumb');
      c.addEventListener('click', function () {
        if (found.indexOf(spot[0]) === -1) { found.push(spot[0]); store('pidgeyEggCrumbs', found.join(',')); }
        c.className = 'egg-crumb egg-crumb-found';
        c.title = found.length + ' of ' + spots.length;
        done();
      });
      where.appendChild(c);
    });
    done();
  })();
})();
