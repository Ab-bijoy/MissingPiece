import type { Me } from '../types'

/**
 * In-browser stand-in for Supabase Auth + our database, used in demo mode only.
 * Accounts follow the seed data in build prompt section 12.
 * Every demo password is "password123" and every email code is DEMO_OTP.
 */
export const DEMO_OTP = '123456'
export const DEMO_PASSWORD = 'password123'

export type MockAccount = {
  supabaseId: string
  email: string
  password: string
  confirmed: boolean
  /** Our app_user row; null until a register endpoint is called */
  user: Me | null
}

const KEY = 'mp-demo-db-v5'

function seed(): MockAccount[] {
  const acc = (id: string, email: string, user: Omit<Me, 'id' | 'email'> | null): MockAccount => ({
    supabaseId: `sb-${id}`,
    email,
    password: DEMO_PASSWORD,
    confirmed: true,
    user: user && { id: `u-${id}`, email, ...user },
  })
  return [
    acc('admin', 'admin@missingpiece.example', {
      role: 'admin', status: 'active', name: 'Platform admin', age: null, rejection_note: null, profile: null,
    }),
    acc('cse', 'csesociety@example.org', {
      role: 'organizer', status: 'active', name: 'CSE Society', age: null, rejection_note: null,
      profile: { org_name: 'CSE Society', org_type: 'university', registration_number: 'DU-CSE-0420', contact_person: 'Nusrat Jahan', phone: '+880 1700 000001' },
    }),
    acc('greenhands', 'contact@greenhands.example', {
      role: 'organizer', status: 'pending_approval', name: 'Green Hands NGO', age: null, rejection_note: null,
      profile: { org_name: 'Green Hands NGO', org_type: 'ngo', registration_number: 'NGO-2231', contact_person: 'Nadia Islam', phone: '+880 1700 000002' },
    }),
    acc('brightfuture', 'team@brightfuture.example', {
      role: 'organizer', status: 'active', name: 'Bright Future NGO', age: null, rejection_note: null,
      profile: { org_name: 'Bright Future NGO', org_type: 'ngo', registration_number: 'NGO-1187', contact_person: 'Farzana Haque', phone: '+880 1700 000006' },
    }),
    acc('scienceclub', 'scienceclub@example.org', {
      role: 'organizer', status: 'active', name: 'Science Club', age: null, rejection_note: null,
      profile: { org_name: 'Science Club', org_type: 'university', registration_number: 'DU-SC-0311', contact_person: 'Imran Kabir', phone: '+880 1700 000007' },
    }),
    acc('youth', 'youthclub@example.org', {
      role: 'organizer', status: 'rejected', name: 'Riverside Youth Club', age: null,
      rejection_note: 'The proof document was unreadable. Please register again with a clear scan.',
      profile: { org_name: 'Riverside Youth Club', org_type: 'community_group', registration_number: 'CG-0099', contact_person: 'Karim Uddin', phone: '+880 1700 000003' },
    }),
    acc('examplesoft', 'csr@examplesoftware.example', {
      role: 'sponsor', status: 'active', name: 'Example Software Co.', age: null, rejection_note: null,
      profile: {
        company: 'Example Software Co.', industry: 'Software', trade_license_number: 'TL-55821', contact_person: 'Tanvir Hasan',
        phone: '+880 1700 000004', interests: ['education', 'technology', 'youth'], preferred_types: ['money', 'equipment'],
        location: 'Dhaka', description: 'We support student tech events and digital learning.',
      },
    }),
    acc('freshfoods', 'hello@freshfoods.example', {
      role: 'sponsor', status: 'pending_approval', name: 'Fresh Foods Ltd.', age: null, rejection_note: null,
      profile: {
        company: 'Fresh Foods Ltd.', industry: 'Food', trade_license_number: 'TL-77310', contact_person: 'Shamima Akter',
        phone: '+880 1700 000005', interests: ['community'], preferred_types: ['product'], location: 'Dhaka', description: null,
      },
    }),
    ...(
      [
        ['samplefoods', 'orders@samplefoods.example', 'Sample Foods Ltd.', 'Food', ['community', 'youth'], ['product']],
        ['bakery', 'hello@examplebakery.example', 'Example Bakery', 'Food', ['community'], ['product']],
        ['telecom', 'csr@sampletelecom.example', 'Sample Telecom', 'Telecom', ['youth', 'technology'], ['money']],
        ['print', 'jobs@cityprint.example', 'City Print House', 'Printing', ['education'], ['product', 'money']],
        ['campus', 'events@campusoffice.example', 'Campus Events Office', 'Education', ['education'], ['space', 'equipment']],
        ['demosponsor', 'demo.sponsor@example.com', 'Demo Sponsor', 'Testing', ['testing'], ['money']],
      ] as const
    ).map(([id, email, company, industry, interests, types]) =>
      acc(id, email, {
        role: 'sponsor', status: 'active', name: company, age: null, rejection_note: null,
        profile: {
          company, industry, trade_license_number: `TL-${id.toUpperCase()}`, contact_person: 'Demo contact',
          phone: '+880 1700 000010', interests: [...interests], preferred_types: [...types], location: 'Dhaka', description: null,
        },
      }),
    ),
    ...(
      [
        ['rahim', 'rahim@example.com', 'Rahim Uddin', 22],
        ['nusratj', 'nusrat.j@example.com', 'Nusrat Jahan', 21],
        ['karim', 'karim@example.com', 'Karim Ahmed', 71],
        ['mahir', 'mahir@example.com', 'Mahir Khan', 24],
        ['sara', 'sara@example.com', 'Sara Nasrin', 29],
      ] as const
    ).map(([id, email, name, age]) =>
      acc(id, email, { role: 'general', status: 'active', name, age, rejection_note: null, profile: null }),
    ),
    acc('aisha', 'aisha@example.com', {
      role: 'general', status: 'active', name: 'Aisha Rahman', age: 34, rejection_note: null, profile: null,
    }),
    acc('rahima', 'rahima@example.com', {
      role: 'general', status: 'active', name: 'Rahima Begum', age: 67, rejection_note: null, profile: null,
    }),
  ]
}

function load(): MockAccount[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as MockAccount[]
  } catch {
    /* storage blocked: fall back to seed */
  }
  return seed()
}

export const mockDb = {
  accounts: load(),
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.accounts))
    } catch {
      /* ignore */
    }
  },
  bySupabaseId(id: string) {
    return this.accounts.find((a) => a.supabaseId === id)
  },
  byEmail(email: string) {
    return this.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase())
  },
  /** Demo accounts listed on the log-in screens */
  demoLogins: {
    general: ['aisha@example.com', 'rahima@example.com'],
    organizer: ['csesociety@example.org', 'contact@greenhands.example (pending)', 'youthclub@example.org (rejected)'],
    sponsor: ['csr@examplesoftware.example', 'hello@freshfoods.example (pending)'],
    admin: ['admin@missingpiece.example'],
  },
}
