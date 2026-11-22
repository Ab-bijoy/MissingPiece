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
    'University clubs, NGOs and community groups: list what your event needs, ask the right sponsors, and track every promise until it arrives.',
  primary: { label: 'Register your organization', to: '/organizer/register' },
  secondary: { label: 'Organizer log in', to: '/organizer/login' },
  features: [
    {
      Icon: LayoutTemplate,
      title: 'Start from a template',
      body: 'Pick University event, NGO project or Elders and youth activity. Details and common needs are filled in for you.',
    },
    {
      Icon: ClipboardList,
      title: 'Needs in your own units',
      body: 'Money in BDT, 300 snack packs, a projector for a day, 40 volunteer hours, a hall for one evening.',
    },
    {
      Icon: Sparkles,
      title: 'Sponsor suggestions',
      body: 'See companies that fit your project, each with a short reason. Only you can see the match scores.',
    },
    {
      Icon: ListChecks,
      title: 'Know when you are ready',
      body: 'Four readiness checks and a clear "still needed" summary show what is covered and what has arrived.',
    },
  ],
  stepsTitle: 'From plan to a finished event',
  steps: [
    {
      title: 'Create a project',
      body: 'Choose a template, add the date, venue and audience, and list every need. Publish when it looks right.',
    },
    {
      title: 'Send requests',
      body: 'Pick from the suggested sponsors and send requests to up to five of them, each with the benefits you offer.',
    },
    {
      title: 'Accept offers',
      body: 'Offers come in for whole needs. Accept the one you want; clashing offers are flagged so nothing double-books.',
    },
    {
      title: 'Mark received, then complete',
      body: 'Tick items off as they arrive. When everything accepted is received, complete the project and share the report.',
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
      role: 'Coordinator, community tailoring workshop',
    },
    {
      quote:
        'When two food sponsors both wanted to be the only one, the app warned us before we said yes to either. That saved an awkward call.',
      name: 'Tahmina',
      role: 'Volunteer manager, local NGO',
    },
  ],
  rulesIntro:
    'Every organization is checked by the MissingPiece team before it can post. These rules keep things fair for sponsors and for the people who join your events.',
  rules: [
    {
      Icon: MailCheck,
      title: 'Verify your email',
      body: 'After you register, enter the 6-digit code we email you. The code works for 10 minutes and you can ask for a new one.',
    },
    {
      Icon: FileCheck2,
      title: 'Upload proof of your organization',
      body: 'Add your registration number and a proof document as a PDF, JPG or PNG, up to 5 MB.',
    },
    {
      Icon: ShieldCheck,
      title: 'Wait for admin approval',
      body: 'An admin reviews every request. You will get a notice when you are approved, or a note saying why not.',
    },
    {
      Icon: Send,
      title: 'Up to five sponsors per project',
      body: 'Each project can send requests to at most five different sponsors, so choose the ones that fit best.',
    },
    {
      Icon: Handshake,
      title: 'One offer covers one whole need',
      body: 'Offers are for the full need, never part of it. Accepting one offer declines the others on that need.',
    },
    {
      Icon: PackageCheck,
      title: 'Confirm what arrives',
      body: 'Mark items received when you get them. You can complete a project only when every accepted offer is received.',
    },
  ],
  faqs: [
    {
      q: 'Who can register as an organizer?',
      a: 'University clubs, NGOs and community groups. You need a registration number and a document that proves your organization exists.',
    },
    {
      q: 'Does it cost anything?',
      a: 'No. When a sponsor gives money, they pay a 5% fee on top. Your project receives the full amount they offered.',
    },
    {
      q: 'What kinds of things can I ask for?',
      a: 'Money, products, skills, time, equipment and space. Write each need in the unit that makes sense, like packs, hours or BDT.',
    },
    {
      q: 'How are sponsors suggested?',
      a: 'We compare your project and open needs with what each sponsor likes to give, their interests and their location. Sponsors never see these scores, and we never contact them for you.',
    },
    {
      q: 'Can people from the community help too?',
      a: 'Yes. People can join your event as participants straight away, or offer to help as a trainer or contributor. You approve every helper.',
    },
    {
      q: 'What do sponsors see in the final report?',
      a: 'Totals only: what was given and received. Names, emails, ages and phone numbers are never included.',
    },
  ],
  cta: {
    title: 'Your next event is missing something',
    body: 'Register your organization today. Once an admin approves you, you can publish your first project.',
  },
}

export default function OrganizersLanding() {
  return <RoleLanding content={content} />
}
