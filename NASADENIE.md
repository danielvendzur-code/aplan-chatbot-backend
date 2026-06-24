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

Dočasne nastavené na **teba**: `CFG.leadEmail = 'daniel.vendzur@gmail.com'`.
Po odoslaní formulára sa otvorí e-mail predvyplnený na túto adresu.

Až to bude pre firmu naostro:
- zmeň `leadEmail` na e-mail Aplanu, **alebo**
- nasaď backend a nastav `CFG.leadEndpoint` (napr. ďalšia Vercel funkcia
  `api/lead.js` + e-mailová služba ako Resend) — funkcia `sendLead(data)`
  v `index.html` je na to pripravená (POST JSON na endpoint).

## 4. Zhrnutie premenných na vyplnenie
- `ANTHROPIC_API_KEY` — vo Vercel env (AI).
- `CFG.chatEndpoint` — `/api/chat` (alebo absolútna URL pri cudzej doméne).
- `CFG.calendly` — odkaz na Calendly (alebo prázdne = demo kalendár).
- `CFG.leadEmail` — kam chodia dopyty (teraz tvoj e-mail).
- `CFG.telefon/email/...` — kontakty firmy zobrazené v asistentovi.
