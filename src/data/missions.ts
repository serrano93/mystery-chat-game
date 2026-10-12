import type { Mission } from '../types';

export const INITIAL_MISSIONS: Mission[] = [
  {
    id: 'm_open_case',
    title: 'Abrir el caso',
    description: 'Saca la primera instrucción al inspector García.',
    objective: { kind: 'trust', contactId: 'inspector', value: 25 },
    activation: { kind: 'start' },
    active: true,
    completed: false,
    reward: {
      message: 'Bien. Empieza por Sebastián. Él controla las llaves y los horarios de la casa.'
    }
  },
  {
    id: 'm_butler',
    title: 'El mayordomo',
    description: 'Gana la confianza mínima de Sebastián.',
    objective: { kind: 'trust', contactId: 'butler', value: 35 },
    activation: { kind: 'contact_unlocked', id: 'butler' },
    active: false,
    completed: false,
    reward: {
      message: 'Sebastián empieza a hablar. Ahora busca la huella del jardín.'
    }
  },
  {
    id: 'm_footprint',
    title: 'Una huella rara',
    description: 'Consigue la huella de bota.',
    objective: { kind: 'evidence', evidenceId: 'footprint' },
    activation: { kind: 'secret_revealed', id: 'butler_argument' },
    active: false,
    completed: false,
    reward: {
      trust: { gardener: 5 },
      message: 'Pedro se relaja un poco más. Sigue presionando con calma.'
    }
  },
  {
    id: 'm_cook',
    title: 'La infusión',
    description: 'Habla con Marta y descubre lo de la cadena.',
    objective: { kind: 'secret', secretId: 'cook_watch' },
    activation: { kind: 'contact_unlocked', id: 'cook' },
    active: false,
    completed: false,
    reward: {
      message: 'Marta te ha dado un detalle crucial. La cadena no estaba allí por casualidad.'
    }
  },
  {
    id: 'm_clara',
    title: 'Testigo asustada',
    description: 'Consigue que Clara recuerde lo que vio.',
    objective: { kind: 'secret', secretId: 'clara_saw_victor' },
    activation: { kind: 'secret_revealed', id: 'cook_tea' },
    active: false,
    completed: false,
    reward: {
      trust: { clara: 5 },
      message: 'Clara está más dispuesta a ayudarte. No la asustes.'
    }
  },
  {
    id: 'm_letter',
    title: 'El móvil',
    description: 'Encuentra la carta amenazante.',
    objective: { kind: 'evidence', evidenceId: 'letter' },
    activation: { kind: 'secret_revealed', id: 'clara_saw_victor' },
    active: false,
    completed: false,
    reward: {
      message:
        'Ahora tienes un móvil claro contra Víctor. Pero cuidado: un móvil no es una confesión.'
    }
  },
  {
    id: 'm_lie',
    title: 'Atrapar la mentira',
    description: 'Confronta a Víctor sobre la estatua.',
    objective: { kind: 'expose_claim', contactId: 'victor', topic: 'statue' },
    activation: { kind: 'contact_unlocked', id: 'victor' },
    active: false,
    completed: false,
    reward: {
      trust: { victor: 4 },
      message: 'Víctor se ha quebrado un poco. Ahora puedes buscar la confesión.'
    }
  },
  {
    id: 'm_confession',
    title: 'La confesión',
    description: 'Logra que Víctor admita la verdad.',
    objective: { kind: 'secret', secretId: 'victor_confession' },
    activation: { kind: 'claim_exposed', id: 'victor:statue' },
    active: false,
    completed: false,
    reward: {
      message: 'Si presentas cargos ahora, tendrás la verdad de su boca. No falles.'
    }
  },
  {
    id: 'm_final',
    title: 'Acusación final',
    description: 'Resuelve el caso: asesino, arma y lugar.',
    objective: { kind: 'accusation_correct' },
    activation: { kind: 'evidence_collected', id: 'letter' },
    active: false,
    completed: false
  }
];
