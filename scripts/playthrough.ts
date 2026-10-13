/**
 * Partida completa simulada (motor narrativo local / fallback).
 *
 * Reproduce el flujo real de useGameStore.handlePlayerMessage /
 * handleConfrontation / sendEvidence / accuse usando las mismas funciones
 * deterministas del juego, y transcribe TODO el texto necesario para resolver
 * el caso: mensajes, revelaciones, pruebas, mentiras registradas y final.
 *
 * Ejecutar:  npx esbuild scripts/playthrough.ts --bundle --platform=node \
 *              --format=esm --packages=external --outfile=.tmp/play.mjs \
 *            && node .tmp/play.mjs
 */

import { CONTACTS, EVIDENCE } from '../src/data/case';
import { INITIAL_MISSIONS } from '../src/data/missions';
import { detectConfrontation, maybeRecordClaim } from '../src/lib/claims';
import { evaluateEnding, isCorrectAccusation } from '../src/lib/endings';
import { contextualFallback, fallbackConfrontation, fallbackSecretFollowUp } from '../src/lib/fallback';
import { analyzeTurn } from '../src/lib/intents';
import { analyzeMessage, clampTrust, contactMap } from '../src/lib/logic';
import { createHeuristicMemory } from '../src/lib/memory';
import { processMissions, type MissionProcessInput } from '../src/lib/missions';
import { getAvailableSecrets, pickSecretToReveal } from '../src/lib/secrets';
import { buildSuggestions } from '../src/lib/suggestions';
import type { Claim, ContactState, Message, Secret } from '../src/types';

const PLAYER = 'Detective';

// El motor local elige frases con Math.random(); se fija una semilla para que
// la transcripción de esta partida sea reproducible.
{
  let rngState = 42;
  const realRandom = Math.random;
  Math.random = () => {
    rngState = (rngState * 1103515245 + 12345) % 2147483648;
    return rngState / 2147483648 || realRandom();
  };
}

// --- estado ---------------------------------------------------------------

let idSeq = 0;
const uid = () => `m${++idSeq}`;
const now = () => Date.now();

const contacts: Record<string, ContactState> = {};
const messages: Record<string, Message[]> = {};
const unread: Record<string, number> = {};

for (const c of CONTACTS) {
  const unlocked = Boolean(c.initiallyUnlocked);
  contacts[c.id] = { unlocked, trust: unlocked ? 18 : 0 };
  messages[c.id] = unlocked
    ? [{ id: uid(), role: 'npc', content: c.opening.replace(/\{playerName\}/g, PLAYER), timestamp: now(), status: 'read' }]
    : [];
  unread[c.id] = unlocked ? 1 : 0;
}

let revealedSecretIds: string[] = [];
let evidenceOwned: string[] = [];
let claims: Claim[] = [];
let missions = INITIAL_MISSIONS.map((m) => ({ ...m, active: m.activation.kind === 'start', completed: false }));
let solved = false;
let gameOver = false;
let failedAttempts = 0;
let endingId: string | null = null;
const memories: Record<string, ReturnType<typeof createHeuristicMemory>> = {};

// --- helpers de transcription ---------------------------------------------

const label: Record<string, string> = Object.fromEntries(
  CONTACTS.map((c) => [c.id, `${c.name} (${c.role})`])
);

function emit(contactId: string, m: Message) {
  const who =
    m.role === 'user' ? `TÚ → ${label[contactId] ?? contactId}` :
    m.role === 'system' ? '── SISTEMA' :
    `${label[contactId] ?? contactId} →`;
  const att = m.attachment ? ` 📎[${m.attachment.title}]` : '';
  console.log(`${who}: ${m.content}${att}`);
}

function pushNpc(contactId: string, content: string) {
  const m: Message = { id: uid(), role: 'npc', content, timestamp: now(), status: 'read' };
  messages[contactId].push(m);
  emit(contactId, m);
}

function syncMissions() {
  const input: MissionProcessInput = {
    missions, messages, contacts, evidenceOwned, unread,
    revealedSecretIds, claims, solved, activeContactId: null
  };
  const before = new Map(missions.map((m) => [m.id, m]));
  const out = processMissions(input);
  missions = out.missions;
  Object.assign(messages, out.messages);
  Object.assign(contacts, out.contacts);
  evidenceOwned = out.evidenceOwned;
  for (const m of missions) {
    const old = before.get(m.id);
    if (old && !old.active && m.active) console.log(`   ▶ Misión activada: ${m.title} — ${m.description}`);
    if (old && !old.completed && m.completed) console.log(`   ✅ Misión completada: ${m.title}`);
  }
}

function applySecretReveal(contactId: string, secret: Secret) {
  if (!revealedSecretIds.includes(secret.id)) revealedSecretIds.push(secret.id);
  if (secret.evidenceId && !evidenceOwned.includes(secret.evidenceId)) {
    evidenceOwned.push(secret.evidenceId);
    console.log(`   🔎 PRUEBA OBTENIDA: ${EVIDENCE[secret.evidenceId].title} — ${EVIDENCE[secret.evidenceId].description} (pista: ${EVIDENCE[secret.evidenceId].hint})`);
  }
  if (secret.unlocksContactId && !contacts[secret.unlocksContactId]?.unlocked) {
    const targetId = secret.unlocksContactId;
    const def = contactMap[targetId];
    contacts[targetId] = { unlocked: true, trust: 15 };
    messages[targetId].push({ id: uid(), role: 'npc', content: def.opening.replace(/\{playerName\}/g, PLAYER), timestamp: now(), status: 'read' });
    messages[contactId].push({ id: uid(), role: 'system', content: `Nuevo contacto desbloqueado: ${def.name}.`, timestamp: now() });
    console.log(`   🔓 CONTACTO DESBLOQUEADO: ${def.name} (${def.role})`);
    emit(targetId, messages[targetId][messages[targetId].length - 1]);
  }
}


/** Mismo umbral de revelación que pickSecretToReveal (score >= 75), sin RNG. */
function revealIfAvailable(contactId: string, secretIds: string[]) {
  const contact = contactMap[contactId];
  const trust = contacts[contactId].trust;
  for (const id of secretIds) {
    if (revealedSecretIds.includes(id)) continue;
    const secret = contact.secrets.find((x) => x.id === id);
    if (!secret || trust < secret.minTrust) continue;
    const kw = getAvailableSecrets(contact, trust, revealedSecretIds).some((x) => x.id === id);
    if (!kw) continue;
    const followUp = fallbackSecretFollowUp({ contact, playerName: PLAYER, secret, trust, memory: memories[contactId] });
    pushNpc(contactId, followUp);
    console.log(`   🤫 SECRETO REVELADO (${secret.id}, minTrust ${secret.minTrust}): ${secret.content}`);
    applySecretReveal(contactId, secret);
    refreshMemory(contactId);
    syncMissions();
  }
}

function refreshMemory(contactId: string) {
  memories[contactId] = createHeuristicMemory({
    contact: contactMap[contactId],
    history: messages[contactId],
    trust: contacts[contactId].trust,
    claims: claims.filter((c) => c.contactId === contactId),
    previous: memories[contactId]
  });
}

// --- núcleo (espejo de useGameStore) ---------------------------------------

function turn(contactId: string, text: string, opts?: { evidenceId?: string }) {
  const contact = contactMap[contactId];
  const st = contacts[contactId];

  const confrontation = opts?.evidenceId ? null : detectConfrontation({
    text, contactId, claims, evidenceOwned, contacts
  });

  if (confrontation) {
    const { claim, canonical, success, evidenceUsed } = confrontation;
    const delta = success ? (evidenceUsed ? 9 : 5) : claim.truth === 'truth' ? -9 : -15;
    const newTrust = clampTrust(st.trust + delta);
    const userMsg: Message = { id: uid(), role: 'user', content: text, timestamp: now(), status: 'sent' };
    messages[contactId].push(userMsg);
    emit(contactId, userMsg);
    contacts[contactId] = { ...st, trust: newTrust };

    const reply = fallbackConfrontation({
      contact, playerName: PLAYER, trust: newTrust, claim, canonical, success, evidenceUsed,
      memory: memories[contactId], history: messages[contactId].slice(0, -1)
    });
    pushNpc(contactId, reply);

    if (success) {
      claims = claims.map((c) => (c.id === claim.id ? { ...c, exposed: true } : c));
      console.log(`   💥 MENTIRA EXPUESTA: ${contact.name} sobre «${claim.topic}»`);
    }
    refreshMemory(contactId);
    syncMissions();
    console.log(`   (confianza ${contact.name}: ${newTrust})\n`);
    return;
  }

  const analysis = analyzeMessage(text, contact, opts?.evidenceId);
  const turnA = analyzeTurn(text, opts?.evidenceId);
  const newTrust = clampTrust(st.trust + analysis.trustDelta);

  const userMsg: Message = {
    id: uid(), role: 'user', content: text, timestamp: now(), status: 'sent',
    attachment: opts?.evidenceId
      ? { kind: 'evidence', evidenceId: opts.evidenceId, title: EVIDENCE[opts.evidenceId].title, description: EVIDENCE[opts.evidenceId].description, icon: EVIDENCE[opts.evidenceId].icon }
      : undefined
  };
  messages[contactId].push(userMsg);
  emit(contactId, userMsg);
  contacts[contactId] = { ...st, trust: newTrust };

  const historyBefore = messages[contactId].slice(0, -1);
  const reply = contextualFallback({
    contact, playerName: PLAYER, trust: newTrust, history: historyBefore,
    userMessage: text, analysis: turnA, memory: memories[contactId],
    claims: claims.filter((c) => c.contactId === contactId),
    availableSecrets: getAvailableSecrets(contact, newTrust, revealedSecretIds),
    activeMission: missions.find((m) => m.active && !m.completed),
    evidenceOwned, tier: 'small', attachmentTitle: userMsg.attachment?.title
  });
  pushNpc(contactId, reply);

  const claim = maybeRecordClaim({ contact, reply, tags: turnA.tags, trust: newTrust, evidenceOwned, claims });
  if (claim) {
    claims.push(claim);
    console.log(`   🗒 AFIRMACIÓN REGISTRADA [${claim.topic}] verdad=${claim.truth}: "${claim.statement}"`);
  }

  const userTurns = messages[contactId].filter((m) => m.role === 'user').length;
  const secret = pickSecretToReveal({
    contact, trust: newTrust, revealedIds: revealedSecretIds,
    analysis: turnA, userMessage: text, userTurns
  });
  if (secret) {
    const followUp = fallbackSecretFollowUp({ contact, playerName: PLAYER, secret, trust: newTrust, memory: memories[contactId] });
    pushNpc(contactId, followUp);
    console.log(`   🤫 SECRETO REVELADO (${secret.id}, minTrust ${secret.minTrust}): ${secret.content}`);
    applySecretReveal(contactId, secret);
  }

  refreshMemory(contactId);
  syncMissions();
  console.log(`   (confianza ${contact.name}: ${newTrust})\n`);
}


function sendEvidence(contactId: string, evidenceId: string) {
  const evidence = EVIDENCE[evidenceId];
  const content = `Te muestro una prueba: ${evidence.title}.`;
  turn(contactId, content, { evidenceId });
}

function showSuggestions(contactId: string) {
  const s = buildSuggestions({
    contact: contactMap[contactId],
    trust: contacts[contactId].trust,
    revealedSecretIds,
    claims,
    evidenceOwned,
    sentEvidenceIds: [],
    seed: messages[contactId].filter((m) => m.role === 'user').length
  });
  if (s.length) {
    console.log(`   💡 Sugerencias: ${s.map((x) => x.kind === 'say' ? `"${x.text}"` : `[enviar prueba: ${EVIDENCE[x.evidenceId].title}]`).join(' | ')}`);
  }
}

// ===========================================================================
console.log('================ PARTIDA COMPLETA (motor local determinista) ================\n');
console.log(`CASO: ${'Eduardo Vidal amaneció muerto en el estudio de la mansión. La puerta estaba cerrada por dentro y toda la casa sabe algo, pero calla.'}\n`);

// ---- Insp. García ----
console.log('—— Chat con Insp. García ——');
showSuggestions('inspector');
turn('inspector', '¿Por dónde empiezo, inspector? Necesito tu ayuda con el caso.');
turn('inspector', 'Gracias por el tiempo. Solo quiero entender el caso.');

// ---- Sebastián (mayordomo) ----
console.log('\n—— Chat con Sebastián (mayordomo) ——');
showSuggestions('butler');
turn('butler', 'Buenas noches. ¿Se oyó alguna discusión anoche en la casa?');
turn('butler', 'Comprendo su interés, aunque preferiría no especular. No pretendo molestarle. ¿Me cuenta qué pasó, por favor?');
turn('butler', 'Entiendo que sea difícil. ¿Falta algo de la casa? ¿La estatua del vestíbulo?');
turn('butler', 'Le agradezco su franqueza, confío en usted. Comprendo lo difícil que es traicionar a la casa. ¿Me cuenta más, por favor?');
turn('butler', 'Entiendo perfectamente, no diré quién me lo contó. Gracias por confiar en mí.');
revealIfAvailable('butler', ['butler_statue']);
// (el mayordomo ya supera el umbral de confianza 65: suelta la estatua)

// ---- Pedro (jardinero) ----
console.log('\n—— Chat con Pedro (jardinero) ——');
showSuggestions('gardener');
turn('gardener', 'Tranquilo, no está en problemas. Solo quiero ayudarle.');
turn('gardener', 'Entiendo que tenga miedo. Cuénteme con calma, por favor. ¿Viste a Víctor cerca del invernadero?');
turn('gardener', 'Tranquilo, le escucho con calma. ¿Notaste alguna huella de bota junto al ventanal?');
turn('gardener', 'Tranquilo, te creo, nadie te acusa. Respira, estoy de tu lado, amigo.');
turn('gardener', 'Gracias por decirme la verdad, te lo agradezco de corazón. Descansa, tranquilo.');
revealIfAvailable('gardener', ['gardener_footprint']);

// ---- Marta (cocinera) ----
console.log('\n—— Chat con Marta (cocinera) ——');
showSuggestions('cook');
turn('cook', 'Gracias por hablar conmigo. Entiendo que no es fácil.');
turn('cook', 'Sé que esto es duro. Gracias por contármelo, te escucho con calma. ¿Le llevaste la infusión a don Eduardo esa noche?');
turn('cook', 'Gracias, de verdad, entiendo que protejas a los tuyos. Te apoyo. ¿Oíste algún golpe en la puerta del estudio? ¿Viste esa cadena dorada?');
turn('cook', 'Gracias por tu honestidad, te admiro. Tranquila, entiendo que no es fácil. ¿Oíste algún golpe cerca de la puerta del estudio?');
revealIfAvailable('cook', ['cook_watch']);

// ---- Clara (sobrina) ----
console.log('\n—— Chat con Clara (sobrina) ——');
showSuggestions('clara');
turn('clara', 'Tranquilo, no está en problemas. Solo quiero ayudarle.');
turn('clara', 'Entiendo que tenga miedo. Cuénteme con calma, por favor. ¿Viste algo desde la biblioteca?');
turn('clara', 'Gracias, eres muy valiente. Confío en ti, tranquila. ¿Encontraste alguna carta en la papelera?');
revealIfAvailable('clara', ['clara_saw_victor', 'clara_letter']);
turn('clara', 'Gracias, tranquila, ya casi terminamos. Cuéntame lo de la carta en la papelera, por favor.');
turn('clara', 'Respira, confío del todo en ti, amiga. ¿Encontraste alguna carta en la papelera?');
revealIfAvailable('clara', ['clara_letter']);

// ---- Pedro (huella de bota, necesaria antes de hablar con Víctor) ----

// ---- Víctor (socio) ----
console.log('\n—— Chat con Víctor (socio) ——');
showSuggestions('victor');
turn('victor', '¿Dónde estabas anoche exactamente? ¿Estuviste en el jardín todo el tiempo?');
sendEvidence('victor', 'statue_dust');
sendEvidence('victor', 'footprint');
sendEvidence('victor', 'watch_chain');
sendEvidence('victor', 'letter');
revealIfAvailable('victor', ['victor_near_study']);
turn('victor', 'Tengo la base de la estatua con cera del estudio y tú dijiste que no la tocaste. Mentiste.');
showSuggestions('victor');
turn('victor', 'No vengo a acusarte. ¿Qué pasó con la estatua durante la discusión?');
revealIfAvailable('victor', ['victor_confession']);

// ---- Confrontación de la coartada (segunda mentira de Víctor) ----
turn('victor', 'Antes dijiste que estuviste en el jardín todo el tiempo. Eso es mentira.');

// ---- Acusación final ----
console.log('\n—— ACUSACIÓN FINAL ——');
const accusation = { suspectId: 'victor', weaponId: 'statue', roomId: 'study' };
const correct = isCorrectAccusation(accusation);
const ending = evaluateEnding(accusation, { revealedSecretIds, evidenceOwned, claims, contacts }, correct);
endingId = ending.id; solved = correct; gameOver = true;
console.log(`Solución presentada: VÍCTOR — ESTATUA DE BRONCE — ESTUDIO. Correcta: ${correct}`);
console.log(`FINAL ${ending.subtitle}: ${ending.title} — ${ending.description}`);

// ---- Resumen de evidencia recogida ----
console.log('\n================ RESUMEN =================');
console.log(`Pruebas: ${evidenceOwned.map((e) => EVIDENCE[e].title).join(', ') || 'ninguna'}`);
console.log(`Secretos revelados (${revealedSecretIds.length}/${CONTACTS.flatMap((c) => c.secrets).length}): ${revealedSecretIds.join(', ')}`);
console.log(`Mentiras expuestas: ${claims.filter((c) => c.exposed).map((c) => `${contactMap[c.contactId].name}:${c.topic}`).join(', ') || 'ninguna'}`);
console.log(`Misiones completadas: ${missions.filter((m) => m.completed).length}/${missions.length}`);
