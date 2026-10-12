/**
 * Simulación de la lógica de juego v2: misiones, mentiras/confrontación,
 * memoria narrativa y evaluación de finales. No toca React ni el DOM.
 *
 * Ejecutar:
 *   npx esbuild scripts/simulate.ts --bundle --platform=node --format=esm --outfile=.tmp/simulate.mjs
 *   node .tmp/simulate.mjs
 */

import { CONTACTS, EVIDENCE } from '../src/data/case';
import { INITIAL_MISSIONS } from '../src/data/missions';
import { detectConfrontation, maybeRecordClaim } from '../src/lib/claims';
import { evaluateEnding } from '../src/lib/endings';
import { createHeuristicMemory } from '../src/lib/memory';
import { processMissions, type MissionProcessInput } from '../src/lib/missions';
import type { Claim, ContactState } from '../src/types';

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

const ALL_SECRETS = CONTACTS.flatMap((c) => c.secrets.map((s) => s.id));
const ALL_EVIDENCE = Object.keys(EVIDENCE);

const unlockedContacts: Record<string, ContactState> = Object.fromEntries(
  CONTACTS.map((c) => [c.id, { unlocked: true, trust: c.id === 'victor' ? 90 : 70 }])
);

const victor = CONTACTS.find((c) => c.id === 'victor');
if (!victor) throw new Error('Víctor no está en CONTACTS');

// ---------------------------------------------------------------------------
console.log('\n[1] Misión: recorrido completo del caso');
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
    expect(
      out.missions.every((m) => m.active),
      'alguna misión quedó inactiva'
    );
    return out;
  },
  (out) => `${out.missions.length} misiones completadas`
);

check(
  'el inspector recibe los mensajes de recompensa',
  () => {
    if (!processed) throw new Error('sin resultado previo');
    const inspector = processed.messages.inspector ?? [];
    const expected = INITIAL_MISSIONS.filter((m) => m.reward?.message).length;
    expect(inspector.length === expected, `esperaba ${expected} mensajes, hay ${inspector.length}`);
    return inspector.length;
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
  [
    'caso perfecto',
    'truth_uncovered',
    () => evaluateEnding(ACCUSATION, endState, true).id
  ],
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

check('sin palabras de contradicción no hay confrontación', () => {
  if (!lieClaim) throw new Error('sin claim previo');
  const r = detectConfrontation({
    text: '¿Qué tal va la tarde?',
    contactId: 'victor',
    claims: [lieClaim],
    evidenceOwned: [],
    contacts: { victor: { unlocked: true, trust: 90 } }
  });
  expect(r === null, 'detectó confrontación donde no la hay');
  return 'null';
});

// ---------------------------------------------------------------------------
console.log('\n[4] Memoria narrativa');
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
    expect(note.facts.length > 0, 'sin hechos registrados');
    return note;
  },
  (note) => `tone=${note.tone}, ${note.facts.length} hechos`
);

check('la memoria preserva hechos anteriores', () => {
  const first = createHeuristicMemory({
    contact: victor,
    history: [{ id: 'm1', role: 'user', content: 'hola', timestamp: Date.now() }],
    trust: 20,
    claims: []
  });
  const second = createHeuristicMemory({
    contact: victor,
    history: [{ id: 'm1', role: 'user', content: 'hola', timestamp: Date.now() }],
    trust: 20,
    claims: [],
    previous: first
  });
  expect(second.messageCount === first.messageCount, 'messageCount divergente');
  return `tone=${second.tone}`;
});

// ---------------------------------------------------------------------------
console.log(`\nResultado: ${passed} ok, ${failed} fallos\n`);
if (failed > 0) process.exit(1);
