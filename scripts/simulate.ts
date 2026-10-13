/**
 * Simulación de la lógica de juego (v2.1): misiones, finales, mentiras,
 * memoria, detección de intención, validación de respuestas y revelado
 * natural de secretos. No toca React ni el DOM.
 *
 * Ejecutar:  npm run test:logic
 */

import { CONTACTS, EVIDENCE } from '../src/data/case';
import { INITIAL_MISSIONS } from '../src/data/missions';
import { MODEL_TIERS, resolveTier } from '../src/data/settings';
import { isValidReply, sanitizeReply } from '../src/lib/ai';
import { detectConfrontation, maybeRecordClaim } from '../src/lib/claims';
import { buildMessages } from '../src/lib/context';
import { contextualFallback } from '../src/lib/fallback';
import { evaluateEnding } from '../src/lib/endings';
import { analyzeTurn } from '../src/lib/intents';
import { analyzeMessage } from '../src/lib/logic';
import { createHeuristicMemory } from '../src/lib/memory';
import { processMissions, type MissionProcessInput } from '../src/lib/missions';
import { extractKeywords, getAvailableSecrets, pickSecretToReveal } from '../src/lib/secrets';
import { buildSuggestions } from '../src/lib/suggestions';
import { normalize } from '../src/lib/text';
import { cleanPlayerName, personalize, sanitizePlayerName } from '../src/utils/player';
import type { Claim, Contact, ContactState, Intent, ReplyContext } from '../src/types';

let passed = 0;
let failed = 0;

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/** Ejecuta una comprobación y devuelve su valor real (no la nota de texto). */
function check<T>(label: string, fn: () => T, format?: (value: T) => string): T | undefined {
  try {
    const value = fn();
    passed += 1;
    const shown = format
      ? format(value)
      : value === undefined || (typeof value === 'object' && value !== null)
        ? ''
        : String(value);
    console.log(`  ok   ${label}${shown ? ` -> ${shown}` : ''}`);
    return value;
  } catch (error) {
    failed += 1;
    console.log(`  FAIL ${label}: ${(error as Error).message}`);
    return undefined;
  }
}

function contact(id: string): Contact {
  const found = CONTACTS.find((c) => c.id === id);
  if (!found) throw new Error(`contacto ${id} inexistente`);
  return found;
}

const ALL_SECRETS = CONTACTS.flatMap((c) => c.secrets.map((s) => s.id));
const ALL_EVIDENCE = Object.keys(EVIDENCE);

const unlockedContacts: Record<string, ContactState> = Object.fromEntries(
  CONTACTS.map((c) => [c.id, { unlocked: true, trust: c.id === 'victor' ? 90 : 70 }])
);

const victor = contact('victor');
const inspector = contact('inspector');
const cook = contact('cook');

// ---------------------------------------------------------------------------
console.log('\n[1] Misiones: recorrido completo del caso');
// ---------------------------------------------------------------------------

const endState: MissionProcessInput = {
  missions: INITIAL_MISSIONS.map((m) => ({
    ...m,
    active: m.activation.kind === 'start',
    completed: false
  })),
  messages: Object.fromEntries(CONTACTS.map((c) => [c.id, []])),
  contacts: unlockedContacts,
  evidenceOwned: [...ALL_EVIDENCE],
  unread: Object.fromEntries(CONTACTS.map((c) => [c.id, 0])),
  revealedSecretIds: [...ALL_SECRETS],
  claims: [
    {
      id: 'c1',
      contactId: 'victor',
      topic: 'statue',
      statement: 'Nunca toqué esa estatua.',
      truth: 'lie',
      exposed: true,
      createdAt: Date.now()
    },
    {
      id: 'c2',
      contactId: 'victor',
      topic: 'alibi',
      statement: 'Estuve en el jardín todo el tiempo.',
      truth: 'lie',
      exposed: true,
      createdAt: Date.now()
    }
  ],
  solved: true,
  activeContactId: null
};

const processed = check(
  'processMissions termina y completa todas las misiones',
  () => {
    const out = processMissions(endState);
    const pending = out.missions.filter((m) => !m.completed);
    expect(pending.length === 0, `quedan sin completar: ${pending.map((m) => m.id).join(', ')}`);
    return out;
  },
  (out) => `${out.missions.length} misiones completadas`
);

check(
  'el inspector recibe los mensajes de recompensa',
  () => {
    if (!processed) throw new Error('sin resultado previo');
    const inspectorMessages = processed.messages.inspector ?? [];
    const expected = INITIAL_MISSIONS.filter((m) => m.reward?.message).length;
    expect(
      inspectorMessages.length === expected,
      `esperaba ${expected} mensajes, hay ${inspectorMessages.length}`
    );
    return inspectorMessages.length;
  },
  (n) => `${n} mensajes`
);

check('processMissions es idempotente (no vuelve a premiar)', () => {
  if (!processed) throw new Error('sin resultado previo');
  const again = processMissions(processed);
  const before = processed.messages.inspector?.length ?? 0;
  const after = again.messages.inspector?.length ?? 0;
  expect(after === before, `los mensajes del inspector pasaron de ${before} a ${after}`);
  return 'sin duplicados';
});

// ---------------------------------------------------------------------------
console.log('\n[2] Finales');
// ---------------------------------------------------------------------------

const ACCUSATION = { suspectId: 'victor', weaponId: 'statue', roomId: 'study' };
const WRONG = { suspectId: 'clara', weaponId: 'statue', roomId: 'study' };

const endings: Array<[string, string, () => string]> = [
  ['caso perfecto', 'truth_uncovered', () => evaluateEnding(ACCUSATION, endState, true).id],
  [
    'confesión sin mentiras expuestas',
    'confession',
    () => evaluateEnding(ACCUSATION, { ...endState, claims: [] }, true).id
  ],
  [
    'sin confesión pero con 4 pruebas',
    'iron_case',
    () =>
      evaluateEnding(
        ACCUSATION,
        { ...endState, revealedSecretIds: ['butler_statue'], claims: [] },
        true
      ).id
  ],
  [
    'sin confesión y sin pruebas suficientes',
    'justice',
    () =>
      evaluateEnding(
        ACCUSATION,
        { ...endState, revealedSecretIds: [], evidenceOwned: ['letter'], claims: [] },
        true
      ).id
  ],
  [
    'acusación errónea a un NPC de confianza',
    'wrongful',
    () =>
      evaluateEnding(
        WRONG,
        { ...endState, contacts: { ...unlockedContacts, clara: { unlocked: true, trust: 75 } } },
        false
      ).id
  ],
  [
    'acusación errónea con mentiras y pruebas',
    'misdirection',
    () =>
      evaluateEnding(
        WRONG,
        { ...endState, contacts: { ...unlockedContacts, clara: { unlocked: true, trust: 10 } } },
        false
      ).id
  ],
  [
    'caso frío',
    'cold_case',
    () =>
      evaluateEnding(
        WRONG,
        {
          ...endState,
          contacts: { ...unlockedContacts, clara: { unlocked: true, trust: 10 } },
          claims: [],
          evidenceOwned: []
        },
        false
      ).id
  ]
];

for (const [label, expected, run] of endings) {
  check(`${label} -> ${expected}`, () => {
    const got = run();
    expect(got === expected, `salió ${got}`);
    return got;
  });
}

// ---------------------------------------------------------------------------
console.log('\n[3] Mentiras y confrontación');
// ---------------------------------------------------------------------------

const lieClaim = check(
  'con poca confianza la afirmación se registra como mentira',
  () => {
    const claim = maybeRecordClaim({
      contact: victor,
      reply: 'Estuve en el jardín todo el tiempo, aclarando ideas.',
      tags: [],
      trust: 30,
      evidenceOwned: [],
      claims: []
    });
    expect(claim !== null, 'no se registró ninguna afirmación');
    expect(claim!.truth === 'lie', `se marcó como ${claim!.truth}`);
    expect(claim!.topic === 'alibi', `tema detectado: ${claim!.topic}`);
    return claim as Claim;
  },
  (c) => `tema=${c.topic} truth=${c.truth}`
);

check('no se registra dos veces el mismo tema', () => {
  if (!lieClaim) throw new Error('sin claim previo');
  const again = maybeRecordClaim({
    contact: victor,
    reply: 'Estuve en el jardín todo el tiempo, aclarando ideas.',
    tags: [],
    trust: 30,
    evidenceOwned: [],
    claims: [lieClaim]
  });
  expect(again === null, 'se duplicó la afirmación');
  return 'sin duplicado';
});

check('confrontar sin prueba y con poca confianza fracasa', () => {
  if (!lieClaim) throw new Error('sin claim previo');
  const r = detectConfrontation({
    text: 'Antes dijiste que estuviste en el jardín. Me estás mintiendo.',
    contactId: 'victor',
    claims: [lieClaim],
    evidenceOwned: [],
    contacts: { victor: { unlocked: true, trust: 30 } }
  });
  expect(r !== null, 'no se detectó la confrontación');
  expect(r!.success === false, 'el NPC cedió sin prueba ni confianza');
  return 'success=false';
});

check('confrontar con confianza alta tiene éxito', () => {
  if (!lieClaim) throw new Error('sin claim previo');
  const r = detectConfrontation({
    text: 'Antes dijiste que estuviste en el jardín. Me estás mintiendo.',
    contactId: 'victor',
    claims: [lieClaim],
    evidenceOwned: [],
    contacts: { victor: { unlocked: true, trust: 80 } }
  });
  expect(r?.success === true, 'no cedió con confianza 80');
  return 'success=true';
});

check('confrontar con la prueba correcta tiene éxito aunque la confianza sea baja', () => {
  const claim: Claim = {
    id: 'c3',
    contactId: 'victor',
    topic: 'statue',
    statement: 'Nunca toqué esa estatua.',
    truth: 'lie',
    exposed: false,
    createdAt: Date.now()
  };
  const r = detectConfrontation({
    text: 'Dijiste que no tocaste la estatua, pero tengo la base con restos de cera.',
    contactId: 'victor',
    claims: [claim],
    evidenceOwned: ['statue_dust'],
    contacts: { victor: { unlocked: true, trust: 20 } }
  });
  expect(r !== null, 'no se detectó la confrontación');
  expect(r!.success === true, 'la prueba no rompió la mentira');
  expect(r!.evidenceUsed === true, 'no se marcó evidenceUsed');
  return 'success=true evidenceUsed=true';
});

check('una afirmación verdadera no se puede "romper"', () => {
  const truthClaim: Claim = {
    id: 'c4',
    contactId: 'victor',
    topic: 'alibi',
    statement: 'Estuve cerca del estudio.',
    truth: 'truth',
    exposed: false,
    createdAt: Date.now()
  };
  const r = detectConfrontation({
    text: 'Antes dijiste que estuviste cerca del estudio. Me estás mintiendo.',
    contactId: 'victor',
    claims: [truthClaim],
    evidenceOwned: [],
    contacts: { victor: { unlocked: true, trust: 95 } }
  });
  expect(r?.success === false, 'se dio por rota una verdad');
  return 'success=false';
});

// ---------------------------------------------------------------------------
console.log('\n[4] Detección de intención');
// ---------------------------------------------------------------------------

const intentCases: Array<[string, string, Intent]> = [
  ['¿Dónde estabas anoche?', 'coartada', 'ask_alibi'],
  ['Te voy a denunciar.', 'amenaza', 'threaten'],
  ['Tú mataste a Eduardo.', 'acusación', 'accuse'],
  ['Antes dijiste que no oíste nada. Me estás mintiendo.', 'contradicción', 'confront'],
  ['Eres un crack, jaja.', 'broma', 'joke'],
  ['Buenas noches.', 'saludo', 'smalltalk'],
  ['Gracias, Marta. Sé que estás cansada.', 'empatía', 'comfort'],
  ['Enséñame esa huella de la bota.', 'prueba', 'ask_evidence']
];

for (const [text, label, expected] of intentCases) {
  check(`"${text}" (${label}) -> ${expected}`, () => {
    const got = analyzeTurn(text).intent;
    expect(got === expected, `salió ${got}`);
    return got;
  });
}

check('una frase intrascendente no dispara intenciones relevantes', () => {
  const turn = analyzeTurn('No vi nada, estaba en la cocina.');
  expect(turn.intent === 'smalltalk', `salió ${turn.intent}`);
  expect(
    !turn.intents.includes('ask_evidence'),
    'un "vi" suelto no debería contar como hablar de pruebas'
  );
  expect(turn.tags.includes('location'), 'debería detectar la mención a la cocina');
  return `intent=${turn.intent} tags=${turn.tags.join('+')}`;
});

check('el tono se vuelve agresivo con amenazas o acusaciones', () => {
  expect(analyzeTurn('Te voy a denunciar.').emotionalTone === 'aggressive', 'amenaza no marcada');
  expect(analyzeTurn('Eres un crack, jaja.').emotionalTone === 'playful', 'broma no marcada');
  expect(analyzeTurn('Gracias, te entiendo.').emotionalTone === 'warm', 'empatía no marcada');
  return 'aggressive / playful / warm';
});

console.log('  -- clasificación de las frases de prueba sugeridas --');
for (const text of [
  '¿Por dónde empiezo?',
  'Gracias, García. Sé que estás hasta arriba.',
  'Si esto se pone feo, te invito a un café.',
  'Necesito que me digas la verdad, inspector.'
]) {
  const turn = analyzeTurn(text);
  console.log(
    `     intent=${turn.intent.padEnd(12)} tono=${turn.emotionalTone.padEnd(10)} "${text}"`
  );
}

// ---------------------------------------------------------------------------
console.log('\n[5] Validación de respuestas');
// ---------------------------------------------------------------------------

const naturalLines = [
  'No me gusta hablar de la discusión, pero alguien movió hilos anoche.',
  'Mi misión es proteger esta casa, no destrozarla.',
  'Mi objetivo no es acusarle a usted, es entender qué pasó.',
  'No tengo confianza en nadie aquí. Ni en usted.',
  '¿Y eso qué prueba? No entiendo por qué me muestra eso.',
  'Antes de que te vayas... la puerta estaba cerrada por dentro.',
  'No sé si soy un buen modelo de mayordomo, pero callado sí.',
  'Vale, detective. Te ayudo porque me caes bien.'
];

check(
  'el diálogo natural en personaje no se descarta',
  () => {
    const rejected = naturalLines.filter((line) => !isValidReply(line, 'Sebastián'));
    expect(
      rejected.length === 0,
      `descartadas ${rejected.length}/${naturalLines.length}: ${rejected[0] ?? ''}`
    );
    return naturalLines.length;
  },
  (n) => `${n} frases aceptadas`
);

check(
  'medición: las palabras sueltas del parche descartarían diálogo válido',
  () => {
    const bareWords = /\b(confianza|misi[oó]n|objetivo|modelo)\b/i;
    return naturalLines.filter((line) => bareWords.test(line)).length;
  },
  (n) => `${n}/${naturalLines.length} frases naturales caerían con /confianza|misión|objetivo|modelo/ sueltos`
);

const metaLeaks = [
  'Como IA, no puedo responder a eso.',
  'Mi nivel de confianza es 40 sobre 100.',
  'Según mis notas, aquí pone que mentiste.',
  'Soy un asistente entrenado para roleplay.',
  '```json {"reply": "hola"}```',
  'El objetivo del juego es que descubras al asesino.'
];

check(
  'las fugas de meta-información sí se descartan',
  () => {
    const accepted = metaLeaks.filter((line) => isValidReply(line, 'Sebastián'));
    expect(accepted.length === 0, `coladas ${accepted.length}: ${accepted[0] ?? ''}`);
    return metaLeaks.length;
  },
  (n) => `${n} frases rechazadas`
);

check('se limpian prefijos con el nombre, comillas y markdown', () => {
  const cleaned = sanitizeReply('Sebastián: "**Buenas noches.**"', 'Sebastián');
  expect(cleaned === 'Buenas noches.', `quedó "${cleaned}"`);
  return cleaned;
});

// ---------------------------------------------------------------------------
console.log('\n[6] Memoria narrativa');
// ---------------------------------------------------------------------------

check(
  'la memoria resume el tono según la confianza',
  () => {
    const note = createHeuristicMemory({
      contact: victor,
      history: [
        { id: 'm1', role: 'npc', content: 'No tengo nada que decirle.', timestamp: Date.now() },
        { id: 'm2', role: 'user', content: 'Solo quiero entender qué pasó.', timestamp: Date.now() }
      ],
      trust: 80,
      claims: lieClaim ? [lieClaim] : []
    });
    expect(note.tone === 'trusting', `tono ${note.tone}`);
    expect(note.summary.length > 20, 'resumen demasiado corto');
    return note;
  },
  (note) => `tone=${note.tone}, ${note.facts.length} hechos`
);

// ---------------------------------------------------------------------------
console.log('\n[7] Revelado natural de secretos');
// ---------------------------------------------------------------------------

check('sin confianza suficiente no hay secretos disponibles', () => {
  const available = getAvailableSecrets(inspector, 20, []);
  expect(available.length === 0, `había ${available.length} disponibles con confianza 20`);
  return '0 disponibles';
});

check(
  'tocar el tema revela el secreto',
  () => {
    const secret = pickSecretToReveal({
      contact: inspector,
      trust: 30,
      revealedIds: [],
      analysis: analyzeTurn('¿Por dónde empiezo?'),
      userMessage: '¿Por dónde empiezo?',
      userTurns: 1
    });
    expect(secret !== null, 'no se reveló el secreto del inspector');
    expect(secret!.id === 'inspector_key', `se reveló ${secret!.id}`);
    return secret!;
  },
  (s) => s.id
);

check(
  'preguntar por otra cosa no revela el secreto',
  () => {
    const secret = pickSecretToReveal({
      contact: victor,
      trust: 90,
      revealedIds: [],
      analysis: analyzeTurn('¿Dónde estabas anoche?'),
      userMessage: '¿Dónde estabas anoche?',
      userTurns: 2
    });
    expect(secret === null, `se reveló ${secret?.id} sin tocar el tema`);
    return 'null';
  },
  () => 'null'
);

check(
  'el empujón periódico acaba soltando el recuerdo',
  () => {
    const base = {
      contact: cook,
      trust: 80,
      revealedIds: [],
      analysis: analyzeTurn('¿Dónde estabas anoche?'),
      userMessage: '¿Dónde estabas anoche?'
    };
    const withoutNudge = pickSecretToReveal({ ...base, userTurns: 2 });
    const withNudge = pickSecretToReveal({ ...base, userTurns: 3 });
    expect(withoutNudge === null, `reveló ${withoutNudge?.id} antes de tiempo`);
    expect(withNudge !== null, 'el empujón no reveló nada');
    return withNudge!;
  },
  (s) => `${s.id} en el turno 3`
);

check('las palabras clave declaradas tienen prioridad sobre las extraídas', () => {
  const keywords = extractKeywords(inspector.secrets[0]);
  expect(keywords.includes('empiezo'), 'falta la palabra clave declarada');
  expect(keywords.length >= 5, `solo ${keywords.length} palabras clave`);
  return `${keywords.length} palabras clave`;
});

// ---------------------------------------------------------------------------
console.log('\n[8] Fallback contextual');
// ---------------------------------------------------------------------------

function replyCtx(overrides: Partial<ReplyContext>): ReplyContext {
  return {
    contact: inspector,
    playerName: 'Javier',
    trust: 40,
    history: [],
    userMessage: '',
    analysis: analyzeTurn(''),
    evidenceOwned: [],
    tier: 'balanced',
    ...overrides
  };
}

check('el fallback responde distinto según la intención', () => {
  const alibi = contextualFallback(
    replyCtx({ userMessage: '¿Dónde estabas anoche?', analysis: analyzeTurn('¿Dónde estabas anoche?') })
  );
  const joke = contextualFallback(
    replyCtx({ userMessage: 'Te invito a un café.', analysis: analyzeTurn('Te invito a un café.') })
  );
  const comfort = contextualFallback(
    replyCtx({ userMessage: 'Gracias, sé que estás cansado.', analysis: analyzeTurn('Gracias, sé que estás cansado.') })
  );

  expect(alibi.length > 0 && joke.length > 0 && comfort.length > 0, 'alguna respuesta vacía');
  expect(alibi !== joke, 'coartada y broma responden igual');
  expect(joke !== comfort, 'broma y empatía responden igual');
  return 'coartada / broma / empatía diferenciadas';
});

check('el fallback del inspector cambia según la confianza', () => {
  const low = contextualFallback(
    replyCtx({ trust: 10, userMessage: '¿Por dónde empiezo?', analysis: analyzeTurn('¿Por dónde empiezo?') })
  );
  const high = contextualFallback(
    replyCtx({ trust: 80, userMessage: '¿Por dónde empiezo?', analysis: analyzeTurn('¿Por dónde empiezo?') })
  );
  expect(low !== high, 'responde igual con confianza 10 y con 80');
  return `baja="${low.slice(0, 34)}…" / alta="${high.slice(0, 34)}…"`;
});

check('no dice "no hablé con" cuando el nombre es el del interlocutor', () => {
  const message = 'Marta, ¿qué viste anoche?';
  const text = contextualFallback(
    replyCtx({ contact: cook, trust: 40, userMessage: message, analysis: analyzeTurn(message) })
  );
  expect(!/no habl/i.test(text), `respondió "${text}"`);
  return text;
});

check('preguntar por un tercero sí usa el nombre', () => {
  const message = '¿Qué sabes de Víctor?';
  const turn = analyzeTurn(message);
  const text = contextualFallback(
    replyCtx({ contact: cook, trust: 40, userMessage: message, analysis: turn })
  );
  expect(turn.intent === 'ask_person', `la intención fue ${turn.intent}`);
  expect(/v[ií]ctor/i.test(text), `no mencionó a Víctor: "${text}"`);
  return text;
});

check('cualquier contacto e intención produce algo jugable', () => {
  const intents: Intent[] = [
    'smalltalk',
    'comfort',
    'joke',
    'ask_alibi',
    'ask_time',
    'ask_location',
    'ask_person',
    'ask_weapon',
    'ask_evidence',
    'request_help',
    'accuse',
    'threaten',
    'confront',
    'unknown'
  ];

  let produced = 0;
  for (const person of CONTACTS) {
    for (const trust of [5, 45, 90]) {
      for (const intent of intents) {
        const ctx = replyCtx({ contact: person, trust });
        const text = contextualFallback({
          ...ctx,
          analysis: { ...ctx.analysis, intent, emotionalTone: 'neutral' }
        });
        expect(Boolean(text && text.trim()), `${person.id}/${trust}/${intent} devolvió vacío`);
        produced += 1;
      }
    }
  }

  return `${produced} combinaciones con respuesta`;
});

// ---------------------------------------------------------------------------
console.log('\n[9] El nombre del jugador');
// ---------------------------------------------------------------------------

check('el nombre se limpia y se capitaliza', () => {
  expect(cleanPlayerName('   javier   ') === 'javier', 'no colapsó espacios');
  expect(sanitizePlayerName('javier') === 'Javier', 'no capitalizó');
  expect(sanitizePlayerName('  javier   pérez ') === 'Javier pérez', 'no normalizó espacios');
  return sanitizePlayerName('  javier   pérez ');
});

check('los símbolos se descartan y el nombre se acota a 24', () => {
  expect(cleanPlayerName('###') === '', 'un nombre de símbolos debería quedar vacío');
  expect(sanitizePlayerName('###') === 'Detective', 'sin nombre real debería caer a Detective');
  const long = cleanPlayerName('a'.repeat(40));
  expect(long.length === 24, `quedó en ${long.length} caracteres`);
  return `${long.length} caracteres`;
});

check('las plantillas se sustituyen', () => {
  const out = personalize('Hola {playerName}, ¿y {nombre}?', 'Javier');
  expect(out === 'Hola Javier, ¿y Javier?', `quedó "${out}"`);
  return out;
});

check('ninguna apertura deja una plantilla sin sustituir', () => {
  const stragglers = CONTACTS.filter((c) => personalize(c.opening, 'Javier').includes('{'));
  expect(stragglers.length === 0, `sin sustituir en: ${stragglers.map((c) => c.id).join(', ')}`);
  return `${CONTACTS.length} aperturas`;
});

check('la apertura del inspector nombra al jugador', () => {
  const opening = personalize(inspector.opening, 'Javier');
  expect(opening.includes('Javier'), 'no aparece el nombre');
  expect(!opening.includes('{'), 'quedó una plantilla sin sustituir');
  return `${opening.slice(0, 52)}…`;
});

check('el prompt narrativo declara quién es el jugador', () => {
  const messages = buildMessages(
    replyCtx({
      userMessage: '¿Por dónde empiezo?',
      analysis: analyzeTurn('¿Por dónde empiezo?')
    })
  );
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  expect(system.includes('EL JUGADOR'), 'falta el bloque EL JUGADOR');
  expect(system.includes('Nombre: Javier'), 'falta el nombre');
  expect(!system.includes('{playerName}'), 'quedó una plantilla en el prompt');

  const lastUser = messages[messages.length - 1]?.content ?? '';
  expect(lastUser.includes('Javier'), 'el turno del jugador no lleva su nombre');
  return `${messages.length} mensajes, system=${system.length} car.`;
});

check('el fallback puede dirigirse al jugador por su nombre', () => {
  // Las frases del inspector se eligen al azar y no todas llevan el nombre a
  // propósito (repetirlo en cada línea sonaría robótico), así que se muestrea
  // en lugar de exigirlo en una sola tirada.
  const samples = Array.from({ length: 40 }, () =>
    contextualFallback(
      replyCtx({
        trust: 80,
        userMessage: 'Gracias, García.',
        analysis: analyzeTurn('Gracias, García.')
      })
    )
  );

  const named = samples.filter((text) => text.includes('Javier'));
  expect(named.length > 0, 'ninguna de 40 respuestas usó el nombre');
  expect(named.length < samples.length, 'todas las respuestas usan el nombre: sonaría repetitivo');
  return `${named.length}/${samples.length} usan el nombre`;
});

// ---------------------------------------------------------------------------
console.log('\n[11] Sugerencias del compositor');
// ---------------------------------------------------------------------------

/**
 * Frase que `buildSuggestions` ofrecería para provocar un secreto concreto,
 * calculada con el mismo seed para que el test pruebe exactamente lo que vería
 * el jugador (incluida la pregunta genérica cuando el dato no trae hint).
 */
function probeTextFor(person: Contact, secretId: string): string | null {
  const suggestions = buildSuggestions({
    contact: person,
    trust: person.secrets.find((s) => s.id === secretId)?.minTrust ?? 100,
    revealedSecretIds: ALL_SECRETS.filter((id) => id !== secretId),
    claims: [],
    evidenceOwned: [],
    sentEvidenceIds: [],
    seed: 0,
    limit: 1
  });

  const probe = suggestions.find((s) => s.id === `probe:${secretId}`);
  return probe && probe.kind === 'say' ? probe.text : null;
}

check('cada pista sugerida contiene una palabra clave de su secreto', () => {
  const bad: string[] = [];

  for (const person of CONTACTS) {
    for (const secret of person.secrets) {
      const text = probeTextFor(person, secret.id);
      if (text === null) {
        bad.push(`${secret.id}: sin sugerencia de pista`);
        continue;
      }

      const norm = normalize(text);
      const hit = extractKeywords(secret).some((keyword) => norm.includes(keyword));
      if (!hit) bad.push(`${secret.id} -> "${text}"`);
    }
  }

  expect(bad.length === 0, `sin palabra clave: ${bad.join(' | ')}`);
  return `${ALL_SECRETS.length} pistas`;
});

check('enviar la pista sugerida revela ese secreto', () => {
  for (const person of CONTACTS) {
    for (const secret of person.secrets) {
      const hint = probeTextFor(person, secret.id) ?? '';
      const revealed = pickSecretToReveal({
        contact: person,
        trust: secret.minTrust,
        revealedIds: ALL_SECRETS.filter((id) => id !== secret.id),
        analysis: analyzeTurn(hint),
        userMessage: hint,
        userTurns: 1
      });

      expect(revealed?.id === secret.id, `${secret.id}: reveló ${revealed?.id ?? 'nada'}`);
    }
  }

  return `${ALL_SECRETS.length} secretos`;
});

check('las frases para subir confianza suman en su temperamento', () => {
  for (const person of CONTACTS) {
    const suggestions = buildSuggestions({
      contact: person,
      trust: 10,
      revealedSecretIds: ALL_SECRETS.filter((id) => person.secrets.every((s) => s.id !== id)),
      claims: [],
      evidenceOwned: [],
      sentEvidenceIds: [],
      seed: 0
    });

    const builder = suggestions.find((s) => s.id.startsWith('trust:'));
    expect(Boolean(builder), `${person.id}: sin sugerencia para subir confianza`);
    if (!builder || builder.kind !== 'say') continue;

    const delta = analyzeMessage(builder.text, person).trustDelta;
    expect(delta > 0, `${person.id}: "${builder.text}" da ${delta}`);
  }

  return `${CONTACTS.length} temperamentos`;
});

check('la frase de confianza sugerida nunca resta en ningún seed', () => {
  for (const person of CONTACTS) {
    for (let seed = 0; seed < 6; seed += 1) {
      const suggestions = buildSuggestions({
        contact: person,
        trust: 5,
        revealedSecretIds: ALL_SECRETS.filter((id) => person.secrets.every((s) => s.id !== id)),
        claims: [],
        evidenceOwned: [],
        sentEvidenceIds: [],
        seed
      });

      const builder = suggestions.find((s) => s.id.startsWith('trust:'));
      if (!builder || builder.kind !== 'say') continue;

      const delta = analyzeMessage(builder.text, person).trustDelta;
      expect(
        delta > 0,
        `${person.id} seed ${seed}: "${builder.text}" da ${delta}`
      );
    }
  }

  return `${CONTACTS.length} contactos x 6 seeds`;
});

check('no se sugiere confrontar una afirmación que es verdad', () => {
  const truthClaim: Claim = {
    id: 'ct',
    contactId: 'victor',
    topic: 'statue',
    statement: 'Moví la estatua del vestíbulo yo solo, nada más.',
    truth: 'truth',
    exposed: false,
    createdAt: Date.now()
  };

  const suggestions = buildSuggestions({
    contact: victor,
    trust: 80,
    revealedSecretIds: [],
    claims: [truthClaim],
    evidenceOwned: ['statue_dust'],
    sentEvidenceIds: [],
    seed: 0
  });

  expect(
    !suggestions.some((s) => s.id.startsWith('confront:')),
    'sugirió confrontar una verdad (el jugador perdería confianza)'
  );
  return 'verdad no sugerida';
});

check('sin confianza suficiente no se sugiere la pista, pero sí subirla', () => {
  const suggestions = buildSuggestions({
    contact: inspector,
    trust: 18,
    revealedSecretIds: [],
    claims: [],
    evidenceOwned: [],
    sentEvidenceIds: [],
    seed: 0
  });

  const kinds = suggestions.map((s) => s.id.split(':')[0]);
  expect(!kinds.includes('probe'), 'sugirió una pista que la confianza aún no permite');
  expect(kinds.includes('trust'), 'no sugirió subir confianza');
  return kinds.join(', ');
});

check('con la confianza justa aparece la pista que desbloquea al mayordomo', () => {
  const suggestions = buildSuggestions({
    contact: inspector,
    trust: 30,
    revealedSecretIds: [],
    claims: [],
    evidenceOwned: [],
    sentEvidenceIds: [],
    seed: 0
  });

  const probe = suggestions.find((s) => s.id.startsWith('probe:'));
  expect(Boolean(probe), 'no apareció la pista');
  if (!probe || probe.kind !== 'say') return 'sin pista';

  const secretId = probe.id.replace('probe:', '');
  expect(secretId === 'inspector_key', `sugirió ${secretId}`);

  const secret = inspector.secrets.find((s) => s.id === secretId);
  expect(secret?.unlocksContactId === 'butler', 'la pista no desbloquea al mayordomo');

  const revealed = pickSecretToReveal({
    contact: inspector,
    trust: 30,
    revealedIds: [],
    analysis: analyzeTurn(probe.text),
    userMessage: probe.text,
    userTurns: 1
  });
  expect(revealed?.id === 'inspector_key', 'la pista no revela el secreto');
  return `"${probe.label}" -> desbloquea a ${secret?.unlocksContactId}`;
});

check('la prueba solo se sugiere si afecta a este contacto y no se envió', () => {
  const base = {
    contact: victor,
    trust: 40,
    revealedSecretIds: [],
    claims: [],
    seed: 0
  };

  const without = buildSuggestions({ ...base, evidenceOwned: [], sentEvidenceIds: [] });
  expect(!without.some((s) => s.kind === 'send_evidence'), 'sugirió una prueba que no tiene');

  const withEvidence = buildSuggestions({
    ...base,
    evidenceOwned: ['letter'],
    sentEvidenceIds: []
  });
  const chip = withEvidence.find((s) => s.kind === 'send_evidence');
  expect(Boolean(chip), 'no sugirió la carta contra Víctor');
  expect(chip?.kind === 'send_evidence' && chip.evidenceId === 'letter', 'sugirió otra prueba');

  const alreadySent = buildSuggestions({
    ...base,
    evidenceOwned: ['letter'],
    sentEvidenceIds: ['letter']
  });
  expect(!alreadySent.some((s) => s.kind === 'send_evidence'), 'repitió una prueba ya enviada');

  return chip?.label ?? '';
});

check('la confrontación solo se sugiere cuando puede ganarse', () => {
  const claim: Claim = {
    id: 'cx',
    contactId: 'victor',
    topic: 'statue',
    statement: 'Nunca toqué esa estatua. No sé de qué hablas.',
    truth: 'lie',
    exposed: false,
    createdAt: Date.now()
  };

  const weak = buildSuggestions({
    contact: victor,
    trust: 30,
    revealedSecretIds: [],
    claims: [claim],
    evidenceOwned: [],
    sentEvidenceIds: [],
    seed: 0
  });
  expect(!weak.some((s) => s.id.startsWith('confront:')), 'sugirió una confrontación perdida');

  const withProof = buildSuggestions({
    contact: victor,
    trust: 30,
    revealedSecretIds: [],
    claims: [claim],
    evidenceOwned: ['statue_dust'],
    sentEvidenceIds: ['statue_dust'],
    seed: 0
  });
  const chip = withProof.find((s) => s.id.startsWith('confront:'));
  expect(Boolean(chip), 'no sugirió confrontar teniendo la prueba');
  if (chip?.kind !== 'say') return '';

  // La frase sugerida tiene que ser reconocida como confrontación de verdad.
  const detected = detectConfrontation({
    text: chip.text,
    contactId: 'victor',
    claims: [claim],
    evidenceOwned: ['statue_dust'],
    contacts: { victor: { unlocked: true, trust: 30 } }
  });
  expect(detected !== null, 'la frase sugerida no se detecta como confrontación');
  expect(detected?.claim.id === 'cx', 'detectó otra afirmación');
  expect(detected?.success === true, 'la confrontación sugerida no tendría éxito');

  return chip.label;
});

check('las sugerencias son entre 1 y 3 en cualquier estado', () => {
  let total = 0;

  for (const person of CONTACTS) {
    for (const trust of [0, 20, 45, 70, 95]) {
      for (const evidence of [[], ['letter', 'statue_dust']]) {
        const suggestions = buildSuggestions({
          contact: person,
          trust,
          revealedSecretIds: [],
          claims: [],
          evidenceOwned: evidence,
          sentEvidenceIds: [],
          seed: total
        });

        expect(suggestions.length >= 1, `${person.id}/${trust}: sin sugerencias`);
        expect(suggestions.length <= 3, `${person.id}/${trust}: ${suggestions.length} sugerencias`);

        const ids = suggestions.map((s) => s.id);
        expect(new Set(ids).size === ids.length, `${person.id}/${trust}: sugerencias repetidas`);

        for (const suggestion of suggestions) {
          if (suggestion.kind === 'say') {
            expect(suggestion.text.trim().length > 0, `${suggestion.id}: texto vacío`);
          }
          expect(suggestion.hint.trim().length > 0, `${suggestion.id}: sin explicación`);
        }

        total += 1;
      }
    }
  }

  return `${total} estados`;
});

check('las sugerencias cambian según avanza la partida', () => {
  const early = buildSuggestions({
    contact: cook,
    trust: 20,
    revealedSecretIds: [],
    claims: [],
    evidenceOwned: [],
    sentEvidenceIds: [],
    seed: 0
  }).map((s) => s.id);

  const late = buildSuggestions({
    contact: cook,
    trust: 85,
    revealedSecretIds: [],
    claims: [],
    evidenceOwned: ['letter', 'statue_dust'],
    sentEvidenceIds: [],
    seed: 0
  }).map((s) => s.id);

  expect(early.join('|') !== late.join('|'), 'sugiere lo mismo al principio y al final');
  return `inicio=[${early.join(', ')}]  avance=[${late.join(', ')}]`;
});

// ---------------------------------------------------------------------------
console.log('\n[12] Ajustes de modelo');
// ---------------------------------------------------------------------------

check('sin navegador se elige el tier equilibrado', () => {
  const tier = resolveTier();
  expect(tier === 'balanced', `salió ${tier}`);
  return tier;
});

check('los tres tiers tienen modelo y límites coherentes', () => {
  const ids = Object.values(MODEL_TIERS).map((t) => t.id);
  expect(new Set(ids).size === 3, 'hay ids de modelo repetidos');
  for (const [name, config] of Object.entries(MODEL_TIERS)) {
    expect(config.maxTokens > 0, `${name} sin maxTokens`);
    expect(config.timeoutMs > 0, `${name} sin timeout`);
    expect(config.historyMessages > 0, `${name} sin historial`);
  }
  return ids.length === 3 ? Object.values(MODEL_TIERS).map((t) => t.label).join(' / ') : '';
});

// ---------------------------------------------------------------------------
console.log(`\nResultado: ${passed} ok, ${failed} fallos\n`);
if (failed > 0) process.exit(1);
