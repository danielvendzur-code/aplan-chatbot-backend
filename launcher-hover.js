(function () {
  'use strict';

  var launch = document.getElementById('ai-launch');
  if (!launch || window.parent === window) return;

  function notify(show) {
    try {
      window.parent.postMessage({ aplan: 'launcher-preview', show: !!show }, '*');
    } catch (e) {}
  }

  launch.addEventListener('mouseenter', function () { notify(true); });
  launch.addEventListener('mouseleave', function () { notify(false); });
  launch.addEventListener('focus', function () { notify(true); });
  launch.addEventListener('blur', function () { notify(false); });
  launch.addEventListener('click', function () { notify(false); });
})();
