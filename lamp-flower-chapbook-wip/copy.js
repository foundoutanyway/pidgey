// Copy buttons for the appendix, so a human can hand a call, or a whole appendix, to their agent.
// One button on each block of code, one beside each call set inside a line, and one on each
// lettered appendix that copies all of it as plain text. Nothing here changes the words.
(function () {
  var root = document.querySelector('.afterword');
  if (!root) return;

  function put(text) {
    if (navigator.clipboard && window.isSecureContext) {
      // If the browser refuses the new way, fall through to the old one before giving up.
      return navigator.clipboard.writeText(text).catch(function () { return old(text); });
    }
    return old(text);
  }

  // An older browser, or a page opened from a file: the old way, through a hidden box.
  function old(text) {
    return new Promise(function (ok, no) {
      var box = document.createElement('textarea');
      box.value = text;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      var done = false;
      try { done = document.execCommand('copy'); } catch (e) { done = false; }
      document.body.removeChild(box);
      if (done) ok(); else no();
    });
  }

  function button(label, get, extra) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'wip-copy' + (extra ? ' ' + extra : '');
    b.textContent = label;
    b.addEventListener('click', function () {
      put(get()).then(function () { b.textContent = 'Copied'; }, function () { b.textContent = 'Select it and copy by hand'; })
        .then(function () { setTimeout(function () { b.textContent = label; }, 1600); });
    });
    return b;
  }

  // Each block of code.
  Array.prototype.forEach.call(root.querySelectorAll('.travel-note pre'), function (pre) {
    pre.parentNode.insertBefore(button('Copy', function () { return pre.textContent; }, 'wip-copy-pre'), pre);
  });

  // Each call set inside a line: a piece of code that holds a brace, or opens with GET or POST.
  Array.prototype.forEach.call(root.querySelectorAll('.travel-note code'), function (code) {
    var text = code.textContent;
    if (code.closest('pre')) return;
    if (text.indexOf('{') === -1 && !/^(GET|POST) /.test(text)) return;
    code.parentNode.insertBefore(button('Copy', function () { return text; }), code.nextSibling);
  });

  // Each lettered appendix, whole. An appendix is the card that carries the letter and every
  // card after it up to the next lettered one.
  Array.prototype.forEach.call(root.querySelectorAll('.wip-appx'), function (label) {
    var first = label.parentNode;
    label.appendChild(button('Copy this appendix as text', function () {
      var cards = [first], next = first.nextElementSibling;
      while (next && !next.querySelector('.wip-appx')) { cards.push(next); next = next.nextElementSibling; }
      document.body.classList.add('wip-copying');
      var text = cards.map(function (c) { return c.innerText.trim(); }).join('\n\n');
      document.body.classList.remove('wip-copying');
      // The note that stands above the appendix travels with any appendix copied whole.
      var note = root.querySelector('.wip-disclaimer p:last-child');
      if (note) text += '\n\n' + note.textContent.trim();
      return text;
    }));
  });
})();
