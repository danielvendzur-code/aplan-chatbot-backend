(function () {
  'use strict';

  const UP_ALLOWED_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);
  const UP_MAX_FILES = 3;
  const UP_MAX_FILE_BYTES = 1_500_000;
  const UP_MAX_TOTAL_BYTES = 2_250_000;

  const style = document.createElement('style');
  style.textContent = `
    .upload-zone{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:100%;border:1.5px dashed var(--line-2);border-radius:11px;padding:13px 12px;background:var(--soft-2);cursor:pointer;text-align:center;transition:border-color .18s,background .18s,box-shadow .18s}
    .upload-zone:hover,.upload-zone:focus-within{border-color:var(--accent);background:#fff;box-shadow:0 0 0 3px rgba(17,17,17,.06)}
    .upload-zone input{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
    .upload-zone b{font:700 12.5px var(--font);color:var(--ink)}
    .upload-zone small{font:600 10.5px/1.4 var(--font);color:var(--muted)}
    .file-status{margin-top:6px;font:600 10.5px/1.45 var(--font);color:var(--muted);word-break:break-word}
    .file-status.ok{color:var(--ok)}
    .file-status.err{color:var(--hard)}
  `;
  document.head.appendChild(style);

  CFG.leadEmail = CFG.email;

  function upValidateFiles(files) {
    const list = Array.from(files || []);
    if (list.length > UP_MAX_FILES) return { ok: false, message: `Môžete priložiť najviac ${UP_MAX_FILES} súbory.` };
    let total = 0;
    for (const file of list) {
      if (!UP_ALLOWED_TYPES.has(file.type)) {
        return { ok: false, message: `Súbor „${file.name}“ nemá podporovaný formát. Povolené sú PDF, JPG, PNG a WebP.` };
      }
      if (file.size > UP_MAX_FILE_BYTES) {
        return { ok: false, message: `Súbor „${file.name}“ je príliš veľký. Maximum je približne 1,5 MB na súbor.` };
      }
      total += file.size;
    }
    if (total > UP_MAX_TOTAL_BYTES) {
      return { ok: false, message: 'Prílohy sú spolu príliš veľké. Maximum je približne 2,25 MB.' };
    }
    return { ok: true, list, total };
  }

  function upFileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('file_read_failed'));
      reader.onload = () => {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        if (comma < 0) { reject(new Error('file_read_failed')); return; }
        resolve({ name: file.name, type: file.type, content: result.slice(comma + 1) });
      };
      reader.readAsDataURL(file);
    });
  }

  async function upReadAttachments(input) {
    const validation = upValidateFiles(input && input.files);
    if (!validation.ok) throw new Error(validation.message);
    return Promise.all(validation.list.map(upFileToBase64));
  }

  function upUpdateFileStatus(input, status) {
    if (!status) return;
    const validation = upValidateFiles(input.files);
    status.className = 'file-status';
    if (!validation.ok) {
      status.classList.add('err');
      status.textContent = validation.message;
      input.value = '';
      return;
    }
    if (!validation.list.length) {
      status.textContent = 'Bez príloh.';
      return;
    }
    status.classList.add('ok');
    const sizeKb = Math.ceil(validation.total / 1024);
    status.textContent = `${validation.list.length} ${validation.list.length === 1 ? 'súbor' : 'súbory'} · ${sizeKb} kB: ${validation.list.map(f => f.name).join(', ')}`;
  }

  sendLead = async function sendLeadProduction(data) {
    if (CFG.leadEndpoint) {
      const payload = Object.assign({}, data, {
        sessionId: sessionId(),
        page: location.href,
        conversation: convo.slice(-30)
      });
      const r = await fetch(CFG.leadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let response = null;
      try { response = await r.json(); } catch (e) { response = null; }
      if (!r.ok) {
        const err = new Error((response && response.error) || `HTTP ${r.status}`);
        err.status = r.status;
        err.response = response;
        throw err;
      }
      return { via: 'api', data: response || {} };
    }

    const subject = (data.predmet || 'Dopyt z webu') + ' — ' + CFG.firma;
    const bodyText = ['Nový dopyt z webu — ' + CFG.firma, '']
      .concat(Object.keys(data).filter(k => k !== 'attachments').map(k => k + ': ' + data[k]))
      .join('\n');
    window.location.href = `mailto:${CFG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    return { via: 'email', data: {} };
  };

  function upPackageSummary(mailObec, mailAplan) {
    const O = pkg.obec || '[OBEC]';
    const P = pkg.parc || '[PARCELA]';
    const M = pkg.meno || '[MENO]';
    return [
      'Projektový štartovací balík — Aplan',
      '',
      `Zámer: ${pkg.typ || 'neuvedený'}`,
      `Lokalita: ${O}`,
      `Parcelné číslo: ${P}`,
      `Meno: ${M}`,
      `Pozemok: ${pkg.poz || 'neuvedené'}`,
      `Popis: ${pkg.popis || 'neuvedený'}`,
      '',
      '1. Čo pravdepodobne potrebujete',
      'Projektovú dokumentáciu primeranú zámeru a podľa rozsahu ohlásenie alebo stavebné povolenie. Presný rozsah určí projektant po posúdení podkladov.',
      '',
      '2. Dokumenty, ktoré si pripravte',
      '- List vlastníctva',
      '- Katastrálna mapa / parcelné číslo',
      '- Územnoplánovacia informácia z obce',
      '- Fotky pozemku alebo existujúcej stavby',
      '- Predstava o dispozícii a rozsahu',
      '- Informácie o sieťach',
      '',
      '3. Čo zistiť na obci',
      '- Či je pozemok určený na výstavbu',
      '- Regulatívy: odstupy, zastavanosť, výška, tvar strechy',
      '- Možnosti napojenia na siete a prístupová cesta',
      '',
      '4. Otázky pre stavebný úrad',
      '- Postačuje ohlásenie, alebo treba stavebné povolenie?',
      '- Aké vyjadrenia dotknutých orgánov budú potrebné?',
      '- Aký je zoznam povinných príloh k podaniu?',
      '',
      '5. Návrh správy pre obec / stavebný úrad',
      mailObec,
      '',
      '6. Návrh správy pre Aplan',
      mailAplan
    ].join('\n');
  }

  pkgResult = function pkgResultProduction() {
    const O = pkg.obec || '[OBEC]';
    const P = pkg.parc || '[PARCELA]';
    const M = pkg.meno || '[MENO]';
    const mailObec = `Dobrý deň,\n\nchcel by som si overiť možnosti výstavby na pozemku v obci ${O}, parcelné číslo ${P}. Prosím o informáciu, či je pozemok podľa územného plánu určený na výstavbu a aké základné regulatívy sa naň vzťahujú (odstupy, zastavanosť, výška, tvar strechy, napojenie na siete).\n\nĎakujem.\nS pozdravom,\n${M}`;
    const mailAplan = `Dobrý deň,\n\nmám záujem o konzultáciu zámeru: ${pkg.typ} v lokalite ${O}${P !== '[PARCELA]' ? ', parc. č. ' + P : ''}.\nPopis: ${pkg.popis || '[POPIS]'}\nPozemok: ${pkg.poz}.\n\nProsím o orientačné posúdenie a informáciu, aké podklady budete potrebovať.\n\nĎakujem, ${M}`;
    const packageSummary = upPackageSummary(mailObec, mailAplan);

    botMsg(`Hotovo — tu je váš <b>Projektový štartovací balík</b> pre: <b>${esc(pkg.typ)}</b>.`);
    botMsg(`<div class="panel"><div class="panel-h"><span class="pin"></span>1 · Čo pravdepodobne potrebujete</div><div class="panel-b"><div class="sd" style="color:var(--ink-3)">Projektovú dokumentáciu primeranú zámeru a podľa rozsahu ohlášku alebo stavebné povolenie. <b>Orientačne</b> — presne určí projektant po posúdení podkladov.</div></div></div>`);
    botMsg(`<div class="panel"><div class="panel-h"><span class="pin"></span>2 · Dokumenty, ktoré si pripravte</div><div class="panel-b">${miniList(['List vlastníctva','Katastrálna mapa / parcelné číslo','Územnoplánovacia informácia (z obce)','Fotky pozemku alebo existujúcej stavby','Predstava o dispozícii a rozsahu','Informácie o sieťach (voda, elektrina, kanalizácia)'])}</div></div>`);
    botMsg(`<div class="panel"><div class="panel-h"><span class="pin"></span>3 · Čo zistiť na obci</div><div class="panel-b">${miniList(['Či je pozemok určený na výstavbu (územný plán)','Regulatívy: odstupy, zastavanosť, výška, tvar strechy','Možnosti napojenia na siete a prístupová cesta'])}</div></div>`);
    botMsg(`<div class="panel"><div class="panel-h"><span class="pin"></span>4 · Otázky pre stavebný úrad</div><div class="panel-b">${miniList(['Postačuje ohlásenie, alebo treba stavebné povolenie?','Aké vyjadrenia dotknutých orgánov budú potrebné?','Aký je zoznam povinných príloh k podaniu?'])}</div></div>`);
    botMsg('5 · Pripravený e-mail pre <b>obec / stavebný úrad</b>:' + copyBlock(mailObec));
    botMsg('6 · Pripravený e-mail pre <b>Aplan</b> (projektant):' + copyBlock(mailAplan));

    setTimeout(() => {
      const m = botMsg(`<div class="panel"><div class="panel-h"><span class="pin"></span>Uložiť / odoslať balík</div><div class="panel-b" data-pkgsend>
        <div class="field"><label>E-mail, kam balík poslať</label><input data-f="em" type="email" placeholder="vas@email.sk"></div>
        ${gdprField()}
        <button class="btn-go">Odoslať balík na e-mail</button>
        <button class="btn-ghost">Skopírovať celý balík</button></div></div>`, { persist: false });
      const s = m.querySelector('[data-pkgsend]');
      const btn = s.querySelector('.btn-go');
      btn.onclick = async () => {
        if (btn.dataset.busy) return;
        const em = val(s, 'em');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { markBad(s, ['em']); return; }
        if (!s.querySelector('[data-f="gdpr"]').checked) { botMsg('Prosím potvrďte súhlas so spracovaním osobných údajov.'); return; }

        btn.dataset.busy = '1';
        btn.disabled = true;
        const label = btn.textContent;
        btn.textContent = 'Odosielam…';
        try {
          const result = await sendLead({
            predmet: 'Projektový štartovací balík',
            email: em,
            meno: pkg.meno || 'Klient',
            lokalita: pkg.obec || '',
            parcela: pkg.parc || '',
            typ_projektu: pkg.typ || '',
            popis: pkg.popis || 'Klient si vytvoril projektový štartovací balík.',
            gdpr: 'áno',
            clientCopy: true,
            clientSubject: 'Projektový štartovací balík - Aplan',
            clientTitle: 'Váš projektový štartovací balík',
            summary: packageSummary
          });
          m.remove();
          if (result.data && result.data.clientMail && result.data.clientMail.ok === true) {
            botMsg(`<div class="confirm"><div class="ci">Balík bol odoslaný</div><div class="cb">Projektový štartovací balík sme poslali na <b>${esc(em)}</b>. Informáciu o dopyte dostal aj Aplan.</div></div>`);
          } else {
            botMsg(`<div class="confirm err"><div class="ci">Aplan dopyt prijal</div><div class="cb">Klientskú kópiu sa nepodarilo doručiť na <b>${esc(em)}</b>. Balík si môžete skopírovať alebo nám napísať na <a href="mailto:${CFG.email}">${CFG.email}</a>.</div></div>`);
          }
          backMenu();
        } catch (e) {
          btn.disabled = false;
          btn.dataset.busy = '';
          btn.textContent = label;
          botMsg(`<div class="confirm err"><div class="ci">Odoslanie zlyhalo</div><div class="cb">Skúste to prosím znova, alebo nám napíšte na <a href="mailto:${CFG.email}">${CFG.email}</a>.</div></div>`);
        }
      };
      s.querySelector('.btn-ghost').onclick = () => {
        if (navigator.clipboard) navigator.clipboard.writeText(packageSummary);
        botMsg('Balík bol skopírovaný do schránky.');
      };
    }, 400);
  };

  flowLead = function flowLeadProduction() {
    botMsg('Pripravím <b>dopyt pre Aplan</b>. Na základe údajov vás vieme lepšie nasmerovať a pripraviť prvotnú konzultáciu.');
    const m = botMsg(`<div class="panel"><div class="panel-h"><span class="pin"></span>Dopyt — kontakt a zámer</div><div class="panel-b" data-lead>
      <div class="row2"><div class="field"><label>Meno *</label><input data-f="meno" placeholder="Meno Priezvisko"></div>
      <div class="field"><label>Telefón *</label><input data-f="tel" placeholder="+421…"></div></div>
      <div class="field"><label>E-mail *</label><input data-f="em" type="email" placeholder="vas@email.sk"></div>
      <div class="field"><label>Lokalita stavby</label><input data-f="lok" placeholder="obec / mesto"></div>
      <div class="row2"><div class="field"><label>Typ projektu</label><select data-f="typ"><option>Nový rodinný dom</option><option>Rekonštrukcia</option><option>Prístavba / nadstavba</option><option>Menšia stavba</option><option>Legalizácia</option><option>Neviem / poradiť</option></select></div>
      <div class="field"><label>Máte pozemok?</label><select data-f="poz"><option>Áno</option><option>Riešim kúpu</option><option>Nie</option></select></div></div>
      <div class="field"><label>Parcelné číslo (ak máte)</label><input data-f="parc" placeholder="napr. 1234/5"></div>
      <div class="row2"><div class="field"><label>Komunikovali ste s úradom?</label><select data-f="urad"><option>Nie</option><option>Áno</option></select></div>
      <div class="field"><label>Časový plán</label><select data-f="cas"><option>Čo najskôr</option><option>Do pol roka</option><option>Tento rok</option><option>Zatiaľ zisťujem</option></select></div></div>
      <div class="field"><label>Stará dokumentácia?</label><select data-f="dok"><option>Nemám</option><option>Mám čiastočne</option><option>Mám</option></select></div>
      <div class="field"><label>Krátky popis zámeru</label><textarea data-f="popis" placeholder="Čo plánujete…"></textarea></div>
      <div class="field"><label>Prílohy (voliteľné)</label>
        <label class="upload-zone"><input data-f="files" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp"><b>Priložiť foto alebo dokumenty</b><small>PDF, JPG, PNG alebo WebP · max. 3 súbory · spolu do 2,25 MB</small></label>
        <div class="file-status" data-file-status>Bez príloh.</div>
      </div>
      ${gdprField()}
      <button class="btn-go">Pripraviť a odoslať dopyt</button></div></div>`, { persist: false });

    const p = m.querySelector('[data-lead]');
    const btn = p.querySelector('.btn-go');
    const fileInput = p.querySelector('[data-f="files"]');
    const fileStatus = p.querySelector('[data-file-status]');
    fileInput.addEventListener('change', () => upUpdateFileStatus(fileInput, fileStatus));

    btn.onclick = async () => {
      if (btn.dataset.busy) return;
      const meno = val(p, 'meno');
      const tel = val(p, 'tel');
      const em = val(p, 'em');
      const bad = [];
      if (!meno) bad.push('meno');
      if (!tel) bad.push('tel');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) bad.push('em');
      if (bad.length) { markBad(p, bad); botMsg('Prosím vyplňte meno, telefón a platný e-mail.'); return; }
      if (!p.querySelector('[data-f="gdpr"]').checked) { botMsg('Prosím potvrďte súhlas so spracovaním osobných údajov.'); return; }

      const validation = upValidateFiles(fileInput.files);
      if (!validation.ok) { upUpdateFileStatus(fileInput, fileStatus); return; }

      btn.dataset.busy = '1';
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = 'Odosielam…';
      try {
        const attachments = await upReadAttachments(fileInput);
        const data = {
          predmet: 'Dopyt z webu',
          meno,
          telefon: tel,
          email: em,
          lokalita: val(p, 'lok'),
          typ_projektu: val(p, 'typ'),
          pozemok: val(p, 'poz'),
          parcela: val(p, 'parc'),
          komunikacia_urad: val(p, 'urad'),
          casovy_plan: val(p, 'cas'),
          dokumentacia: val(p, 'dok'),
          popis: val(p, 'popis'),
          gdpr: 'áno',
          attachments
        };
        await sendLead(data);
        m.remove();
        botMsg(`<div class="confirm"><div class="ci">Ďakujeme, ${esc(meno)}!</div><div class="cb">Dopyt sme prijali${attachments.length ? ' aj s prílohami' : ''}. Na základe údajov vás nasmerujeme a pripravíme prvotnú konzultáciu.</div></div>`);
        backMenu();
      } catch (e) {
        btn.disabled = false;
        btn.dataset.busy = '';
        btn.textContent = label;
        const message = e && e.message === 'payload_too_large'
          ? 'Prílohy sú príliš veľké. Skúste menšie súbory alebo ich pošlite priamo e-mailom.'
          : 'Mrzí nás to. Skúste to prosím znova, alebo nás kontaktujte priamo e-mailom.';
        botMsg(`<div class="confirm err"><div class="ci">Odoslanie zlyhalo</div><div class="cb">${message} <a href="mailto:${CFG.email}">${CFG.email}</a></div></div>`);
      }
    };
  };

  emailSummary = function emailSummaryProduction() {
    if (aiHistory.length < 2) {
      botMsg('Najprv sa ma niečo spýtajte — potom vám celé zhrnutie pošlem na e-mail.');
      setTimeout(() => chipRow([RESV, { t: 'Hlavné menu', fn: menu }]), 150);
      return;
    }
    const m = botMsg(`<div class="panel"><div class="panel-h"><span class="pin"></span>Poslať zhrnutie na e-mail</div><div class="panel-b" data-sum>
      <div class="field"><label>Váš e-mail</label><input data-f="em" type="email" placeholder="vas@email.sk"></div>
      ${gdprField()}
      <button class="btn-go">Poslať zhrnutie</button></div></div>`, { persist: false });
    const p = m.querySelector('[data-sum]');
    const btn = p.querySelector('.btn-go');
    btn.onclick = async () => {
      if (btn.dataset.busy) return;
      const em = val(p, 'em');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { markBad(p, ['em']); return; }
      if (!p.querySelector('[data-f="gdpr"]').checked) { botMsg('Prosím potvrďte súhlas so spracovaním osobných údajov.'); return; }
      btn.dataset.busy = '1';
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = 'Odosielam…';
      try {
        const result = await sendLead({
          predmet: 'Zhrnutie konzultácie (klient)',
          email: em,
          meno: 'Zhrnutie pre klienta',
          popis: 'Klient si vyžiadal zhrnutie konverzácie.',
          clientCopy: true,
          clientSubject: 'Zhrnutie konzultácie - Aplan',
          clientTitle: 'Zhrnutie vašej konzultácie',
          summary: buildSummary()
        });
        m.remove();
        if (result.data && result.data.clientMail && result.data.clientMail.ok === true) {
          botMsg(`<div class="confirm"><div class="ci">Odoslané ✓</div><div class="cb">Zhrnutie sme poslali na <b>${esc(em)}</b>. Informáciu má aj Aplan.</div></div>`);
        } else {
          botMsg(`<div class="confirm err"><div class="ci">Aplan informáciu prijal</div><div class="cb">Klientskú kópiu sa nepodarilo doručiť na <b>${esc(em)}</b>. Napíšte nám prosím na <a href="mailto:${CFG.email}">${CFG.email}</a>.</div></div>`);
        }
        backMenu();
      } catch (e) {
        btn.disabled = false;
        btn.dataset.busy = '';
        btn.textContent = label;
        botMsg(`<div class="confirm err"><div class="ci">Nepodarilo sa odoslať</div><div class="cb">Skúste to prosím znova, alebo nám napíšte na <a href="mailto:${CFG.email}">${CFG.email}</a>.</div></div>`);
      }
    };
  };

  if (typeof renderFoot === 'function') renderFoot();
})();
