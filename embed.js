/* Aplan Asistent — embed skript.
   Vloženie na web (jeden riadok):
   <script src="https://aplan-kappa.vercel.app/embed.js?v=20260817-1" defer></script>
   Widget beží v izolovanom iframe — nekoliduje so štýlmi stránky. */
(function () {
  if (window.__aplanEmbedLoaded) return;
  window.__aplanEmbedLoaded = true;

  var base = 'https://aplan-kappa.vercel.app';
  try {
    var cs = document.currentScript;
    if (cs && cs.src) base = new URL(cs.src).origin;
  } catch (e) {}

  var VER = '20260817-1';
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
      '#aplan-launch-preview{box-sizing:border-box;position:fixed;right:104px;bottom:28px;z-index:2147482999;width:min(318px,calc(100vw - 136px));padding:13px 15px 14px;background:#fff;border:1px solid rgba(20,20,20,.14);border-radius:12px;box-shadow:0 14px 36px rgba(20,20,20,.12);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#141414;opacity:0;transform:translateX(8px) scale(.985);transform-origin:right center;pointer-events:none;visibility:hidden;transition:opacity .18s ease,transform .22s cubic-bezier(.2,.8,.2,1),visibility .18s ease}',
      '#aplan-launch-preview.show{opacity:1;transform:none;visibility:visible}',
      '#aplan-launch-preview:after{content:"";position:absolute;right:-6px;top:50%;width:10px;height:10px;background:#fff;border-top:1px solid rgba(20,20,20,.14);border-right:1px solid rgba(20,20,20,.14);transform:translateY(-50%) rotate(45deg)}',
      '#aplan-launch-preview .aplan-preview-kicker{font-size:9.5px;line-height:1.2;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#6e6e66;margin-bottom:6px}',
      '#aplan-launch-preview .aplan-preview-copy{font-size:13px;line-height:1.48;font-weight:650;letter-spacing:-.01em;color:#16181c}',
      '@media(max-width:520px),(hover:none){#aplan-launch-preview{display:none!important}}'
    ].join('');
    document.head.appendChild(style);

    preview = document.createElement('div');
    preview.id = 'aplan-launch-preview';
    preview.setAttribute('aria-hidden', 'true');
    preview.innerHTML = '<div class="aplan-preview-kicker">APLAN ASISTENT</div><div class="aplan-preview-copy">Riešite stavbu alebo povoľovanie? Zistite ďalší postup a potrebné podklady.</div>';
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
