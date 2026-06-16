# Aplan AI — návrh webového asistenta projektovej kancelárie

> Tento dokument je **produktový návrh** asistenta pre web Aplan. Súbor `index.html`
> je k nemu **klikateľná demo ukážka** — všetky odpovede sú scenárované (fake),
> aby ukážka pôsobila ako reálna funkcia. Kalendár, e-maily ani dopyt sa reálne
> neodosielajú.

---

## 1) Hlavná myšlienka asistenta

**Aplan AI nie je „ďalší chatbot".** Je to digitálny pomocník na webe, ktorý
klientovi pomôže **pochopiť, kde začať** — pri projekte, stavebnom povolení,
ohlásení, rekonštrukcii, prístavbe, legalizácii alebo príprave na stavbu.

Kľúčové vymedzenie firmy: **Aplan je projektová kancelária.** Asistent preto
**nikdy netvrdí**, že Aplan vybaví úrad, povolenie alebo komunikáciu s úradmi za
klienta. Asistent vysvetlí postup, pripraví podklady a texty, a jasne ukáže, **čo
si klient rieši sám** a **kde nastupuje projektant**.

Pozícia v jednej vete: *„Zistite, čo k projektu reálne potrebujete — bez
zbytočného telefonovania a googlenia."*

Tón: jednoducho, odborne a ľudsky. Vždy s formuláciami „orientačne",
„pravdepodobne", „závisí od konkrétnej obce a stavebného úradu", „presné
posúdenie je vhodné konzultovať s projektantom". **Nikdy:** „vybavíme vám
povolenie", „garantujeme schválenie", „toto určite stačí", „úrad to musí prijať".

---

## 2) Hlavné funkcie

| # | Funkcia | Čo robí | Stav v deme |
|---|---------|---------|-------------|
| 1 | **Demo kalendár** | Výber typu stretnutia → deň → čas → údaje → predbežná rezervácia | ✅ fake, plne klikateľné |
| 2 | **Zistiť, čo potrebujem** | Sprievodca otázkami → orientačný záver + náročnosť | ✅ scenárovaná logika |
| 3 | **Postup pri povolení** | 7 krokov, čo si klient rieši sám a kde nastupuje Aplan | ✅ |
| 4 | **Generátor správ na úrad/obec** | 5 typov správ → vyplnenie → hotový text na skopírovanie | ✅ |
| 5 | **Projektový štartovací balík** | Pár otázok → kompletný balík (dokumenty, otázky, 2 e-maily) | ✅ |
| 6 | **Zber dopytu pre Aplan** | Kvalitný formulár dopytu + (neskôr) prílohy | ✅ fake odoslanie |
| 7 | **Rýchle kontaktné akcie** | Lišta: Zavolať, E-mail, WhatsApp, Konzultácia, Dopyt… | ✅ |
| 8 | **Sprievodca stránkou** | Úvodné čipy navigujú na služby / postup / kontakt | ✅ |
| 9 | **Checklist dokumentov** | Odškrtávací zoznam podľa typu prípadu + vysvetlivky | ✅ interaktívne |
| 10 | **Orientačné posúdenie náročnosti** | jednoduché / stredne náročné / komplikované | ✅ badge |

Funkcie sa **prelínajú** — napr. po sprievodcovi „Zistiť, čo potrebujem" asistent
ponúkne checklist, správu na úrad, balík aj rezerváciu.

---

## 3) Používateľské flow

**Vstup:** teaser bublina po ~2,6 s → *„Neviete, čo potrebujete k projektu alebo
povoleniu? Aplan AI vám pomôže zistiť ďalší krok."* → klik → úvodná správa →
rýchle čipy + lišta kontaktných akcií.

```
Otvorenie
 └─ Úvodná správa + disclaimer (Aplan = projektová kancelária)
     └─ Hlavné menu (čipy)
         ├─ Zistiť, čo potrebujem
         │     typ stavby → pozemok → parcela → nová/existujúca → úrad
         │     → ORIENTAČNÝ ZÁVER + náročnosť
         │     → [Checklist] [Správa na úrad] [Balík] [Konzultácia] [Dopyt]
         ├─ Postup pri povolení (7 krokov) → [Text na obec] [Checklist] [Konzultácia]
         ├─ Správa na úrad → výber typu → formulár → hotový text + Kopírovať
         ├─ Projektový štartovací balík → 2 otázky + formulár → 6-dielny balík
         ├─ Rezervovať konzultáciu (demo kalendár) → potvrdenie
         ├─ Checklist dokumentov (podľa typu) → odškrtávanie
         └─ Poslať dopyt → formulár → poďakovanie
```

Voľný text v poli sa rozpozná podľa kľúčových slov (povolenie, termín, dokument,
dom, cena…) a nasmeruje na správny flow. Vždy je dostupné **„↩ Späť na menu"**.

---

## 4) Návrh textov

**Teaser:** „Neviete, čo potrebujete k projektu alebo povoleniu? **Aplan AI** vám
pomôže zistiť ďalší krok."

**Úvod:** „Dobrý deň, som **Aplan AI asistent**. Pomôžem vám zistiť, aký typ
projektu alebo podkladov môžete potrebovať, pripravím vám checklist dokumentov,
pomôžem s textom správy na obec alebo stavebný úrad a môžete si tu predbežne
vybrať termín konzultácie." + mini-poznámka: *„Aplan je projektová kancelária —
úrady nevybavujeme za vás, ale pripravíme projekt a podklady a vysvetlíme
postup."*

**Rýchle čipy:** Zistiť, čo potrebujem · Chcem nový projekt domu · Potrebujem
riešiť povolenie · Chcem rekonštrukciu · Vytvoriť správu na úrad · Projektový
štartovací balík · Rezervovať konzultáciu · Checklist dokumentov · Neviem,
potrebujem poradiť.

**Orientačný záver:** „Podľa odpovedí to **orientačne** vyzerá, že budete
pravdepodobne potrebovať [projektovú dokumentáciu pre stavebné
povolenie/ohlásenie/konzultáciu]. Presné posúdenie závisí od lokality, rozsahu
stavby a požiadaviek úradu."

**Po výbere demo termínu:** „Termín je predbežne rezervovaný. Toto je ukážková
rezervácia v demo režime. Pri reálnom nasadení by sa termín odoslal firme Aplan
alebo zapísal do kalendára."

**Pri generovaní e-mailu na úrad:** „Tu je návrh správy. Skontrolujte si údaje a
pokojne ho upravte." + poznámka, že Aplan nevybavuje úrad za klienta.

**Po vytvorení balíka:** „Hotovo — tu je váš Projektový štartovací balík…"
(6 panelov) + „Balík je pripravený (demo). Pri reálnom nasadení by sa odoslal na
e-mail a kópia firme Aplan."

**Po odoslaní dopytu:** „Ďakujeme! Dopyt bol pripravený na odoslanie firme Aplan.
Na základe údajov vás bude možné lepšie nasmerovať a pripraviť prvotnú
konzultáciu."

Vzorový text na obec (krok 2) je zabudovaný v generátore — viď spec, použitý
doslova.

---

## 5) Návrh dizajnu

Asistent vizuálne zapadá do webu Aplan — **minimalistický, technický, čistý,
dôveryhodný**, nie detinský a nie ako generický AI bot.

- **Paleta:** ink/charcoal `#16181C` (primárna tmavá), paper `#FFFFFF`, off-white
  podklad `#F4F4F1`, jemné linky `#E3E2DC`, tlmený text `#6E6E66`. Jediný akcent:
  **bronz/mosadz `#B5894B`** — materiálová teplota architektúry, odlišuje
  asistenta od „modrých" AI botov.
- **Typografia:** Inter (400–900), výrazné letter-spacing v logu a nadpisoch.
- **Tvar:** mäkké rohy (rádius 18–24 px), tenké linky namiesto ťažkých tieňov,
  veľa bieleho priestoru. Launcher je **štvorček so zaobleným rohom** (nie kruh) —
  pôsobí architektonicky.
- **Logo / ikonka:** monogram **„A" z Aplanu + malé „i"** = vizuálne „AI".
  Geometrické bezpätkové A (pripomína strechu/štít), vedľa neho tenký stĺpik „i"
  s bodkou v akcentovej bronzovej. Elegantné, firemné, žiadny maskot ani emoji.
  Je v SVG (funkcia `mono()` v `index.html`) — launcher, hlavička aj avatar
  správ.
- **Animácie:** plynulý nábeh správ, „typing" indikátor, pop čipov, pulzujúca
  bodka na launcheri.

---

## 6) Návrh fake kalendára

Vizuálne vierohodný, ale **bez reálneho napojenia**. Tri kroky v jednom paneli:

1. **Typ stretnutia** (4 dlaždice): Osobná (45 min) · Telefonická (20 min) ·
   Online (30 min) · Úvodné posúdenie zámeru (30 min).
2. **Deň** — mesačná mriežka (demo: jún 2026). Víkendy a minulosť sú neaktívne;
   voľné termíny majú bronzovú bodku.
3. **Čas** — prednastavené sloty (08:30 – 16:00).
4. **Údaje** — meno, telefón, e-mail, obec/lokalita, popis zámeru.

Výsledok: zelené potvrdenie so štítkom **„demo"** a vetou, že pri reálnom nasadení
by sa termín odoslal Aplanu / zapísal do kalendára. Dizajn je pripravený tak, aby
sa neskôr napojil na reálny kalendár bez vizuálnej zmeny.

---

## 7) Funkcia „Projektový štartovací balík"

Vlajková funkcia. Po 2 otázkach (typ zámeru, pozemok) + krátkom formulári (obec,
parcela, meno, popis) asistent vygeneruje **prehľadný balík v 6 paneloch**:

1. Čo pravdepodobne potrebujete (orientačne)
2. Dokumenty, ktoré si pripravte
3. Čo zistiť na obci
4. Otázky pre stavebný úrad
5. **Pripravený e-mail pre obec / úrad** (kopírovať)
6. **Pripravený e-mail pre Aplan** (kopírovať)

Na konci: pole na e-mail + tlačidlá **„Odoslať balík na e-mail"** a **„Skopírovať
celý balík"**. V deme sa zobrazí ukážkové potvrdenie. Texty e-mailov sa
predvyplnia údajmi klienta.

---

## 8) Technické riešenie

- **Frontend widget:** jeden samostatný `index.html` (HTML + CSS + vanilla JS),
  bez závislostí. Vkladá sa na web Aplan jedným `<script>` / `<iframe>` snippetom;
  všetko je v namespace, aby nekolidovalo so štýlmi stránky.
- **Konverzačný engine:** jednoduchý stavový automat — `botMsg()`, `chipRow()`,
  `typing()`, jednotlivé `flow*()` funkcie. Ľahko rozšíriteľné o ďalšie flow.
- **Fake kalendár:** prednastavené dni/sloty generované v JS; pripravené na
  neskoršie napojenie (Google/Microsoft kalendár, Calendly, vlastné API).
- **Zber dopytu:** dáta sa zbierajú do objektu; reálne odoslanie sa doplní cez
  e-mail službu (napr. EmailJS — rovnako ako v ostatných projektoch) alebo
  backend endpoint.
- **Generátor e-mailov:** šablóny v `letterDefs` / balíku; `navigator.clipboard`
  na kopírovanie, neskôr `mailto:` alebo odoslanie cez backend.
- **Pripravené na neskôr:** reálny kalendár · odosielanie e-mailov a dopytu ·
  upload dokumentov (LV, kataster, foto) · AI odpovede nad obsahom webu Aplan
  (RAG / Claude) namiesto scenárovaných odpovedí.
- **Mobil:** plný „fullscreen" panel pod 520 px, veľké klikateľné tlačidlá,
  kalendár optimalizovaný na dotyk, rýchle zavretie, plynulé animácie.

---

## 9) Čo ukázať klientovi v prvej demo verzii

Poradie, ktoré najlepšie „predá" hodnotu:

1. **Otvorenie + teaser + úvod** — pôsobí firemne a hneď vysvetlí, že Aplan je
   projektová kancelária (nie vybavovač úradov).
2. **„Zistiť, čo potrebujem"** → ukázať orientačný záver + badge náročnosti.
3. **Projektový štartovací balík** — „wow" moment: z pár klikov vznikne kompletný
   prehľad + dva hotové e-maily.
4. **Generátor správy na obec** — praktická, okamžite použiteľná hodnota.
5. **Demo kalendár** — vierohodná rezervácia s jasným „demo" štítkom.
6. **Dopyt** — ukázať, že na konci firma získa kvalitný, štruktúrovaný kontakt.

Dôraz v prezentácii: *všetko vyzerá ako reálna funkcia, je to demo, a každý kus je
pripravený na reálne napojenie* (kalendár, e-mail, upload, AI nad obsahom webu).
