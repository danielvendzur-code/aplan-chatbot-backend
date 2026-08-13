# Aplan Asistent — produkčný checklist

Tento dokument popisuje aktuálny stav nasadenej verzie. Produkčný embed používa `embed.js` → `widget-runtime.html` → pôvodný `widget.html` + `production-upgrade.js`. Serverless API je vo `api/`.

## ✅ Hotové a zapojené

- Otvorenie/zatvorenie widgetu, launcher, teaser a mobilný fullscreen režim.
- Pevné navigačné flow pre stavebné povolenie, ohlásenie, kolaudáciu a zmenu/prístavbu.
- AI odpovede cez Anthropic API (`api/chat.js`).
- AI model `claude-sonnet-4-6` s nízkym effortom pre rýchly webový chat.
- História v `localStorage` aj serverová história cez KV.
- Reálny formulár dopytu cez `/api/lead`.
- Ukladanie leadov do KV.
- Odosielanie leadov cez Gmail SMTP.
- Technický odosielateľ má default `dopyt.chatbot@gmail.com`; heslo sa nikdy neukladá v repozitári, ale iba ako `GMAIL_APP_PASSWORD` vo Verceli.
- `MAIL_TO` určuje skutočného príjemcu dopytov v Aplane.
- Reálne klientské e-mailové zhrnutie AI konverzácie.
- Reálne odoslanie Projektového štartovacieho balíka na klientsky e-mail cez existujúci `/api/lead`.
- Úspech klientského e-mailu sa zobrazuje iba po potvrdení backendu; čiastočné zlyhanie sa klientovi nezobrazuje ako úspech.
- Reálne prílohy k dopytu:
  - max. 3 súbory,
  - PDF, JPG/JPEG, PNG, WebP,
  - frontend akceptuje aj HEIC/HEIF a pokúsi sa ich previesť na JPEG,
  - veľké fotografie sa zmenšia približne na max. 1600 px a JPEG kvalitu 0,82,
  - backend znovu kontroluje MIME typ, Base64, počet a veľkosť,
  - obsah súborov sa neukladá do KV; ukladá sa iba názov, MIME typ a veľkosť,
  - prílohy sa posielajú Aplanu priamo ako MIME attachments v e-maile.
- Reálny Calendly inline embed cez `CFG.calendly`.
- Po udalosti `calendly.event_scheduled` widget zobrazí potvrdenie rezervácie.
- Generátor správ na úrad/obec.
- Checklist dokumentov.
- Rýchle kontakty: telefón, WhatsApp a dopyt.
- GDPR checkbox pri dopytoch, balíku a e-mailovom zhrnutí.
- Distribuovaný anti-abuse rate limiting cez KV s in-memory fallbackom:
  - AI chat: 30 požiadaviek / 10 minút / IP,
  - dopyty: 5 požiadaviek / hodinu / IP,
  - história: 180 zápisov / hodinu / IP.
- Limity veľkosti requestov na verejných API endpointoch.
- Admin prístup bez kľúča v URL; povolené sú iba `Authorization: Bearer <ADMIN_KEY>` a `X-Admin-Key: <ADMIN_KEY>`.
- Timing-safe porovnanie admin kľúča.

## ⚠️ Jediná externá vec pred finálnym odovzdaním

### Calendly musí patriť Aplanu

Aktuálny `CFG.calendly` stále smeruje na dočasný Calendly účet. Majiteľ Aplanu musí poslať vlastný booking link po prepojení svojho pracovného Google/Outlook kalendára.

Pošle napríklad:

`https://calendly.com/aplan/konzultacia`

Potom sa zmení iba `CFG.calendly` v `widget.html`.

## 🔐 Produkčné environment variables

Vo Verceli majú byť nastavené minimálne:

- `ANTHROPIC_API_KEY`
- `GMAIL_USER=dopyt.chatbot@gmail.com`
- `GMAIL_APP_PASSWORD` — Google App Password, nie bežné heslo účtu
- `MAIL_FROM=APLAN AI asistent <dopyt.chatbot@gmail.com>` — voliteľné
- `MAIL_TO` — e-mail Aplanu, kam majú chodiť dopyty a prílohy
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `ADMIN_KEY`
- `RATE_LIMIT_SALT` — odporúčané samostatné náhodné tajomstvo pre hashovanie IP rate-limit kľúčov

Premenné potrebné pre preview nastav aj pre Preview environment.

## 📎 Limity príloh

Frontend:

- max. 3 súbory,
- zdrojová fotografia max. približne 8 MB,
- PDF max. približne 1,5 MB,
- veľké fotografie sa pred odoslaním optimalizujú.

Backend po spracovaní vyžaduje:

- max. 1,5 MB na jednu prílohu,
- max. 2,25 MB spolu,
- povolený finálny MIME typ iba PDF/JPEG/PNG/WebP.

Ak browser nevie dekódovať konkrétny HEIC/HEIF súbor, používateľ dostane chybový stav a môže fotografiu odoslať ako JPG/PNG alebo priamo e-mailom. Pre veľké projektové PDF/DWG súbory treba v budúcnosti použiť objektové úložisko so signed upload URL.

## 🧪 Finálny smoke test

1. Otvoriť `https://aplan-kappa.vercel.app` na desktope a mobile.
2. Poslať bežnú AI otázku a overiť odpoveď Sonnet 4.6.
3. Otestovať pevné úradné flow a návrat do menu.
4. Poslať testovací dopyt bez prílohy a overiť e-mail + KV.
5. Poslať dopyt s JPG/PNG a overiť reálnu prílohu v e-maile Aplanu.
6. Na iPhone otestovať fotografiu z knižnice; pri HEIC overiť konverziu alebo korektnú chybovú správu.
7. Vytvoriť Projektový štartovací balík a poslať ho na testovací klientsky e-mail.
8. Poslať zhrnutie AI konverzácie na klientsky e-mail.
9. Po získaní Aplan Calendly linku dokončiť reálnu rezerváciu a overiť zápis v ich kalendári.
10. Overiť 401 pri admin GET bez hlavičky a úspech s `Authorization: Bearer <ADMIN_KEY>`.
11. Overiť 429 po prekročení rate limitu v testovacom prostredí.

## Poznámka

AI odpovede sú orientačné a nesmú garantovať rozhodnutie úradu, cenu ani termín. Odborné posúdenie zostáva na projektantovi Aplanu.
