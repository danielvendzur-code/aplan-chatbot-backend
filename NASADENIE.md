# Aplan Asistent — nasadenie na Vercel

Aktuálna produkčná verzia používa Vercel serverless API, Anthropic Claude, KV úložisko, Gmail SMTP a Calendly.

## 1. Vercel

Repo nasaď ako Vercel projekt s Framework Preset `Other`.

Produkčný embed:

- `/embed.js`
- `/widget-runtime.html`
- pôvodný UI widget `/widget.html`
- produkčné rozšírenia `/production-upgrade.js`

API endpointy:

- `/api/chat` — AI odpovede,
- `/api/lead` — dopyty, prílohy, balíky a klientské e-maily,
- `/api/history` — serverová história konverzácií.

## 2. Environment variables

Vo Verceli nastav:

- `ANTHROPIC_API_KEY`
- `GMAIL_USER=dopyt.chatbot@gmail.com`
- `GMAIL_APP_PASSWORD=<Google App Password>`
- `MAIL_FROM=APLAN AI asistent <dopyt.chatbot@gmail.com>` — voliteľné
- `MAIL_TO=<e-mail Aplanu pre dopyty>`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `ADMIN_KEY`
- `RATE_LIMIT_SALT` — odporúčané samostatné náhodné tajomstvo

`GMAIL_APP_PASSWORD` nesmie byť bežné heslo Gmail účtu a nesmie sa commitnúť do repozitára. Patrí iba do Vercel Environment Variables.

Ak používaš Preview deployments, nastav potrebné premenné aj pre Preview.

## 3. Gmail SMTP

Backend používa `smtp.gmail.com:465` cez TLS.

Technický odosielateľ:

`dopyt.chatbot@gmail.com`

Ak `GMAIL_USER` nie je nastavený, backend používa túto adresu ako default. Bez `GMAIL_APP_PASSWORD` však odosielanie zámerne zlyhá — heslo nie je a nebude v kóde.

`MAIL_TO` určuje, kam Aplanu prídu:

- bežné dopyty,
- dopyty s fotografiami/PDF,
- informácia o vygenerovanom projektovom balíku,
- informácia o klientskom zhrnutí.

Klientské kópie sa posielajú na e-mail zadaný klientom. `Reply-To` smeruje na Aplan, aby odpoveď klienta nešla na technický Gmail.

## 4. AI

`api/chat.js` volá Anthropic Messages API.

Aktuálny model:

`claude-sonnet-4-6`

Ochrana AI endpointu:

- max. 30 požiadaviek / 10 minút / IP,
- request body max. 100 kB,
- rate limit v KV s in-memory fallbackom.

## 5. Dopyty, balíky a prílohy

`api/lead.js`:

1. validuje kontakt,
2. validuje prílohy,
3. uloží lead a iba metadata príloh do KV,
4. pošle firemný e-mail cez Gmail SMTP,
5. prílohy vloží priamo do e-mailu ako MIME attachments,
6. podľa potreby pošle klientovi zhrnutie alebo Projektový štartovací balík.

Ochrana:

- max. 5 POST dopytov / hodinu / IP,
- request body max. 3,5 MB,
- max. 3 prílohy,
- max. 1,5 MB na finálnu prílohu,
- max. 2,25 MB finálnych príloh spolu,
- backend prijíma finálne PDF/JPEG/PNG/WebP.

Frontend vie pred odoslaním zmenšiť väčšiu fotografiu a previesť ju na JPEG. Pri HEIC/HEIF sa konverzia vykoná iba v browseri, ktorý daný formát dokáže dekódovať.

## 6. História

`api/history.js` ukladá konverzácie do KV.

Ochrana:

- max. 180 zápisov / hodinu / IP,
- request body max. 600 kB.

## 7. Admin prístup

Admin kľúč sa nesmie posielať v query stringu URL.

Použi:

```bash
curl -s https://aplan-kappa.vercel.app/api/history \
  -H "Authorization: Bearer $ADMIN_KEY"
```

alebo:

```bash
curl -s https://aplan-kappa.vercel.app/api/lead \
  -H "X-Admin-Key: $ADMIN_KEY"
```

Voliteľný parameter `limit` môže zostať v URL:

```bash
curl -s "https://aplan-kappa.vercel.app/api/lead?limit=25" \
  -H "Authorization: Bearer $ADMIN_KEY"
```

## 8. Calendly

Widget používa reálny inline Calendly embed cez `CFG.calendly` v `widget.html`.

Aktuálny link je dočasný. Pred finálnym vložením na web musí majiteľ Aplanu:

1. vytvoriť alebo použiť vlastný Calendly účet,
2. pripojiť pracovný Google/Outlook kalendár,
3. nastaviť kalendáre kontrolované kvôli konfliktom,
4. nastaviť kalendár pre nové rezervácie,
5. vytvoriť event type, napr. `30-minútová konzultácia`,
6. nastaviť dostupnosť,
7. poslať finálny booking link.

Potom zmeň v `widget.html`:

```js
calendly: 'https://calendly.com/APLAN/konzultacia'
```

## 9. Embed na web Aplan

Aktuálna cache-bust verzia:

```html
<script src="https://aplan-kappa.vercel.app/embed.js?v=20260813-4" defer></script>
```

Widget beží v izolovanom iframe a nekoliduje so štýlmi hostiteľskej stránky.

## 10. Pred finálnym odovzdaním

Kódovo sú dopyty, klientské e-maily, Projektový štartovací balík aj prílohy zapojené. Z externých závislostí treba:

1. nastaviť Gmail App Password vo Verceli,
2. nastaviť správne `MAIL_TO`,
3. urobiť testovací dopyt s fotografiou a testovací klientsky e-mail,
4. po získaní Aplan Calendly linku vymeniť dočasný link a otestovať reálnu rezerváciu.
