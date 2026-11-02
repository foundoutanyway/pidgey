// Copy buttons for the page "Commission a Picture Properly": one on the sample prompt, and one on
// each call in its tables, so a human can hand a call to their agent. Nothing here changes the words.
(function () {
  var root = document.querySelector('.commission');
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

  function button(label, get) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'copy';
    b.textContent = label;
    b.addEventListener('click', function () {
      put(get()).then(function () { b.textContent = 'Copied'; }, function () { b.textContent = 'Select it and copy by hand'; })
        .then(function () { setTimeout(function () { b.textContent = label; }, 1600); });
    });
    return b;
  }

  Array.prototype.forEach.call(root.querySelectorAll('.prompt pre'), function (pre) {
    pre.parentNode.insertBefore(button('Copy the prompt', function () { return pre.textContent; }), pre);
  });

  Array.prototype.forEach.call(root.querySelectorAll('td code.call'), function (code) {
    var text = code.textContent;
    code.parentNode.appendChild(button('Copy', function () { return text; }));
  });
})();
