import {
  AlertTriangle,
  BookOpen,
  Brain,
  Headphones,
  Inbox,
  LayoutDashboard,
  Library,
  type LucideIcon,
  Mic,
  PenLine,
  PlusCircle,
  UserRound,
} from 'lucide-react';

/** Una sección de la app: ruta, texto del menú y qué grupo de tareas la construye. */
export interface Section {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Descripción corta que se muestra mientras la pantalla está en construcción. */
  description: string;
  /** Grupo de tasks.md que implementa la pantalla. */
  group: number;
}

export const MAIN_SECTIONS: Section[] = [
  { path: '/', label: 'Panel', icon: LayoutDashboard, group: 17,
    description: 'Tu racha, el estado de tu vocabulario y lo que te toca repasar hoy.' },
  { path: '/review', label: 'Repasar', icon: Brain, group: 16,
    description: 'Sesión Anki a pantalla completa, operable solo con el teclado.' },
  { path: '/inbox', label: 'Inbox', icon: Inbox, group: 11,
    description: 'Las palabras que capturaste con la extensión, listas para curar.' },
  { path: '/words/new', label: 'Nueva palabra', icon: PlusCircle, group: 11,
    description: 'Formulario rápido para añadir una palabra a mano.' },
  { path: '/library', label: 'Biblioteca', icon: Library, group: 15,
    description: 'Todo lo que has guardado, con búsqueda, filtros y Modo Archivo.' },
];

export const SKILL_SECTIONS: Section[] = [
  { path: '/errors', label: 'Errores', icon: AlertTriangle, group: 12,
    description: 'Tu Muro de Errores Fosilizados: frase incorrecta, correcta y nota.' },
  { path: '/speaking', label: 'Speaking', icon: Mic, group: 13,
    description: 'Graba monólogos de 3, 5 o 10 minutos y vuelve a escucharte.' },
  { path: '/writing', label: 'Writing', icon: PenLine, group: 14,
    description: 'Tus textos con su historial de versiones corregidas.' },
  { path: '/listening', label: 'Listening', icon: Headphones, group: 14,
    description: 'Retos de escucha con enlace y tu transcripción.' },
];

export const ACCOUNT_SECTIONS: Section[] = [
  { path: '/profile', label: 'Perfil', icon: UserRound, group: 10,
    description: 'Tu nombre, tu zona horaria y los tokens de la extensión.' },
];

export const ALL_SECTIONS = [...MAIN_SECTIONS, ...SKILL_SECTIONS, ...ACCOUNT_SECTIONS];

export const BRAND_ICON = BookOpen;
