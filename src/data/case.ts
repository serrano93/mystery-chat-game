import type { Contact, Evidence, Option, Solution } from '../types';

export const EVIDENCE: Record<string, Evidence> = {
  statue_dust: {
    id: 'statue_dust',
    title: 'Base de la estatua',
    description: 'Huellas parciales y restos de cera de vela del estudio.',
    hint: 'La estatua estuvo en el estudio.',
    icon: 'sparkles',
    effects: {
      victor: 18,
      butler: 3
    }
  },
  footprint: {
    id: 'footprint',
    title: 'Huella de bota',
    description: 'Marca de bota pesada junto al ventanal del estudio.',
    hint: 'Alguien con botas como las de Víctor estuvo cerca.',
    icon: 'footprints',
    effects: {
      victor: 16,
      gardener: 3
    }
  },
  watch_chain: {
    id: 'watch_chain',
    title: 'Cadena de reloj',
    description: 'Fragmento dorado encontrado cerca de la puerta del estudio.',
    hint: 'Perteneció a alguien que forcejeó allí.',
    icon: 'watch',
    effects: {
      victor: 15,
      cook: 3
    }
  },
  letter: {
    id: 'letter',
    title: 'Carta amenazante',
    description: 'Víctor amenazaba a Eduardo con arruinarlo si no cedía la sociedad.',
    hint: 'Móvil claro contra la víctima.',
    icon: 'mail',
    effects: {
      victor: 20,
      clara: 3
    }
  }
};

export const CONTACTS: Contact[] = [
  {
    id: 'inspector',
    name: 'Insp. García',
    role: 'Policía',
    bio: 'Tu contacto en la comisaría. Directo, cansado y profesional.',
    personality: 'Directo, serio, con prisa.',
    alibi: 'En comisaría revisando el informe preliminar.',
    temperament: 'calculated',
    opening:
      'Detective, han encontrado a Eduardo Vidal sin vida en el estudio. Necesito que hables con la casa. Empieza por el mayordomo, Sebastián.',
    color: 'from-blue-500 to-indigo-600',
    initiallyUnlocked: true,
    secrets: [
      {
        id: 'inspector_key',
        minTrust: 25,
        content:
          'La puerta del estudio estaba cerrada por dentro. Habla con Sebastián; él controla las llaves y los horarios de la casa.',
        unlocksContactId: 'butler'
      }
    ]
  },
  {
    id: 'butler',
    name: 'Sebastián',
    role: 'Mayordomo',
    bio: 'Sirve en la casa desde hace años. Formal, reservado y temeroso de perder su puesto.',
    personality: 'Formal, contenido, leal a la apariencia de la casa.',
    alibi: 'En la despensa revisando la plata y los horarios de cena.',
    temperament: 'formal',
    opening: 'Buenas noches. Soy Sebastián. ¿Necesita algo de la casa?',
    color: 'from-slate-600 to-zinc-800',
    secrets: [
      {
        id: 'butler_argument',
        minTrust: 35,
        content:
          'A las ocho oí a Víctor discutir con don Eduardo. Hablaban de una deuda y de la empresa.',
        unlocksContactId: 'gardener'
      },
      {
        id: 'butler_statue',
        minTrust: 65,
        content:
          'La estatua de bronce del vestíbulo falta desde anoche. Yo la pulí por la tarde; estaba en su peana.',
        evidenceId: 'statue_dust'
      }
    ]
  },
  {
    id: 'gardener',
    name: 'Pedro',
    role: 'Jardinero',
    bio: 'Trabaja fuera de la casa y ve más de lo que cree la gente.',
    personality: 'Nervioso, práctico, algo asustado.',
    alibi: 'En el invernadero hasta casi las diez.',
    temperament: 'nervous',
    opening: 'Perdone, estaba recogiendo herramientas. ¿Todo bien?',
    color: 'from-emerald-600 to-green-800',
    secrets: [
      {
        id: 'gardener_victor',
        minTrust: 45,
        content:
          'Vi a Víctor entrar al invernadero cerca de las nueve y cincuenta. Llevaba las botas embarradas y no era hora de trabajar.',
        unlocksContactId: 'cook'
      },
      {
        id: 'gardener_footprint',
        minTrust: 75,
        content:
          'Encontré esta huella junto al ventanal del estudio. Es de bota pesada, como las de Víctor.',
        evidenceId: 'footprint'
      }
    ]
  },
  {
    id: 'cook',
    name: 'Marta',
    role: 'Cocinera',
    bio: 'Conoce los hábitos de la casa y los silencios de sus habitantes.',
    personality: 'Cálida, observadora, protectora con los suyos.',
    alibi: 'En la cocina preparando la infusión de la noche.',
    temperament: 'warm',
    opening: 'Hola, detective. Espero que no sean malas noticias.',
    color: 'from-amber-500 to-orange-700',
    secrets: [
      {
        id: 'cook_tea',
        minTrust: 50,
        content:
          'Preparé tila para don Eduardo a las nueve y media. No olía a veneno; él la tomó sin problemas.',
        unlocksContactId: 'clara'
      },
      {
        id: 'cook_watch',
        minTrust: 80,
        content:
          'Oí un golpe seco sobre las diez y cinco. Después vi esta cadena de reloj dorada junto a la puerta del estudio.',
        evidenceId: 'watch_chain'
      }
    ]
  },
  {
    id: 'clara',
    name: 'Clara',
    role: 'Sobrina',
    bio: 'Estudiaba en la biblioteca cuando ocurrió todo. Tiene miedo, pero quiere justicia.',
    personality: 'Ansiosa, sincera a ratos, se asusta con facilidad.',
    alibi: 'En la biblioteca leyendo hasta tarde.',
    temperament: 'nervous',
    opening: '¿Eres el detective? Tengo miedo, pero hablaré.',
    color: 'from-fuchsia-500 to-purple-700',
    secrets: [
      {
        id: 'clara_saw_victor',
        minTrust: 60,
        content:
          'Desde la biblioteca vi a Víctor salir del estudio a las nueve y cincuenta y cinco con una estatua de bronce en las manos. Dijo que la llevaba al vestíbulo.',
        unlocksContactId: 'victor'
      },
      {
        id: 'clara_letter',
        minTrust: 85,
        content:
          'Encontré esta carta en la papelera. Víctor amenazaba a Eduardo con arruinarlo si no cedía la sociedad.',
        evidenceId: 'letter'
      }
    ]
  },
  {
    id: 'victor',
    name: 'Víctor',
    role: 'Socio',
    bio: 'Socio de Eduardo. Elegante, tenso y con mucho que perder.',
    personality: 'Hostil, calculador, orgulloso.',
    alibi: 'En el jardín fumando y aclarando ideas.',
    temperament: 'hostile',
    opening: 'No tengo nada que decirle a la policía.',
    color: 'from-rose-600 to-red-800',
    secrets: [
      {
        id: 'victor_near_study',
        minTrust: 70,
        content: 'Estuve cerca del estudio, sí. Pero solo fui a hablar con Eduardo. No le toqué.'
      },
      {
        id: 'victor_confession',
        minTrust: 88,
        content:
          'Vale... la estatua se me fue de las manos durante la discusión. No planeé matarlo. Lo dejé en el sofá y salí por la ventana.'
      }
    ]
  }
];

export const SUSPECTS: Option[] = CONTACTS.filter((c) => c.id !== 'inspector').map((c) => ({
  id: c.id,
  label: c.name
}));

export const WEAPONS: Option[] = [
  { id: 'candlestick', label: 'Candelabro' },
  { id: 'rope', label: 'Cuerda' },
  { id: 'knife', label: 'Cuchillo' },
  { id: 'statue', label: 'Estatua de bronce' },
  { id: 'poison', label: 'Veneno' }
];

export const ROOMS: Option[] = [
  { id: 'study', label: 'Estudio' },
  { id: 'library', label: 'Biblioteca' },
  { id: 'kitchen', label: 'Cocina' },
  { id: 'greenhouse', label: 'Invernadero' },
  { id: 'hall', label: 'Vestíbulo' }
];

export const SOLUTION: Solution = {
  suspectId: 'victor',
  weaponId: 'statue',
  roomId: 'study'
};
