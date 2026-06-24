# Aplan AI — produkčný checklist

Widget je jeden samostatný súbor: **`index.html`** (HTML + CSS + JS, bez závislostí).

## ✅ Hotové
- Otvorenie/zatvorenie widgetu, launcher, rotujúci teaser, zamknutie scrollu na mobile.
- Hlavička: **Domov** (menu), **Reštart** (vymaže históriu), **Zavrieť**.
- Úvodné akčné chipy (menu) ako hlavná funkcia.
- **Pevne pripravené postupy** (žiadne generovanie) v dátovej štruktúre `assistantFlows`:
  Stavebné povolenie, Ohlásenie, Kolaudácia, Zmena/prístavba.
- **Rozklikávateľné kroky** s detailom (akordeón), funguje aj po obnove histórie.
- **História konverzácie** v `localStorage` (kľúč `aplan_ai_v1`) — prežije zatvorenie aj reload;
  bezpečné načítanie s fallbackom pri poškodenom stave; tlačidlo reset.
- **Dopyt** a **rezervácia konzultácie**: validácia, GDPR súhlas, stav „Odosielam…",
  úspešná/chybová hláška, ochrana proti dvojitému odoslaniu.
- Kalendár (typ stretnutia → termín → čas → údaje).
- Generátor správ na úrad, checklist dokumentov, pojmy/FAQ (vyhľadávanie).
- Rýchle kontakty (telefón, e-mail, WhatsApp) zo `CFG`.
- Responzívne (mobil = fullscreen, desktop = širší panel).

## ⚙️ Pred ostrým spustením doplniť
1. **Údaje firmy** — v `index.html` objekt `CFG` (hľadaj `const CFG`):
   telefón, `telefonRaw`, `whatsapp`, `email`, `web`, `gdprUrl`, `hodiny`.
2. **Odosielanie dopytov** — nastav `CFG.leadEndpoint` na URL backendu/API.
   - Ak je prázdne → fallback: otvorí klientovi e-mail s predvyplnenými údajmi (reálne doručí firme).
   - Logika je vo funkcii **`sendLead(data)`** — sem napojíš fetch POST, EmailJS alebo iný systém.
3. **Termíny v kalendári** — teraz demo (mesiac jún 2026, generované sloty vo `renderCalDays`).
   Pre ostrú prevádzku napojiť reálny kalendár (Google/Calendly) alebo dynamické voľné termíny.
4. **Reálne kontakty** — over telefón/WhatsApp/e-mail v `CFG`.
5. **GDPR** — `CFG.gdprUrl` musí smerovať na platnú stránku ochrany osobných údajov.

## 🗂️ Kde sa čo upravuje (v `index.html`)
- **Texty/kroky postupov** → objekt `assistantFlows` (`title`, `intro`, `steps[{title, shortText, detailText}]`, `finalNote`).
- **Položky úvodného menu** → funkcia `renderMenu()` (pole `rows`).
- **Odpovede na témy** → objekt `TT` (komunikácia s úradom, podklady, „Čo robí Aplan"…).
- **Pojmy/FAQ/služby** → polia `CATS` a `KB`.
- **Vzory správ na úrad** → objekt `letterDefs`.
- **Kontaktné údaje** → objekt `CFG`.
- **Odosielanie dopytu** → funkcia `sendLead(data)`.
- **História/reset** → `STORE_KEY`, `saveConvo()`, `restoreConvo()`, `aiRestart()`.

## 🧪 Ako otestovať formulár
1. Otvor widget → **Potrebujem konzultáciu** (alebo **Poslať dopyt**).
2. Skús odoslať prázdne → musia sa zvýrazniť povinné polia a vypýtať GDPR.
3. Vyplň meno, telefón, platný e-mail, zaškrtni GDPR → **Odosielam…** → úspešná hláška.
4. Bez `leadEndpoint`: otvorí sa e-mail s predvyplnenými údajmi.
   S `leadEndpoint`: skontroluj, že na backend dôjde JSON s poľami z `sendLead`.
5. Klikni odoslať viackrát rýchlo → nesmie sa odoslať dvakrát.
6. Zavri a znovu otvor widget → konverzácia ostáva. **Reštart** ju vymaže.
7. Otestuj na mobile aj desktope (rozklikávanie krokov, scroll, čitateľnosť).

## ⚠️ Poznámky
- Asistent zámerne **negarantuje** výsledky ani neuvádza presné ceny/lehoty —
  pri neistom formuluje opatrne a odporúča konzultáciu. Tento tón zachovať.
- Odpovede na postupy sú **napevno v kóde** (`assistantFlows`), nie generované —
  aby boli vždy rovnaké a presné.
