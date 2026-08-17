/* Aplan Asistent — embed skript.
   Vloženie na web (jeden riadok):
   <script src="https://aplan-kappa.vercel.app/embed.js?v=20260817-2" defer></script>
   Widget beží v izolovanom iframe — nekoliduje so štýlmi stránky. */
(function () {
  if (window.__aplanEmbedLoaded) return;
  window.__aplanEmbedLoaded = true;

  var base = 'https://aplan-kappa.vercel.app';
  try {
    var cs = document.currentScript;
    if (cs && cs.src) base = new URL(cs.src).origin;
  } catch (e) {}

  var VER = '20260817-2';
  var f = document.createElement('iframe');
  f.src = base + '/widget-runtime.html?v=' + VER;
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

  var preview = null;
  var mode = 'launcher';

  function isMobile() {
    return window.matchMedia('(max-width:520px)').matches;
  }

  function ensurePreview() {
    if (preview) return preview;

    var style = document.createElement('style');
    style.textContent = [
      '#aplan-launch-preview{box-sizing:border-box;position:fixed;right:24px;bottom:108px;z-index:2147482999;width:min(300px,calc(100vw - 40px));padding:15px 16px 14px;background:rgba(255,255,255,.985);border:1px solid rgba(22,24,28,.10);border-radius:16px;box-shadow:0 18px 50px rgba(22,24,28,.13),0 2px 8px rgba(22,24,28,.05);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#16181c;opacity:0;transform:translateY(8px) scale(.985);transform-origin:bottom right;pointer-events:none;visibility:hidden;transition:opacity .17s ease,transform .22s cubic-bezier(.2,.8,.2,1),visibility .17s ease;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}',
      '#aplan-launch-preview.show{opacity:1;transform:none;visibility:visible}',
      '#aplan-launch-preview:after{content:"";position:absolute;right:29px;bottom:-6px;width:11px;height:11px;background:#fff;border-right:1px solid rgba(22,24,28,.10);border-bottom:1px solid rgba(22,24,28,.10);transform:rotate(45deg);border-radius:0 0 2px 0}',
      '#aplan-launch-preview .aplan-preview-kicker{display:flex;align-items:center;gap:7px;font-size:9px;line-height:1.2;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:#77776f;margin-bottom:7px}',
      '#aplan-launch-preview .aplan-preview-kicker:before{content:"";width:6px;height:6px;border-radius:50%;background:#16181c;flex:0 0 auto}',
      '#aplan-launch-preview .aplan-preview-title{font-size:13.5px;line-height:1.35;font-weight:750;letter-spacing:-.018em;color:#16181c}',
      '#aplan-launch-preview .aplan-preview-copy{margin-top:4px;font-size:11.5px;line-height:1.48;font-weight:520;letter-spacing:-.005em;color:#6e6e66}',
      '@media(max-width:520px),(hover:none){#aplan-launch-preview{display:none!important}}'
    ].join('');
    document.head.appendChild(style);

    preview = document.createElement('div');
    preview.id = 'aplan-launch-preview';
    preview.setAttribute('aria-hidden', 'true');
    preview.innerHTML = '<div class="aplan-preview-kicker">APLAN ASISTENT</div><div class="aplan-preview-title">Riešite stavbu alebo povolenie?</div><div class="aplan-preview-copy">Zistite ďalší postup, potrebné podklady alebo si rezervujte konzultáciu.</div>';
    document.body.appendChild(preview);
    return preview;
  }

  function setPreview(show) {
    var p = ensurePreview();
    var visible = !!show && mode === 'launcher' && !isMobile();
    p.classList.toggle('show', visible);
  }

  function apply() {
    if (mode === 'open') {
      setPreview(false);
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
    } else {
      st.width = '120px';
      st.height = '120px';
    }
    document.documentElement.style.overflow = (mode === 'open' && isMobile()) ? 'hidden' : '';
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== base) return;
    var d = e.data;
    if (!d) return;

    if (d.aplan === 'size') {
      mode = (d.mode === 'open' || d.mode === 'open-mobile') ? 'open' : 'launcher';
      apply();
      return;
    }

    if (d.aplan === 'launcher-preview') {
      setPreview(d.show === true);
    }
  });

  function sendEnv() {
    try { f.contentWindow.postMessage({ aplanEnv: 1, mobile: isMobile() }, base); } catch (e) {}
  }

  f.addEventListener('load', function () { sendEnv(); apply(); });
  window.addEventListener('resize', function () { setPreview(false); sendEnv(); apply(); });

  function mount() {
    ensurePreview();
    document.body.appendChild(f);
    apply();
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
