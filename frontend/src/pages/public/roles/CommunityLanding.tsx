import {
  EyeOff,
  HandHelping,
  MailCheck,
  MessageCircleQuestion,
  Newspaper,
  Type,
  UserCheck,
  UserRound,
  Users,
} from 'lucide-react'
import RoleLanding, { type RoleContent } from './RoleLanding'

// Note: the reviews are sample quotes for the demo. Replace them with real ones.
const content: RoleContent = {
  theme: {
    heroBg: 'bg-cream',
    heroTitle: 'text-coral',
    heroText: 'text-ink',
    eyebrow: 'text-deep',
    ribbon: '#EBCBA9',
    primaryBtn: 'bg-brand text-sand-light hover:bg-brand-dark',
    secondaryBtn: 'text-brand ring-brand/50 hover:bg-brand/5',
    band: 'bg-brand',
    bandNumber: 'text-sand',
    iconTile: 'bg-sand text-brand',
    quoteMark: 'text-coral',
    ctaCard: 'bg-cream ring-1 ring-sand',
    ctaTitle: 'text-brand',
    ctaText: 'text-ink',
    ctaBtn: 'bg-brand text-sand-light hover:bg-brand-dark',
    ctaLink: 'text-brand',
    piece: 'fill-coral/35',
    // General user theme from the build prompt: Inter, slightly larger text
    main: 'font-user text-[18px]',
  },
  eyebrow: 'For the community',
  headline: ['JOIN', 'IN,', 'PITCH', 'IN'],
  intro:
    'Find programs near you. Come along and take part, or help with something you know or have, like a skill, a few hours or a sewing machine.',
  primary: { label: 'Create a free account', to: '/signup' },
  secondary: { label: 'Log in', to: '/login' },
  features: [
    {
      Icon: Newspaper,
      title: 'A simple feed',
      body: 'See programs from clubs and groups near you, with what they still need, in one easy list.',
    },
    {
      Icon: Users,
      title: 'Join in one tap',
      body: 'Press "Join as participant" and you are in. No forms to fill in again and again.',
    },
    {
      Icon: HandHelping,
      title: 'Offer to help',
      body: 'Teach what you know, or help with your time or things you own.',
    },
    {
      Icon: Type,
      title: 'Easy to read',
      body: 'Large, clear text and big buttons. You can make the text even bigger in your settings.',
    },
  ],
  stepsTitle: 'Getting involved is simple',
  steps: [
    {
      title: 'Make an account',
      body: 'Enter your name, email and a password, then type the 6-digit code we send to your email.',
    },
    {
      title: 'Look around',
      body: 'Scroll the home feed and open any program to see the date, place, what it needs and the discussion.',
    },
    {
      title: 'Join or help',
      body: 'Join to take part, or offer to help. If you offer to help, the organizer says yes first.',
    },
    {
      title: 'Follow along',
      body: 'See everything you joined or offered in one place, with simple words like "Waiting" or "Approved".',
    },
  ],
  reviews: [
    {
      quote:
        'I am 67 and not good with phones, but the buttons are big and the words are clear. I joined the digital learning session by myself.',
      name: 'Rahima',
      role: 'Participant, Digital Learning Session',
    },
    {
      quote:
        'I have been sewing for thirty years. Now I teach young people at the repair workshop on Saturdays.',
      name: 'Abdul',
      role: 'Trainer, Tailoring Repair Workshop',
    },
    {
      quote:
        'I offered my weekend as a volunteer for CSE Fest. The organizer approved me the same day and I could ask questions right on the page.',
      name: 'Farhan',
      role: 'Student volunteer',
    },
  ],
  rulesIntro: 'A few simple rules keep everyone safe and make sure organizers know who is coming.',
  rules: [
    {
      Icon: MailCheck,
      title: 'Verify your email',
      body: 'We’ll email you a 6-digit code. Enter it within 5 minutes, and if it doesn’t arrive, just ask for a new one.',
    },
    {
      Icon: UserRound,
      title: 'Your name and age',
      body: 'We ask for your name and age. We never ask for or store your home address.',
    },
    {
      Icon: EyeOff,
      title: 'Your age stays private',
      body: 'Only you and the organizers of events you join can see your age.',
    },
    {
      Icon: UserCheck,
      title: 'Helpers need approval',
      body: 'If you join to take part, you are in right away. If you offer to help, the organizer says yes first.',
    },
    {
      Icon: Users,
      title: 'One place per event',
      body: 'You can join each event once, either to take part or to help.',
    },
    {
      Icon: MessageCircleQuestion,
      title: 'Be kind in the discussion',
      body: 'Comments are public. Organizers can hide comments that break the rules.',
    },
  ],
  faqs: [
    {
      q: 'Is MissingPiece free for me?',
      a: 'Yes. Joining programs and offering to help is always free.',
    },
    {
      q: 'What is the difference between joining and helping?',
      a: 'Joining means you come and take part in the event. Helping means you give something: you teach what you know, or give your time or things. The organizer says yes to helpers first.',
    },
    {
      q: 'I find small text hard to read. Can I make it bigger?',
      a: 'Yes. Turn on Large text in your profile and everything gets bigger. All buttons are large and easy to press.',
    },
    {
      q: 'Who can see my details?',
      a: 'Other people see your name on comments. Your age is visible only to you and to organizers of events you joined. We never store your home address.',
    },
    {
      q: 'Can I change my mind after offering to help?',
      a: 'Yes. You can take back your offer any time before the organizer marks it as received.',
    },
    {
      q: 'How do I ask the organizer a question?',
      a: 'Every program has a discussion section. Post your question there and the organizer can reply.',
    },
  ],
  cta: {
    title: 'There is a place for you',
    body: 'Make a free account in two minutes and see what is happening near you.',
  },
}

export default function CommunityLanding() {
  return <RoleLanding content={content} />
}
