export const CONTEST_NAME = process.env.NEXT_PUBLIC_CONTEST_NAME || 'TruRisk Pitch & Demo Contest'

export const TEAMS = [
  { name: 'Krisy and the Risky Biscuits', member: 'Kristin Wade' },
  { name: 'The Barbell Baddies',               member: 'Ashley Leabsher' },
  { name: 'Team Blitz',                   member: 'Ashley Estrade' },
  { name: 'Team Pop',                     member: 'Sean Ireland' },
  { name: 'Re-Rate Rangers',              member: 'Christin Merkel' },
]

export const METRICS = [
  {
    id: 'pkc',
    name: 'Product Knowledge & Clarity',
    desc: 'Does the presenter clearly understand the product and communicate its value?',
    weight: 0.30,
  },
  {
    id: 'sn',
    name: 'Storytelling & Narrative',
    desc: 'Is there a compelling narrative arc with a clear hook and resolution?',
    weight: 0.25,
  },
  {
    id: 'ed',
    name: 'Energy & Delivery',
    desc: 'Confidence, pace, energy, and engagement with the audience.',
    weight: 0.25,
  },
  {
    id: 'dfv',
    name: 'Demo Flow & Visuals',
    desc: 'Is the demo smooth, well-paced, and visually effective?',
    weight: 0.20,
  },
]

export const JUDGE_NAMES = ['Parker', 'Laura', 'Jon', 'Tyler']

export const AI_WEIGHT    = 0.30
export const JUDGE_WEIGHT = 0.70
