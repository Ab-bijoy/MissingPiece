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
    'Get clear requests from clubs, NGOs and community groups that our team has checked. Give exactly what a project needs, and see that it arrived.',
  primary: { label: 'Become a sponsor', to: '/sponsor/register' },
  secondary: { label: 'Sponsor log in', to: '/sponsor/login' },
  features: [
    {
      Icon: Inbox,
      title: 'Requests that fit you',
      body: 'Tell us what you like to give and where. Organizers then send you requests that suit your company.',
    },
    {
      Icon: MessageSquareText,
      title: 'Talk it through',
      body: 'Every request comes with a chat with the organizer, so you can agree on the details before you offer.',
    },
    {
      Icon: CreditCard,
      title: 'Pay with the fee shown',
      body: 'When you give money, you see the amount, the 5% fee and the total before you pay. No hidden costs.',
    },
    {
      Icon: BarChart3,
      title: 'An impact report',
      body: 'After the event, see a short summary of what arrived and which of the promised benefits you received.',
    },
  ],
  stepsTitle: 'From request to real impact',
  steps: [
    {
      title: 'Set up your profile',
      body: 'Add your type of business, what you care about, the kinds of help you give and where you are. The more you add, the better your requests.',
    },
    {
      title: 'Read your inbox',
      body: 'Each request shows the project, exactly what it needs, what you get in return, and the dates to reply and deliver by.',
    },
    {
      title: 'Make an offer',
      body: 'Offer the whole need, with any conditions you have. Then watch it go from offered, to accepted, to received.',
    },
    {
      title: 'Pay and see results',
      body: 'Pay safely through MissingPiece. Once everything has arrived, read the summary and check what you received in return.',
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
    'Our team checks every company before it can make offers. These rules protect the organizers you support and let you see where your money goes.',
  rules: [
    {
      Icon: MailCheck,
      title: 'Verify your email',
      body: 'We’ll email you a 6-digit code right after you sign up. Enter it within 5 minutes, or ask us to send a fresh one.',
    },
    {
      Icon: FileCheck2,
      title: 'Upload your trade licence',
      body: 'Add your trade licence number and a copy of the licence, as a PDF, JPG or PNG up to 5 MB.',
    },
    {
      Icon: ShieldCheck,
      title: 'Wait for admin approval',
      body: 'Our team looks at your company. We tell you when you are approved, or explain why not.',
    },
    {
      Icon: BadgeCheck,
      title: 'Offer the whole need',
      body: 'Each offer covers the whole of a need. You can’t offer just part of it or ask for a different deal.',
    },
    {
      Icon: Undo2,
      title: 'Withdraw only before it arrives',
      body: 'You can take back an offer until the organizer receives what you promised, but not after.',
    },
    {
      Icon: CalendarClock,
      title: 'Offers expire after the event',
      body: 'If an offer is still waiting for an answer when the event date passes, it is cancelled automatically.',
    },
  ],
  faqs: [
    {
      q: 'How does paying work?',
      a: 'You pay the amount you offered plus a small 5% fee, and the project gets the full amount. If a payment does not go through, your offer is kept and you can try again.',
    },
    {
      q: 'Can I offer only part of what a project needs?',
      a: 'No. Each offer covers the whole of a need, so organizers always know that need is fully taken care of.',
    },
    {
      q: 'Who can I message?',
      a: 'Only organizers who sent you a request, in the chat that comes with that request. Messages are text only.',
    },
    {
      q: 'What is an exclusive category?',
      a: 'Some sponsors want to be the only one of their kind at an event, for example the only food sponsor. If two such offers come in, the organizer is warned and can accept only one.',
    },
    {
      q: 'Will you contact organizers for me?',
      a: 'No. Organizers choose who to ask. Keeping your profile up to date helps them find you.',
    },
    {
      q: 'What will I get back?',
      a: 'You get what each request promises, like your logo on the main banner, and it is ticked off once given. You also get a short summary of what your support made possible.',
    },
  ],
  cta: {
    title: 'Put your support where it is needed',
    body: 'Register your company. After a quick check by our team, requests start coming in.',
  },
}

export default function SponsorsLanding() {
  return <RoleLanding content={content} />
}
