# Aplan Asistent — nasadenie na Vercel

Aktuálna produkčná verzia používa Vercel serverless API, Anthropic Claude, KV úložisko, Gmail SMTP a Calendly.

## 1. Vercel

Repo nasaď ako Vercel projekt s Framework Preset `Other`.

Produkčný widget je dostupný cez:

- `/widget.html`
- `/embed.js`

API endpointy:

- `/api/chat` — AI odpovede,
- `/api/lead` — dopyty a klientské e-mailové zhrnutia,
- `/api/history` — serverová história konverzácií.

## 2. Environment variables

Vo Verceli nastav:

- `ANTHROPIC_API_KEY`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `MAIL_TO`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `ADMIN_KEY`
- `RATE_LIMIT_SALT` — odporúčané samostatné náhodné tajomstvo

Ak používaš Preview deployments, nastav potrebné premenné aj pre Preview.

## 3. AI

`api/chat.js` volá Anthropic Messages API.

Aktuálny model:

`claude-sonnet-4-6`

Pre webový chat sa používa nízky effort, aby bola odozva rýchla a stále kvalitná.

AI endpoint má ochranu:

- max. 30 požiadaviek / 10 minút / IP,
- request body max. 100 kB,
- rate limit sa drží v KV; pri dočasnom výpadku KV sa použije in-memory fallback.

## 4. Dopyty a e-mail

`api/lead.js`:

1. validuje kontakt,
2. uloží lead do KV,
3. pošle e-mail cez Gmail SMTP,
4. podľa potreby pošle klientovi kópiu/zhrnutie.

Ochrana:

- max. 5 POST dopytov / hodinu / IP,
- request body max. 100 kB.

`MAIL_TO` určuje, kam chodia firemné dopyty.

## 5. História

`api/history.js` ukladá konverzácie do KV.

Ochrana:

- max. 180 zápisov / hodinu / IP,
- request body max. 600 kB.

## 6. Admin prístup

Admin kľúč sa zámerne NESMIE posielať v query stringu URL.

Použi jednu z hlavičiek:

```bash
curl -s https://aplan-kappa.vercel.app/api/history \
  -H "Authorization: Bearer $ADMIN_KEY"
```

alebo:

```bash
curl -s https://aplan-kappa.vercel.app/api/lead \
  -H "X-Admin-Key: $ADMIN_KEY"
```

Voliteľný parameter `limit` môže zostať v URL, napríklad:

```bash
curl -s "https://aplan-kappa.vercel.app/api/lead?limit=25" \
  -H "Authorization: Bearer $ADMIN_KEY"
```

Admin kľúč sa porovnáva timing-safe spôsobom.

## 7. Calendly

Widget používa reálny inline Calendly embed cez `CFG.calendly` v `widget.html`.

Aktuálny link je dočasný. Pred odovzdaním musí majiteľ Aplanu:

1. vytvoriť alebo použiť vlastný Calendly účet,
2. pripojiť pracovný Google Calendar alebo Microsoft/Outlook kalendár,
3. nastaviť, ktoré kalendáre sa kontrolujú kvôli konfliktom,
4. nastaviť kalendár, do ktorého sa majú nové rezervácie zapisovať,
5. vytvoriť One-on-one event type, napr. `30-minútová konzultácia`,
6. nastaviť dostupnosť, minimálny predstih, prípadne buffer,
7. poslať finálny booking link.

Potom zmeň v `widget.html` iba:

```js
calendly: 'https://calendly.com/APLAN/konzultacia'
```

Po rezervácii Calendly pošle event do pripojeného kalendára a widget zachytí `calendly.event_scheduled`.

## 8. Embed na web Aplan

Na web vlož:

```html
<script src="https://aplan-kappa.vercel.app/embed.js" defer></script>
```

Widget beží v izolovanom iframe a nekoliduje so štýlmi hostiteľskej stránky.

## 9. Pred finálnym odovzdaním

Treba ešte dokončiť dve frontendové funkcie:

- reálne odoslanie Projektového štartovacieho balíka na e-mail cez existujúci `/api/lead`,
- reálne prílohy k dopytu; odporúčaný návrh je popísaný v `PRODUCTION_CHECKLIST.md`.

Po ich dokončení urob kompletný smoke test na desktope a mobile.
