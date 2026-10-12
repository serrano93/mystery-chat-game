import type { Contact, Evidence, Option, Solution } from '../types';

export const CASE_BRIEF =
  'Eduardo Vidal amaneció muerto en el estudio de la mansión. La puerta estaba cerrada por dentro y toda la casa sabe algo, pero calla. El jugador investiga hablando por WhatsApp con sospechosos y testigos.';

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
    bio: 'Tu contacto en la comisaría. Directo, cansado, profesional, pero con humor seco cuando coge confianza.',
    personality:
      'Directo, serio, con prisa. Ironía profesional. No es bromista, pero si hay confianza suelta un guiño ácido.',
    alibi: 'En comisaría revisando el informe preliminar.',
    temperament: 'calculated',
    humor: 7,
    speechStyle: 'Frases cortas, tono cansado, ironía controlada, autoridad tranquila.',
    examples: [
      'No soy tu fan, {playerName}, pero hoy tengo café y paciencia.',
      'Si me das una prueba, te doy una dirección. Trato justo.',
      'Esto huele a problema caro, {playerName}. Anda con ojo.'
    ],
    opening:
      'Sé que te estás tomando un descanso, {playerName}, pero voy hasta arriba y necesito tu ayuda. No hace falta que vengas a comisaría; puedes adelantar las entrevistas por WhatsApp. Es poco convencional, pero no tenemos otra opción.',
    color: 'from-blue-500 to-indigo-600',
    initiallyUnlocked: true,
    secrets: [
      {
        id: 'inspector_key',
        minTrust: 25,
        content:
          'La puerta del estudio estaba cerrada por dentro. Habla con Sebastián; él controla las llaves y los horarios de la casa.',
        unlocksContactId: 'butler',
        keywords: [
          'empezar',
          'empiezo',
          'por donde',
          'instrucciones',
          'ayuda',
          'caso',
          'llaves',
          'estudio',
          'puerta',
          'sebastian'
        ]
      }
    ]
  },
  {
    id: 'butler',
    name: 'Sebastián',
    role: 'Mayordomo',
    bio: 'Sirve en la casa desde hace años. Formal, reservado y temeroso de perder su puesto.',
    personality: 'Formal, contenido, leal a la apariencia de la casa. Le cuesta mentir y se le nota.',
    alibi: 'En la despensa revisando la plata y los horarios de cena.',
    temperament: 'formal',
    humor: 2,
    speechStyle: 'Formal, contenido, educado. Casi nunca bromea. Mide las palabras.',
    examples: [
      'Comprendo su interés, aunque preferiría no especular.',
      'La casa guarda sus formas, detective. Yo también.',
      'No me gusta hablar de lo que oí, pero lo oí.'
    ],
    opening: 'Buenas noches. Soy Sebastián. ¿Necesita algo de la casa?',
    color: 'from-slate-600 to-zinc-800',
    secrets: [
      {
        id: 'butler_argument',
        minTrust: 35,
        content:
          'A las ocho oí a Víctor discutir con don Eduardo. Hablaban de una deuda y de la empresa.',
        unlocksContactId: 'gardener',
        keywords: [
          'ocho',
          'discutir',
          'discusion',
          'deuda',
          'empresa',
          'victor',
          'eduardo',
          'grito',
          'voz'
        ]
      },
      {
        id: 'butler_statue',
        minTrust: 65,
        content:
          'La estatua de bronce del vestíbulo falta desde anoche. Yo la pulí por la tarde; estaba en su peana.',
        evidenceId: 'statue_dust',
        keywords: ['estatua', 'bronce', 'vestibulo', 'peana', 'pulir', 'falta']
      }
    ]
  },
  {
    id: 'gardener',
    name: 'Pedro',
    role: 'Jardinero',
    bio: 'Trabaja fuera de la casa y ve más de lo que cree la gente.',
    personality: 'Nervioso, práctico, algo asustado. Se relaja si no se le presiona.',
    alibi: 'En el invernadero hasta casi las diez.',
    temperament: 'nervous',
    humor: 3,
    speechStyle: 'Nervioso, práctico, alguna gracia torpe cuando se relaja.',
    examples: [
      'Yo solo cuidaba las plantas, se lo juro.',
      'No quiero meterme en líos, pero vi algo raro.',
      'Si le digo la verdad, ¿me deja en paz?'
    ],
    opening: 'Perdone, estaba recogiendo herramientas. ¿Todo bien?',
    color: 'from-emerald-600 to-green-800',
    secrets: [
      {
        id: 'gardener_victor',
        minTrust: 45,
        content:
          'Vi a Víctor entrar al invernadero cerca de las nueve y cincuenta. Llevaba las botas embarradas y no era hora de trabajar.',
        unlocksContactId: 'cook',
        keywords: ['victor', 'invernadero', 'botas', 'barro', 'nueve', 'cincuenta', 'entrar']
      },
      {
        id: 'gardener_footprint',
        minTrust: 75,
        content:
          'Encontré esta huella junto al ventanal del estudio. Es de bota pesada, como las de Víctor.',
        evidenceId: 'footprint',
        keywords: ['huella', 'bota', 'ventanal', 'estudio', 'barro']
      }
    ]
  },
  {
    id: 'cook',
    name: 'Marta',
    role: 'Cocinera',
    bio: 'Conoce los hábitos de la casa y los silencios de sus habitantes.',
    personality: 'Cálida, observadora, protectora con los suyos. Se cierra si se siente acusada.',
    alibi: 'En la cocina preparando la infusión de la noche.',
    temperament: 'warm',
    humor: 4,
    speechStyle: 'Cálida, observadora, con humor doméstico y protector.',
    examples: [
      'Ay, detective, esta casa me va a quitar el sueño.',
      'Yo cocino para todos, incluso para quien no lo merece.',
      'No me haga elegir entre mi gente y la verdad.'
    ],
    opening: 'Hola, detective. Espero que no sean malas noticias.',
    color: 'from-amber-500 to-orange-700',
    secrets: [
      {
        id: 'cook_tea',
        minTrust: 50,
        content:
          'Preparé tila para don Eduardo a las nueve y media. No olía a veneno; él la tomó sin problemas.',
        unlocksContactId: 'clara',
        keywords: ['tila', 'infusion', 'nueve', 'media', 'eduardo', 'cocina', 'tomar']
      },
      {
        id: 'cook_watch',
        minTrust: 80,
        content:
          'Oí un golpe seco sobre las diez y cinco. Después vi esta cadena de reloj dorada junto a la puerta del estudio.',
        evidenceId: 'watch_chain',
        keywords: ['cadena', 'reloj', 'golpe', 'puerta', 'diez', 'dorada']
      }
    ]
  },
  {
    id: 'clara',
    name: 'Clara',
    role: 'Sobrina',
    bio: 'Estudiaba en la biblioteca cuando ocurrió todo. Tiene miedo, pero quiere justicia.',
    personality: 'Ansiosa, sincera a ratos, se asusta con facilidad y se corrige a media frase.',
    alibi: 'En la biblioteca leyendo hasta tarde.',
    temperament: 'nervous',
    humor: 3,
    speechStyle: 'Ansiosa, sincera a ratos, con sustos y sinceridad repentina.',
    examples: [
      'Es que si lo digo en voz alta, parece peor.',
      'No quiero acusar a nadie. Bueno, sí. Un poco.',
      'Perdón, me estoy liando. Pero lo vi.'
    ],
    opening: '¿Eres el detective? Tengo miedo, pero hablaré.',
    color: 'from-fuchsia-500 to-purple-700',
    secrets: [
      {
        id: 'clara_saw_victor',
        minTrust: 60,
        content:
          'Desde la biblioteca vi a Víctor salir del estudio a las nueve y cincuenta y cinco con una estatua de bronce en las manos. Dijo que la llevaba al vestíbulo.',
        unlocksContactId: 'victor',
        keywords: ['biblioteca', 'estudio', 'estatua', 'manos', 'victor', 'salir', 'bronce']
      },
      {
        id: 'clara_letter',
        minTrust: 85,
        content:
          'Encontré esta carta en la papelera. Víctor amenazaba a Eduardo con arruinarlo si no cedía la sociedad.',
        evidenceId: 'letter',
        keywords: ['carta', 'papelera', 'sociedad', 'arruinar', 'amenaza', 'amenazar']
      }
    ]
  },
  {
    id: 'victor',
    name: 'Víctor',
    role: 'Socio',
    bio: 'Socio de Eduardo. Elegante, tenso y con mucho que perder.',
    personality: 'Hostil, calculador, orgulloso. No soporta que le lean.',
    alibi: 'En el jardín fumando y aclarando ideas.',
    temperament: 'hostile',
    humor: 1,
    speechStyle: 'Hostil, elegante, sarcasmo helado. Nada de risitas.',
    examples: [
      'No soy tonto. Si tienes algo, suéltalo.',
      'Hablas mucho para alguien sin pruebas.',
      'Esto se acaba aquí. O no.'
    ],
    opening: 'No tengo nada que decirle a la policía.',
    color: 'from-rose-600 to-red-800',
    secrets: [
      {
        id: 'victor_near_study',
        minTrust: 70,
        content: 'Estuve cerca del estudio, sí. Pero solo fui a hablar con Eduardo. No le toqué.',
        keywords: ['estudio', 'hablar', 'eduardo', 'cerca', 'jardin', 'fumar']
      },
      {
        id: 'victor_confession',
        minTrust: 88,
        content:
          'Vale... la estatua se me fue de las manos durante la discusión. No planeé matarlo. Lo dejé en el sofá y salí por la ventana.',
        keywords: ['estatua', 'manos', 'discusion', 'confesar', 'sofa', 'ventana', 'planear']
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
