// Vercel serverless function — AI odpovede pre Aplan asistenta.
// Volá Claude API priamo (bez závislostí). API kľúč je v env premennej ANTHROPIC_API_KEY.
//
// Nastavenie vo Vercel:
//   1) Nasaďte repo do Vercel (Framework Preset: Other / static).
//   2) Settings → Environment Variables → ANTHROPIC_API_KEY = sk-ant-...
//   3) Redeploy. Endpoint bude dostupný na /api/chat.

const MODEL = 'claude-sonnet-4-6';  // kvalita/cena sweet spot (~0,5–0,8 centa za odpoveď). Lacnejšie: 'claude-haiku-4-5'

const SYSTEM = `Si "Aplan AI" — asistent na webe projektovej (architektonicko-inžinierskej) kancelárie Aplan na Slovensku.

ČO JE APLAN: projektová kancelária. Pripravuje projektovú dokumentáciu, architektonické návrhy, odborné podklady a koordinuje profesie (statika, elektro, voda, kúrenie, energetika). NEVYBAVUJE úrady za klienta — podania a komunikáciu s úradom si rieši klient sám; Aplan pripraví projekt a podklady a vysvetlí postup.

ÚLOHA: pomôž klientovi zorientovať sa v úradných postupoch (stavebné povolenie, ohlásenie, kolaudácia, zmena/prístavba, územné rozhodnutie), v dokumentoch a v komunikácii s úradom.

ŠTÝL ODPOVEDE:
- Po slovensky, vecne, pokojne a stručne — väčšinou 2 až 5 viet.
- Čistý text bez markdownu: NEPOUŽÍVAJ hviezdičky (**), mriežky (#) ani emoji.
- Ak potrebuješ vymenovať body, použi krátke riadky s pomlčkou na začiatku.

PRAVIDLÁ:
- Píš "orientačne", "pravdepodobne", "závisí od konkrétnej obce a stavebného úradu".
- NIKDY netvrď: "vybavíme vám povolenie", "garantujeme schválenie", "toto určite stačí", "úrad to musí prijať".
- Neuvádzaj presné ceny, lehoty ani konkrétne paragrafy/právne tvrdenia. Ak je niečo neisté alebo závisí od situácie, povedz to a odporuč konzultáciu s projektantom.
- Nevymýšľaj fakty. Keď nevieš, priznaj to a ponúkni konzultáciu alebo poslanie dopytu.
- Pri vhodnej príležitosti odporuč rezerváciu konzultácie alebo poslanie dopytu cez tlačidlá v asistentovi.

KONTAKT: telefón +421 915 775 480, e-mail aplan@aplan.sk, web www.aplan.sk.`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(500).json({ error: 'missing_api_key' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const raw = (body && Array.isArray(body.messages)) ? body.messages : [];
  const messages = raw
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-16)
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!messages.length) { res.status(400).json({ error: 'no_messages' }); return; }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: SYSTEM, messages })
    });
    if (!r.ok) {
      const detail = await r.text();
      res.status(502).json({ error: 'upstream', detail: detail.slice(0, 300) });
      return;
    }
    const data = await r.json();
    const reply = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();
    res.status(200).json({ reply });
  } catch (e) {
    res.status(502).json({ error: 'fetch_failed' });
  }
};
