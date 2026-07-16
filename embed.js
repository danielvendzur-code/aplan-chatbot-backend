/* Aplan Asistent — embed skript.
   Vloženie na web (jeden riadok):
   <script src="https://aplan-kappa.vercel.app/embed.js?v=20260712-1" defer></script>
   Widget beží v izolovanom iframe — nekoliduje so štýlmi stránky. */
(function () {
  if (window.__aplanEmbedLoaded) return;
  window.__aplanEmbedLoaded = true;

  var base = 'https://aplan-kappa.vercel.app';
  try {
    var cs = document.currentScript;
    if (cs && cs.src) base = new URL(cs.src).origin;
  } catch (e) {}

  var VER = '20260712-1';
  var f = document.createElement('iframe');
  f.src = base + '/widget.html?v=' + VER;
  f.title = 'Aplan Asistent';
  f.setAttribute('allowtransparency', 'true');
  f.setAttribute('aria-label', 'Aplan Asistent');
  f.allow = 'clipboard-write';

  var st = f.style;
  st.position = 'fixed';
  st.right = '0';
  st.bottom = '0';
  st.border = '0';
  st.zIndex = '2147483000';
  st.background = 'transparent';
  st.colorScheme = 'normal';
  st.maxWidth = '100vw';
  st.maxHeight = '100vh';

  function isMobile() {
    return window.matchMedia('(max-width:520px)').matches;
  }

  var mode = 'launcher'; // launcher | teaser | open
  function apply() {
    if (mode === 'open') {
      if (isMobile()) {
        st.width = '100vw';
        st.height = '100vh';
        try { st.height = '100dvh'; } catch (e) {}
        st.maxHeight = '100dvh';
      } else {
        st.width = '564px';
        st.height = Math.min(852, window.innerHeight - 8) + 'px';
        st.maxHeight = '100vh';
      }
    } else if (mode === 'teaser') {
      st.width = '380px';
      st.height = '250px';
    } else {
      st.width = '120px';
      st.height = '120px';
    }
    // zámok scrollu stránky pri otvorenom chate na mobile
    document.documentElement.style.overflow = (mode === 'open' && isMobile()) ? 'hidden' : '';
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== base) return;
    var d = e.data;
    if (d && d.aplan === 'size') {
      mode = (d.mode === 'open' || d.mode === 'open-mobile') ? 'open'
           : (d.mode === 'teaser') ? 'teaser'
           : 'launcher';
      apply();
    }
  });

  function sendEnv() {
    try { f.contentWindow.postMessage({ aplanEnv: 1, mobile: isMobile() }, base); } catch (e) {}
  }
  f.addEventListener('load', function () { sendEnv(); apply(); });
  window.addEventListener('resize', function () { sendEnv(); apply(); });

  function mount() { document.body.appendChild(f); apply(); }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
