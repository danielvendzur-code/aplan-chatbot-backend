# Aplan Asistent — produkčný checklist

Tento dokument popisuje aktuálny stav nasadenej verzie. Hlavný widget je v `widget.html`, embed skript v `embed.js` a serverless API vo `api/`.

## ✅ Hotové a zapojené

- Otvorenie/zatvorenie widgetu, launcher, teaser a mobilný fullscreen režim.
- Pevné navigačné flow pre stavebné povolenie, ohlásenie, kolaudáciu a zmenu/prístavbu.
- AI odpovede cez Anthropic API (`api/chat.js`).
- Aktuálny AI model: `claude-sonnet-4-6` s nízkym effortom pre rýchly webový chat.
- História konverzácie v `localStorage` a serverová história cez KV (`api/history.js`).
- Reálny formulár dopytu cez `api/lead.js`.
- Ukladanie leadov do KV.
- Odosielanie leadov cez Gmail SMTP.
- Možnosť poslať klientovi zhrnutie AI konverzácie e-mailom.
- Reálny Calendly inline embed cez `CFG.calendly`.
- Po udalosti `calendly.event_scheduled` widget zobrazí potvrdenie rezervácie.
- Generátor správ na úrad/obec.
- Checklist dokumentov.
- Projektový štartovací balík ako interaktívny výstup v chate.
- Rýchle kontakty: telefón, WhatsApp a dopyt.
- GDPR checkbox pri dopytoch a e-mailovom zhrnutí.
- Distribuovaný anti-abuse rate limiting cez KV s in-memory fallbackom:
  - AI chat: 30 požiadaviek / 10 minút / IP,
  - dopyty: 5 požiadaviek / hodinu / IP,
  - história: 180 zápisov / hodinu / IP.
- Limity veľkosti requestov na verejných API endpointoch.
- Admin prístup bez kľúča v URL. Podporované sú iba:
  - `Authorization: Bearer <ADMIN_KEY>`,
  - `X-Admin-Key: <ADMIN_KEY>`.
- Timing-safe porovnanie admin kľúča.

## ⚠️ Ešte treba dokončiť pred finálnym odovzdaním

### 1. Calendly musí patriť Aplanu

Aktuálne je v `CFG.calendly` vložený dočasný Calendly link. Majiteľ Aplanu musí vytvoriť alebo použiť vlastný Calendly účet, pripojiť svoj pracovný Google/Outlook kalendár a vytvoriť typ stretnutia.

Pošle iba finálny booking link, napríklad:

`https://calendly.com/aplan/konzultacia`

Potom sa v `widget.html` zmení iba hodnota `CFG.calendly`.

### 2. Projektový štartovací balík — e-mail

Tlačidlo „Odoslať balík na e-mail“ ešte nesmie tvrdiť, že bol e-mail odoslaný, pokiaľ neprebehne reálne API volanie.

Odporúčané dokončenie:

1. Vygenerovať textový súhrn balíka vo fronte.
2. Overiť e-mail klienta a GDPR súhlas.
3. Zavolať existujúci `/api/lead` s:
   - `clientCopy: true`,
   - `summary: <obsah balíka>`,
   - predmetom `Projektový štartovací balík`.
4. Backend pošle kópiu klientovi a informáciu Aplanu.
5. Úspešnú hlášku zobraziť až po HTTP 200.
6. Pri chybe zobraziť retry a priamy kontakt na Aplan.

Tým sa využije existujúca mailová infraštruktúra a netreba nový provider.

### 3. Prílohy k dopytu

Aktuálne tlačidlo príloh je iba UI a súbory reálne neposiela.

Odporúčané produkčné riešenie bez samostatného cloud storage:

- reálny `<input type="file" multiple>`,
- povoliť iba PDF, JPG/JPEG, PNG a WebP,
- maximálne 3 súbory,
- limit približne 2–2,5 MB spolu pred Base64 kódovaním,
- frontend prevedie súbory na Base64 a pošle ich v JSON do `/api/lead`,
- backend striktne skontroluje MIME typ, názov, počet aj veľkosť,
- prílohy sa nepridávajú do KV ani histórie,
- backend ich priloží iba do e-mailu Aplanu cez MIME `multipart/mixed`,
- pri prekročení limitu frontend okamžite vysvetlí používateľovi, že väčšie podklady môže poslať e-mailom.

Ak sa neskôr budú posielať veľké projektové PDF/DWG súbory, treba prejsť na objektové úložisko s krátkodobými signed upload URL namiesto Base64 cez serverless request.

## 🔐 Produkčné environment variables

Vo Verceli majú byť nastavené minimálne:

- `ANTHROPIC_API_KEY`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `MAIL_TO`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `ADMIN_KEY`
- `RATE_LIMIT_SALT` — odporúčané samostatné náhodné tajomstvo pre hashovanie IP rate-limit kľúčov

Premenné potrebné pre preview nastav aj pre Preview environment.

## 🧪 Finálny smoke test

1. Otvoriť widget na desktope a mobile.
2. Poslať bežnú AI otázku a overiť odpoveď Sonnet 4.6.
3. Otestovať pevné úradné flow a návrat do menu.
4. Poslať testovací dopyt a overiť doručenie e-mailu aj záznam v KV.
5. Poslať zhrnutie AI konverzácie na klientsky e-mail.
6. Otvoriť Calendly, vybrať reálny voľný termín a dokončiť rezerváciu.
7. Overiť, že rezervácia vznikla v kalendári majiteľa Aplanu a že sa blokovaný čas už neponúka.
8. Overiť 401 pri admin GET bez hlavičky.
9. Overiť admin GET s `Authorization: Bearer <ADMIN_KEY>`.
10. Overiť 429 po prekročení rate limitu v testovacom prostredí.

## Poznámka

AI odpovede sú orientačné a nesmú garantovať rozhodnutie úradu, cenu ani termín. Odborné posúdenie zostáva na projektantovi Aplanu.
