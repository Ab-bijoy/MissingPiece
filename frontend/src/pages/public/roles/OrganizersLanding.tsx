import {
  ClipboardList,
  FileCheck2,
  Handshake,
  LayoutTemplate,
  ListChecks,
  MailCheck,
  PackageCheck,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import RoleLanding, { type RoleContent } from './RoleLanding'

// Note: the reviews are sample quotes for the demo. Replace them with real ones.
const content: RoleContent = {
  theme: {
    heroBg: 'bg-white',
    heroTitle: 'text-coral',
    heroText: 'text-ink-soft',
    eyebrow: 'text-coral-dark',
    ribbon: '#0D6052',
    primaryBtn: 'bg-brand text-sand-light hover:bg-brand-dark',
    secondaryBtn: 'text-brand ring-brand/50 hover:bg-brand/5',
    band: 'bg-brand',
    bandNumber: 'text-coral',
    iconTile: 'bg-coral/15 text-[#9a3326]',
    quoteMark: 'text-coral',
    ctaCard: 'bg-coral',
    ctaTitle: 'text-ink',
    ctaText: 'text-ink',
    ctaBtn: 'bg-brand text-sand-light hover:bg-brand-dark',
    ctaLink: 'text-ink',
    piece: 'fill-sand/60',
  },
  eyebrow: 'For organizers',
  headline: ['GET', 'WHAT', 'YOUR', 'PROJECT', 'NEEDS'],
  intro:
    'For university clubs, NGOs and community groups. Write down what your event needs, ask companies that can help, and keep track until everything arrives.',
  primary: { label: 'Register your organization', to: '/organizer/register' },
  secondary: { label: 'Organizer log in', to: '/organizer/login' },
  features: [
    {
      Icon: LayoutTemplate,
      title: 'Start from a template',
      body: 'Choose a university event, an NGO project or an activity for elders and young people. We fill in the usual details and needs for you.',
    },
    {
      Icon: ClipboardList,
      title: 'Needs in your own units',
      body: 'List needs just as you’d say them: BDT 20,000 for prizes, 300 snack packs, a projector for one day or a hall for an evening.',
    },
    {
      Icon: Sparkles,
      title: 'Sponsor suggestions',
      body: 'We point you to companies that are likely to say yes, and tell you why each one fits. The match scores stay private to you.',
    },
    {
      Icon: ListChecks,
      title: 'Know when you are ready',
      body: 'A short checklist and a "still needed" list show what has been promised and what has already arrived.',
    },
  ],
  stepsTitle: 'From plan to a finished event',
  steps: [
    {
      title: 'Create a project',
      body: 'Choose a template, add the date, the place and how many people you expect, then list everything you need. Publish it when it looks right.',
    },
    {
      title: 'Send requests',
      body: 'Choose from the suggested sponsors and ask up to five of them. Tell each one what they get in return, like their logo on your banner.',
    },
    {
      title: 'Accept offers',
      body: 'Each offer covers a whole need. Accept the one you want. If two offers can’t both be accepted, we warn you first so nothing is booked twice.',
    },
    {
      title: 'Mark received, then complete',
      body: 'Tick things off as they arrive. When everything you accepted has arrived, mark the project as done and share the report.',
    },
  ],
  reviews: [
    {
      quote:
        'We used to chase sponsors on five different chats. Now I can see in one table that the projector is here and the prize money is still open.',
      name: 'Nusrat',
      role: 'Events lead, CSE Society',
    },
    {
      quote:
        'The template filled in most of our workshop. We only changed the numbers and sent requests the same evening.',
      name: 'Rafiq',
      role: 'Coordinator, tailoring workshop',
    },
    {
      quote:
        'When two food sponsors both wanted to be the only one, the app warned us before we said yes to either. That saved an awkward call.',
      name: 'Tahmina',
      role: 'Volunteer manager, local NGO',
    },
  ],
  rulesIntro:
    'Our team checks every organization before it can post. These rules keep things fair for sponsors and for the people who come to your events.',
  rules: [
    {
      Icon: MailCheck,
      title: 'Verify your email',
      body: 'We’ll email you a 6-digit code right after you sign up. Enter it within 5 minutes, or ask us to send a fresh one.',
    },
    {
      Icon: FileCheck2,
      title: 'Upload proof of your organization',
      body: 'Add your registration number and a document that shows your organization is real, as a PDF, JPG or PNG up to 5 MB.',
    },
    {
      Icon: ShieldCheck,
      title: 'Wait for admin approval',
      body: 'Our team looks at every sign-up. We tell you when you are approved, or explain why not.',
    },
    {
      Icon: Send,
      title: 'Up to five sponsors per project',
      body: 'Each project can ask at most five different sponsors, so choose the ones that suit you best.',
    },
    {
      Icon: Handshake,
      title: 'One offer covers one whole need',
      body: 'A sponsor gives the whole of a need, never just part of it. When you accept one offer, the other offers for that need are turned down.',
    },
    {
      Icon: PackageCheck,
      title: 'Confirm what arrives',
      body: 'Mark each thing as received when you get it. You can only finish a project when everything you accepted has arrived.',
    },
  ],
  faqs: [
    {
      q: 'Who can register as an organizer?',
      a: 'University clubs, NGOs and community groups. You need your registration number and a document that shows your organization is real.',
    },
    {
      q: 'Does it cost anything?',
      a: 'No, it is free for you. When a sponsor gives money, they pay a small 5% fee on top. Your project gets the full amount they offered.',
    },
    {
      q: 'What kinds of things can I ask for?',
      a: 'Money, items, skills, time, equipment and space. Write each need in the amount that makes sense, like packs, hours or taka.',
    },
    {
      q: 'How are sponsors suggested?',
      a: 'We compare what your project still needs with what each sponsor likes to give, what they care about and where they are. Sponsors never see these scores, and we never contact them for you.',
    },
    {
      q: 'Can people from the community help too?',
      a: 'Yes. People can join your event straight away, or offer to help, for example by teaching or giving their time. You decide who helps.',
    },
    {
      q: 'What do sponsors see in the final report?',
      a: 'Only the totals: what was given and what arrived. Names, emails, ages and phone numbers are never shared.',
    },
  ],
  cta: {
    title: 'Your next event is missing something',
    body: 'Register your organization today. Once our team approves you, you can publish your first project.',
  },
}

export default function OrganizersLanding() {
  return <RoleLanding content={content} />
}
