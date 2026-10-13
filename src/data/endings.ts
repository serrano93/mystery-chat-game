import type { Ending } from '../types';

export const ENDINGS: Record<string, Ending> = {
  truth_uncovered: {
    id: 'truth_uncovered',
    title: 'La verdad destapada',
    subtitle: 'Final S',
    description:
      'No solo acusaste a Víctor: le arrancaste la confesión, expusiste sus mentiras y cerraste el caso con pruebas irrefutables. Eduardo por fin descansa.',
    grade: 'S',
    correct: true
  },
  confession: {
    id: 'confession',
    title: 'Confesión en el sofá',
    subtitle: 'Final A',
    description:
      'Víctor se quebró antes de la acusación final. Su confesión selló el caso, aunque faltaron algunos detalles por destapar.',
    grade: 'A',
    correct: true
  },
  iron_case: {
    id: 'iron_case',
    title: 'Caso cerrado con pruebas',
    subtitle: 'Final A-',
    description:
      'No obtuviste una confesión completa, pero acumulaste tantas pruebas que la acusación era inevitable.',
    grade: 'A-',
    correct: true
  },
  justice: {
    id: 'justice',
    title: 'Justicia fría',
    subtitle: 'Final B',
    description:
      'Resolviste el caso, pero lo hiciste justo a tiempo. La verdad salió, aunque algunos secretos se quedaron en la mansión.',
    grade: 'B',
    correct: true
  },
  wrongful: {
    id: 'wrongful',
    title: 'Acusación equivocada',
    subtitle: 'Final C',
    description:
      'Confiaste demasiado en alguien inocente y señalaste al sospechoso errado. La verdadera culpa sigue suelta.',
    grade: 'C',
    correct: false
  },
  misdirection: {
    id: 'misdirection',
    title: 'Te llevaron al jardín equivocado',
    subtitle: 'Final C-',
    description:
      'Hiciste buen trabajo, pero una mentira bien colocada te desvió. El asesino sonríe desde la sombra.',
    grade: 'C-',
    correct: false
  },
  cold_case: {
    id: 'cold_case',
    title: 'Caso frío',
    subtitle: 'Final D',
    description:
      'Agotaste los intentos sin reunir suficientes pruebas. La mansión guardará su secreto una noche más.',
    grade: 'D',
    correct: false
  }
};
