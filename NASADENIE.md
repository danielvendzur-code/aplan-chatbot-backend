# Nasadenie — Vercel (AI), Calendly, dopyty

## 1. Vercel — aby asistent reálne odpovedal (AI)

AI beží cez serverless funkciu `api/chat.js`, ktorá volá Claude API. Kľúč je
v premennej prostredia, **nikdy nie je v kóde stránky** (bezpečné).

Kroky:
1. **Importuj repo do Vercelu** — vercel.com → Add New → Project → vyber tento
   GitHub repozitár. Framework Preset: **Other** (statická stránka). Build
   command nechaj prázdny, Output dir = root.
2. **Pridaj API kľúč** — Project → Settings → Environment Variables:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...` (tvoj kľúč z console.anthropic.com)
   - Environment: Production (a pokojne aj Preview)
3. **Deploy** (alebo Redeploy po pridaní kľúča).
4. Hotovo. Stránka beží na `https://tvoj-projekt.vercel.app`, asistent odpovedá
   cez `https://tvoj-projekt.vercel.app/api/chat`.

Overenie funkcie (po deploy):
```
curl -s https://tvoj-projekt.vercel.app/api/chat \
  -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"Čo je ohlásenie drobnej stavby?"}]}'
```
Má vrátiť `{"reply":"..."}`.

## Preview AI verzia — link, ktorý môžeš poslať ľuďom

Kód už je pripravený na AI preview, lebo `index.html` volá relatívne endpointy:
- `/api/chat` — AI odpovede,
- `/api/lead` — odosielanie dopytov,
- `/api/history` — ukladanie histórie.

Aby Preview na Verceli nepoužíval fallback bez AI, musia byť env premenné zapnuté aj pre **Preview**, nielen Production.

Presný postup:
1. Otvor Vercel projekt pre Aplan.
2. Choď na **Settings → Environment Variables**.
3. Pre každú premennú nastav environment **Production and Preview**:
   - `ANTHROPIC_API_KEY`
   - `GMAIL_USER`
   - `GMAIL_APP_PASSWORD`
   - `MAIL_TO`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `ADMIN_KEY`
4. Ak už premenné existujú iba pre Production, otvor pri nich menu `...` a pridaj ich aj do **Preview**.
5. Choď na **Deployments**.
6. Otvor najnovší deployment alebo klikni **Redeploy**.
7. Po redeploy otvor Preview URL typu:
   `https://aplan-chatbot-backend-git-main-...vercel.app`
   alebo URL z konkrétneho preview deploymentu.
8. Tento Preview link môžeš poslať ľuďom.

Rýchla kontrola preview linku:
1. Otvor Preview URL.
2. Otvor asistenta.
3. Napíš napríklad: `Čo potrebujem pri prístavbe domu?`
4. Ak odpovie prirodzenou AI odpoveďou, funguje `/api/chat`.
5. Skús **Poslať dopyt**. Ak prejde potvrdenie, funguje `/api/lead`.

Admin kontroly po nasadení:
- história: `https://TVOJ-PREVIEW-LINK/api/history?key=ADMIN_KEY`
- dopyty: `https://TVOJ-PREVIEW-LINK/api/lead?key=ADMIN_KEY`

Ak Preview neodpovedá AI:
- skontroluj, či `ANTHROPIC_API_KEY` je aj v **Preview**,
- potom sprav **Redeploy**,
- nepoužívaj GitHub raw/GitHack link, lebo tam endpointy `/api/...` neexistujú.

**Model:** v `api/chat.js` je `MODEL = 'claude-haiku-4-5'` (rýchly a lacný pre web).
Pre maximálnu kvalitu zmeň na `'claude-opus-4-8'` (drahšie).

**Dôležité — odkiaľ sa volá AI:** v `index.html` je `CFG.chatEndpoint = '/api/chat'`.
- Ak je stránka na Verceli, funguje to rovno.
- Ak je widget vložený na **inej doméne** (napr. aplan.sk), nastav
  `chatEndpoint` na **absolútnu** URL: `'https://tvoj-projekt.vercel.app/api/chat'`
  (funkcia má povolené CORS, takže to bude fungovať).
- Cez náhľad (githack) `/api/chat` neexistuje → asistent automaticky spadne na
  vstavané vyhľadávanie (bez AI). Chipy a postupy fungujú stále.

## 2. Calendly — reálna rezervácia (voliteľné)

1. Vytvor si konto na calendly.com a typ stretnutia (napr. „Konzultácia 30 min").
2. Skopíruj odkaz, napr. `https://calendly.com/aplan/konzultacia`.
3. V `index.html` doplň do `CFG`:
   ```
   calendly: 'https://calendly.com/aplan/konzultacia'
   ```
4. Tým sa tlačidlo „Rezervovať konzultáciu" prepne z demo kalendára na reálny
   Calendly (otvorí sa v novom okne). Keď `calendly` necháš prázdne, beží demo.

> Prístup ti dať neviem (Calendly konto si vytvára firma/ty). Stačí mi poslať
> odkaz a vložím ho, alebo ho vložíš sám podľa kroku 3.

## 3. Dopyty a rezervácie — kam chodia

Naostro je pripravený endpoint `CFG.leadEndpoint = '/api/lead'`.
Dopyty odosiela Vercel funkcia `api/lead.js` cez Gmail app password a zároveň ich ukladá do KV.

Vo Verceli nastav:
- `GMAIL_USER` — Gmail adresa odosielateľa.
- `GMAIL_APP_PASSWORD` — app password z Google účtu.
- `MAIL_TO` — kam majú chodiť dopyty.
- `KV_REST_API_URL` a `KV_REST_API_TOKEN` — ukladanie dopytov a histórie.
- `ADMIN_KEY` — kľúč na čítanie uložených dopytov/histórie.

## 4. Zhrnutie premenných na vyplnenie
- `ANTHROPIC_API_KEY` — vo Vercel env (AI).
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_TO` — odosielanie dopytov.
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `ADMIN_KEY` — história a uložené dopyty.
- `CFG.chatEndpoint` — `/api/chat` (alebo absolútna URL pri cudzej doméne).
- `CFG.calendly` — odkaz na Calendly (alebo prázdne = demo kalendár).
- `CFG.telefon/email/...` — kontakty firmy zobrazené v asistentovi.
