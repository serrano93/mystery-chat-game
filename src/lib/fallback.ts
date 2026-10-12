import type { ConfrontationContext, ReplyContext, SecretFollowUpContext } from '../types';
import { includesAny, normalize } from './text';

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shorten(text: string, max = 180): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/(\s\S*)?$/, '')}…`;
}

/** Los nombres propios llegan normalizados (sin tildes ni mayúsculas). */
function proper(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const INSPECTOR_WARM = [
  'Vale, detective. Te ayudo porque me caes bien, no porque el caso esté fácil.',
  'Si fuera por mí, te daría café y una confesión, pero aquí todo huele a problema.',
  'No soy tu sidekick, pero hoy tengo paciencia. Pregunta.',
  'Me caes bien. No lo estropees con prisas.',
  'Tienes cara de no dormir. Aun así, te escucho.'
];

const INSPECTOR_NEUTRAL = [
  'Estamos en lo mismo, detective. No me hagas perder el tiempo.',
  'El caso está sucio. Anda con cuidado.',
  'Di lo que tengas. Yo decido si sirve.',
  'No soy de los que repiten favores. Úsalos bien.'
];

const PLAYFUL_GENERIC = [
  'No me hagas reír, que aún no he tomado café.',
  'Gracioso. Ahora vuelve al caso.',
  'Tienes humor para ser alguien con sangre en el expediente.',
  'Sigo sin reírme, pero casi.'
];

const COMFORT_RESPONSES = [
  'Gracias. No mucha gente habla así en esta casa.',
  'Eso ayuda, aunque no arregle nada.',
  'Vale. Baja un poco la guardia y te escucho.',
  'No sé si confiar, pero no me tratas como sospechoso. Eso cuenta.'
];

const THREAT_RESPONSES = [
  'No me hables así.',
  'Eso no te hace más fuerte, detective.',
  'Cruzas una línea y no me gusta.',
  'Si vienes con amenazas, cierras la puerta.'
];

const ACCUSATION_RESPONSES = [
  'No tienes prueba para eso.',
  'Estás disparando al aire.',
  'Si tanto sabes, demuéstralo.',
  'No voy a cargar con algo que no hice.'
];

const EVIDENCE_RESPONSES = [
  'Enséñalo, si de verdad es algo.',
  'Las pruebas mandan. Habla con ellas.',
  'Eso puede cambiar la conversación.',
  'No me sorprende que hayas encontrado algo.'
];

function temperamentDefault(ctx: ReplyContext): string {
  const trust = ctx.trust;
  const temperament = ctx.contact.temperament;

  if (temperament === 'formal') {
    return trust < 35
      ? 'Mis deberes me ocupaban. No tengo más que añadir.'
      : trust < 70
        ? 'Haré lo posible por ayudar, con calma.'
        : 'Le trataré con franqueza. Pregunte.';
  }

  if (temperament === 'nervous') {
    return trust < 35
      ? 'No me presione, por favor. Estoy asustado.'
      : trust < 70
        ? 'Creo que vi algo, pero no estoy seguro.'
        : 'Le contaré lo que sé. Usted me da tranquilidad.';
  }

  if (temperament === 'warm') {
    return trust < 35
      ? 'Entiendo su preocupación. No fue una noche fácil.'
      : trust < 70
        ? 'Le cuento lo que recuerdo. Había tensión en la casa.'
        : 'Confío en usted. Le diré lo que vi.';
  }

  if (temperament === 'hostile') {
    return trust < 35
      ? 'No tengo por qué darle explicaciones.'
      : trust < 70
        ? 'Hable rápido. No me gusta este interrogatorio.'
        : 'Está bien, pregunte. Pero no me mienta.';
  }

  return trust < 35
    ? 'Las apariencias engañan. Cuidado con lo que da por hecho.'
    : trust < 70
      ? 'Todo encaja, pero no del todo. Sigo escuchando.'
      : 'Usted es más listo de lo que pensaba. Vamos por buen camino.';
}

export function contextualFallback(ctx: ReplyContext): string {
  const norm = normalize(ctx.userMessage);
  const intent = ctx.analysis.intent;
  const tone = ctx.analysis.emotionalTone;
  const humor = ctx.contact.humor ?? 3;

  if (ctx.contact.id === 'inspector') {
    if (ctx.trust >= 30 || tone === 'playful') {
      if (intent === 'ask_alibi' || intent === 'ask_location') {
        return pick([
          'Yo estaba en comisaría, informando. Aburrido, pero coherente.',
          'Café, papeles y malas caras. Mi coartada es el aburrimiento.'
        ]);
      }

      if (intent === 'comfort' || intent === 'request_help') {
        return pick(INSPECTOR_WARM);
      }

      if (intent === 'joke') {
        return pick([
          'No se acostumbre, detective.',
          'Sigo sin reírme. Pero me caes mejor.',
          'Humor en una casa muerta. Me gusta.'
        ]);
      }

      return pick(INSPECTOR_WARM);
    }

    if (intent === 'comfort' || intent === 'request_help') {
      return pick(['No necesito consuelo. Necesito resultados.', 'Gracias. Ahora ve al grano.']);
    }

    return pick(INSPECTOR_NEUTRAL);
  }

  if (tone === 'playful' && humor >= 5) {
    return pick(PLAYFUL_GENERIC);
  }

  if (intent === 'confront' || intent === 'accuse') {
    if (ctx.trust < 35) return pick(ACCUSATION_RESPONSES);
    return pick([
      '¿Por qué sospechas de mí?',
      'No fue como lo pintas.',
      'Si tanto dudas, mira también a los demás.'
    ]);
  }

  if (intent === 'threaten') {
    return pick(THREAT_RESPONSES);
  }

  if (intent === 'comfort') {
    return pick(COMFORT_RESPONSES);
  }

  if (intent === 'ask_alibi') {
    const alibi = ctx.contact.alibi.toLowerCase();
    return pick([
      `Estaba ${alibi}.`,
      `Yo estaba ${alibi}, no me moví de ahí.`,
      `Puedo jurar que estaba ${alibi}.`
    ]);
  }

  if (intent === 'ask_location') {
    const place = ctx.analysis.mentioned.places[0];
    if (place) {
      return pick([
        `No fui al ${place}.`,
        `El ${place} no es sitio para mí esta noche.`,
        `Si alguien me vio cerca del ${place}, se equivocó.`
      ]);
    }
    return 'No salí de mi sitio. Al menos eso creo.';
  }

  if (intent === 'ask_time') {
    return pick([
      'No recuerdo la hora exacta.',
      'Sería tarde, pero no sabría decir.',
      'Las horas se me mezclaron anoche.'
    ]);
  }

  if (intent === 'ask_person') {
    // Un nombre propio puede ser el del propio interlocutor ("Marta, ¿qué
    // viste?"), no una pregunta sobre un tercero. Si el único nombre mencionado
    // es el suyo, se cae al comportamiento por defecto en lugar de responder
    // que no habló consigo mismo.
    const own = [ctx.contact.id, ctx.contact.name, ctx.contact.role]
      .map((value) => normalize(value))
      .join(' ');

    const person = ctx.analysis.mentioned.people.find((item) => !own.includes(item));

    if (person) {
      const name = proper(person);
      return pick([
        `No hablé con ${name}.`,
        `A ${name} lo vi de lejos, nada más.`,
        `No me junto con ${name} por las noches.`
      ]);
    }
  }

  if (intent === 'ask_weapon') {
    return pick([
      'No toqué ninguna arma.',
      'No quiero ni oír hablar de eso.',
      'Si hubo algo contundente, yo no lo moví.'
    ]);
  }

  if (intent === 'ask_evidence' || includesAny(norm, ['prueba', 'foto', 'carta', 'huella'])) {
    return pick(EVIDENCE_RESPONSES);
  }

  if (intent === 'request_help') {
    return ctx.trust >= 50
      ? 'Está bien. Le escucho con calma.'
      : 'No puedo ayudar mucho sin saber qué busca exactamente.';
  }

  return temperamentDefault(ctx);
}

export function fallbackConfrontation(ctx: ConfrontationContext): string {
  if (ctx.success) {
    const prefix =
      ctx.contact.temperament === 'hostile'
        ? 'Vale, sí.'
        : ctx.contact.temperament === 'nervous'
          ? 'Perdóname, es que...'
          : ctx.contact.temperament === 'warm'
            ? 'No quería preocuparte, pero...'
            : 'Debo admitir que...';

    return `${prefix} ${shorten(ctx.canonical.truth, 220)}`;
  }

  if (ctx.claim.truth === 'truth') {
    return `No miento. ${shorten(ctx.canonical.truth, 180)}`;
  }

  const prefix =
    ctx.contact.temperament === 'hostile'
      ? 'Sigue soñando.'
      : ctx.contact.temperament === 'nervous'
        ? '¡No es mentira!'
        : 'Esa es mi versión.';

  return `${prefix} ${shorten(ctx.canonical.lie, 180)}`;
}

export function fallbackSecretFollowUp(ctx: SecretFollowUpContext): string {
  const prefixes = [
    'Mira, una cosa...',
    'He estado dándole vueltas...',
    'Antes de que te vayas...',
    'Perdona, pero...',
    'No sé por qué te lo digo, pero...'
  ];

  if (ctx.contact.id === 'inspector') {
    prefixes.push('Vale, no se lo digas a nadie...');
    prefixes.push('Te lo digo porque me caes bien...');
  }

  return `${pick(prefixes)} ${shorten(ctx.secret.content, 220)}`;
}
