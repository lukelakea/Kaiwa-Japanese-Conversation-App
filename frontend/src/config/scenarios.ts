/**
 * Curated conversation scenarios (brief §5 — Scenarios mode).
 *
 * Data-driven: adding a new scenario is one object in this array.
 * The structure is purposely separate from the `Scenario` wire type so the UI
 * can carry extra metadata (id, hint, category) without polluting the API contract.
 */

import type { Scenario } from '../types/conversation';

export type ScenarioCategory = 'daily-life' | 'work' | 'social' | 'travel' | 'services';

export interface CuratedScenario {
  id: string;
  title: string;
  titleJa: string;
  /** Short phrase shown on the scenario card. */
  hint: string;
  description: string;
  userRole: string;
  aiRole: string;
  category: ScenarioCategory;
}

export const CURATED_SCENARIOS: CuratedScenario[] = [
  {
    id: 'restaurant',
    title: 'Ordering at a Restaurant',
    titleJa: 'レストランで注文する',
    hint: 'Ask for a table, order food and drinks',
    description:
      'A casual restaurant in Japan. The customer has just been seated and the waiter comes to take the order.',
    userRole: 'Customer (お客様)',
    aiRole: 'Waiter / Waitress (ウェイター)',
    category: 'daily-life',
  },
  {
    id: 'hotel-checkin',
    title: 'Hotel Check-In',
    titleJa: 'ホテルのチェックイン',
    hint: 'Check in, ask about amenities and the room',
    description:
      'The lobby of a business hotel. A guest arrives to check in and the front desk staff greets them.',
    userRole: 'Guest (ゲスト)',
    aiRole: 'Front Desk Staff (フロントスタッフ)',
    category: 'travel',
  },
  {
    id: 'job-interview',
    title: 'Job Interview',
    titleJa: '就職面接',
    hint: 'Answer questions about your background and goals',
    description:
      'A job interview at a Japanese company. The interviewer conducts a formal interview with the candidate.',
    userRole: 'Job Candidate (応募者)',
    aiRole: 'Interviewer (面接官)',
    category: 'work',
  },
  {
    id: 'coworker-smalltalk',
    title: 'Small Talk with a Coworker',
    titleJa: '同僚と雑談',
    hint: 'Chat about the weekend, hobbies, or work',
    description:
      'The office break room. Two colleagues catch up over coffee during a break.',
    userRole: 'Colleague (同僚)',
    aiRole: 'Colleague (同僚)',
    category: 'work',
  },
  {
    id: 'convenience-store',
    title: 'Convenience Store',
    titleJa: 'コンビニで買い物',
    hint: 'Buy something, ask about items or services',
    description:
      'A busy convenience store. The customer approaches the counter to buy something and the cashier helps.',
    userRole: 'Customer (お客様)',
    aiRole: 'Cashier (レジ係)',
    category: 'daily-life',
  },
  {
    id: 'directions',
    title: 'Asking for Directions',
    titleJa: '道を聞く',
    hint: 'Find your way to a station, landmark, or shop',
    description:
      'On a street in Japan. A passerby stops to ask a local for directions to a nearby place.',
    userRole: 'Visitor asking for help (道を聞く人)',
    aiRole: 'Local resident (地元の人)',
    category: 'travel',
  },
  {
    id: 'party-meeting',
    title: 'Meeting Someone at a Party',
    titleJa: 'パーティーで初対面',
    hint: 'Introduce yourself and make conversation',
    description:
      'A casual house party. Two people who have never met before start talking and get to know each other.',
    userRole: 'Party guest',
    aiRole: 'Party guest (パーティー参加者)',
    category: 'social',
  },
  {
    id: 'doctors-visit',
    title: "Visiting the Doctor",
    titleJa: '病院で診察',
    hint: 'Describe symptoms and understand the doctor\'s advice',
    description:
      "A clinic in Japan. The doctor sees a patient, asks about their symptoms, and explains a diagnosis.",
    userRole: 'Patient (患者)',
    aiRole: 'Doctor (医師)',
    category: 'services',
  },
  {
    id: 'izakaya',
    title: 'Evening at an Izakaya',
    titleJa: '居酒屋で一杯',
    hint: 'Order drinks and food, chat with the staff',
    description:
      'A lively izakaya after work. A customer comes in alone and the friendly staff strikes up conversation.',
    userRole: 'Customer (お客様)',
    aiRole: 'Izakaya staff (店員)',
    category: 'social',
  },
  {
    id: 'shopping-clothes',
    title: 'Shopping for Clothes',
    titleJa: '洋服を買いに行く',
    hint: 'Ask about sizes, colours, and try things on',
    description:
      'A clothing shop. A customer browses and a shop assistant offers to help find what they need.',
    userRole: 'Customer (お客様)',
    aiRole: 'Shop Assistant (店員)',
    category: 'services',
  },
];

/** Convert a curated scenario to the API wire format. */
export function toWireScenario(s: CuratedScenario): Scenario {
  return {
    title: s.title,
    title_ja: s.titleJa,
    description: s.description,
    user_role: s.userRole,
    ai_role: s.aiRole,
  };
}
