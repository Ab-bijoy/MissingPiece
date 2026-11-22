import {
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CreditCard,
  FileCheck2,
  Inbox,
  MailCheck,
  MessageSquareText,
  ShieldCheck,
  Undo2,
} from 'lucide-react'
import RoleLanding, { type RoleContent } from './RoleLanding'

// Note: the reviews are sample quotes for the demo. Replace them with real ones.
const content: RoleContent = {
  theme: {
    heroBg: 'bg-paper',
    heroTitle: 'text-brand',
    heroText: 'text-ink-soft',
    eyebrow: 'text-teal',
    ribbon: '#508B8B',
    primaryBtn: 'bg-brand text-sand-light hover:bg-brand-dark',
    secondaryBtn: 'text-brand ring-brand/50 hover:bg-brand/5',
    band: 'bg-deep',
    bandNumber: 'text-sand',
    iconTile: 'bg-teal/15 text-deep',
    quoteMark: 'text-teal',
    ctaCard: 'bg-deep',
    ctaTitle: 'text-white',
    ctaText: 'text-sand-light/85',
    ctaBtn: 'bg-coral text-ink hover:bg-sand',
    ctaLink: 'text-sand-light',
    piece: 'fill-teal/40',
  },
  eyebrow: 'For sponsors',
  headline: ['GIVE', 'WHERE', 'IT', 'COUNTS'],
  intro:
    'Get clear requests from verified clubs, NGOs and community groups. Offer exactly what a project needs, and see it arrive.',
  primary: { label: 'Become a sponsor', to: '/sponsor/register' },
  secondary: { label: 'Sponsor log in', to: '/sponsor/login' },
  features: [
    {
      Icon: Inbox,
      title: 'Requests that fit you',
      body: 'Tell us what you like to give and where. Organizers send requests that match your company profile.',
    },
    {
      Icon: MessageSquareText,
      title: 'Talk it through',
      body: 'Every request opens a message thread with the organizer, so you can agree on details before you offer.',
    },
    {
      Icon: CreditCard,
      title: 'Pay with the fee shown',
      body: 'For money offers you see the amount, the 5% fee and the total before you pay. Nothing hidden.',
    },
    {
      Icon: BarChart3,
      title: 'An impact report',
      body: 'After the event, see totals of what was received and which promised benefits were given to you.',
    },
  ],
  stepsTitle: 'From request to real impact',
  steps: [
    {
      title: 'Set up your profile',
      body: 'Add your industry, interests, the kinds of help you give, and your location. Better profiles get better requests.',
    },
    {
      title: 'Read your inbox',
      body: 'Each request shows the project, the exact need, the benefits on offer and the dates to decide and deliver by.',
    },
    {
      title: 'Make an offer',
      body: 'Offer the whole need with any conditions. Then follow it from offered to accepted to received.',
    },
    {
      title: 'Pay and see results',
      body: 'Pay money offers through MissingPiece. Once everything arrives, read the report and check your benefits.',
    },
  ],
  reviews: [
    {
      quote:
        'Instead of a vague "please sponsor us" email, we got a request for one projector on one date. We said yes in a minute.',
      name: 'Arif',
      role: 'CSR lead, Example Software Co.',
    },
    {
      quote:
        'Seeing the 5% fee before paying made it easy to get finance to approve. The project got exactly the amount we promised.',
      name: 'Sadia',
      role: 'Marketing manager, retail brand',
    },
    {
      quote:
        'The report shows what our money did without exposing anyone’s personal details. That is what our board wanted.',
      name: 'Imran',
      role: 'Partnerships, local business',
    },
  ],
  rulesIntro:
    'We check every company before it can make offers. These rules protect the organizers you support and keep your money traceable.',
  rules: [
    {
      Icon: MailCheck,
      title: 'Verify your email',
      body: 'After you register, enter the 6-digit code we email you. It works for 10 minutes and you can ask for a new one.',
    },
    {
      Icon: FileCheck2,
      title: 'Upload your trade licence',
      body: 'Add your trade licence number and a copy of the licence as a PDF, JPG or PNG, up to 5 MB.',
    },
    {
      Icon: ShieldCheck,
      title: 'Wait for admin approval',
      body: 'An admin reviews your company. You will be told when you are approved, or given a note explaining why not.',
    },
    {
      Icon: BadgeCheck,
      title: 'Offer the whole need',
      body: 'One offer covers one whole need. Partial offers and counter-offers are not part of MissingPiece.',
    },
    {
      Icon: Undo2,
      title: 'Withdraw only before it arrives',
      body: 'You can withdraw an offer while it is offered or accepted, never after the organizer has received it.',
    },
    {
      Icon: CalendarClock,
      title: 'Offers expire after the event',
      body: 'If an offer is still waiting when the event date passes, it expires automatically.',
    },
  ],
  faqs: [
    {
      q: 'How does paying work?',
      a: 'You pay the amount you offered plus a 5% fee. The project receives the full amount. If a payment fails, your offer stays accepted and you can try again.',
    },
    {
      q: 'Can I offer only part of what a project needs?',
      a: 'No. Each offer covers one whole need, so organizers always know a need is fully covered.',
    },
    {
      q: 'Who can I message?',
      a: 'Only organizers who sent you a request, inside the thread that request opened. Messages are text only.',
    },
    {
      q: 'What is an exclusive category?',
      a: 'Some offers ask to be the only sponsor of a kind, for example food. If two offers clash, the organizer sees a warning and can accept only one.',
    },
    {
      q: 'Will you contact organizers for me?',
      a: 'No. Organizers choose who to send requests to. Keeping your profile up to date helps them find you.',
    },
    {
      q: 'What will I get back?',
      a: 'The benefits listed in each request, like your logo on the main banner, are ticked off as they are given. You also get a totals-only impact report.',
    },
  ],
  cta: {
    title: 'Put your support where it is needed',
    body: 'Register your company. After a quick check by our team, requests start arriving in your inbox.',
  },
}

export default function SponsorsLanding() {
  return <RoleLanding content={content} />
}
