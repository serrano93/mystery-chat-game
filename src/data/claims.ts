import type { ClaimTopic } from '../types';

export interface CanonicalClaim {
  topic: ClaimTopic;
  keywords: string[];
  lie: string;
  truth: string;
  evidenceId?: string;
  requiredTrust?: number;
}

export const TOPIC_LABELS: Record<ClaimTopic, string> = {
  alibi: 'su coartada',
  argument: 'la discusión',
  victor_greenhouse: 'a Víctor en el invernadero',
  tea: 'la infusión',
  watch: 'la cadena del reloj',
  saw_victor: 'lo que vio desde la biblioteca',
  letter: 'la carta amenazante',
  statue: 'la estatua de bronce',
  window: 'la ventana del estudio'
};

export const CLAIM_LIBRARY: Record<string, CanonicalClaim[]> = {
  butler: [
    {
      topic: 'argument',
      keywords: ['discusion', 'discutir', 'oiste', 'victor', 'eduardo', 'grito'],
      lie: 'No oí ninguna discusión. La casa estaba en silencio.',
      truth: 'A las ocho oí a Víctor discutir con don Eduardo. Hablaban de una deuda y de la empresa.',
      requiredTrust: 35
    },
    {
      topic: 'statue',
      keywords: ['estatua', 'bronce', 'peana', 'vestibulo', 'falta'],
      lie: 'La estatua siempre estuvo en el vestíbulo. No he movido nada.',
      truth: 'La estatua de bronce del vestíbulo falta desde anoche. Yo la pulé por la tarde; estaba en su peana.',
      evidenceId: 'statue_dust',
      requiredTrust: 65
    }
  ],
  gardener: [
    {
      topic: 'victor_greenhouse',
      keywords: ['victor', 'invernadero', 'botas', 'barro', 'vi'],
      lie: 'No vi a nadie cerca del invernadero. Estaba recogiendo herramientas.',
      truth: 'Vi a Víctor entrar al invernadero cerca de las nueve y cincuenta. Llevaba las botas embarradas y no era hora de trabajar.',
      evidenceId: 'footprint',
      requiredTrust: 45
    }
  ],
  cook: [
    {
      topic: 'tea',
      keywords: ['tila', 'infusion', 'cocina', 'beber', 'eduardo'],
      lie: 'Esa noche no preparé nada para don Eduardo.',
      truth: 'Preparé tila para don Eduardo a las nueve y media. No olía a veneno; él la tomó sin problemas.',
      requiredTrust: 50
    },
    {
      topic: 'watch',
      keywords: ['cadena', 'reloj', 'golpe', 'puerta', 'estudio'],
      lie: 'No oí ningún golpe ni vi esa cadena.',
      truth: 'Oí un golpe seco sobre las diez y cinco. Después vi esta cadena de reloj dorada junto a la puerta del estudio.',
      evidenceId: 'watch_chain',
      requiredTrust: 80
    }
  ],
  clara: [
    {
      topic: 'saw_victor',
      keywords: ['biblioteca', 'vi', 'ventana', 'estatua', 'victor'],
      lie: 'No vi nada desde la biblioteca. Estaba leyendo.',
      truth: 'Desde la biblioteca vi a Víctor salir del estudio a las nueve y cincuenta y cinco con una estatua de bronce en las manos.',
      requiredTrust: 60
    },
    {
      topic: 'letter',
      keywords: ['carta', 'papelera', 'amenaza', 'sociedad', 'arruinar'],
      lie: 'Esa carta no es de Víctor. Puede ser de cualquiera.',
      truth: 'Encontré esta carta en la papelera. Víctor amenazaba a Eduardo con arruinarlo si no cedía la sociedad.',
      evidenceId: 'letter',
      requiredTrust: 85
    }
  ],
  victor: [
    {
      topic: 'alibi',
      keywords: ['jardin', 'fumando', 'estuve', 'todo el tiempo', 'ideas'],
      lie: 'Estuve en el jardín todo el tiempo, aclarando ideas.',
      truth: 'Estuve cerca del estudio, sí. Pero solo fui a hablar con Eduardo. No le toqué.',
      requiredTrust: 70
    },
    {
      topic: 'statue',
      keywords: ['estatua', 'bronce', 'toque', 'manos', 'discusion'],
      lie: 'Nunca toqué esa estatua. No sé de qué hablas.',
      truth: 'La estatua se me fue de las manos durante la discusión. No planeé matarlo.',
      evidenceId: 'statue_dust',
      requiredTrust: 88
    },
    {
      topic: 'window',
      keywords: ['ventana', 'ventanal', 'sali', 'escapar', 'huir'],
      lie: 'No salí por la ventana. Eso es absurdo.',
      truth: 'Salí por el ventanal cuando todo se torció. Dejé a Eduardo en el sofá y me fui.',
      evidenceId: 'watch_chain',
      requiredTrust: 88
    }
  ]
};
