import { lazy, Suspense, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import RequireRole from './auth/RequireRole'
import TestingBar from './components/app/TestingBar'
import ScrollToTop from './components/ScrollToTop'
import FullPageSpinner from './components/ui/FullPageSpinner'
// The main landing page is the usual first page, so it ships with the app itself.
import Landing from './pages/public/landing/Landing'

// Every other screen is loaded only when someone opens it, so a visitor to the
// landing page does not download the admin, organizer and sponsor screens.
// While a screen loads, the previous one stays on screen (React Router uses
// transitions); the spinner shows only on a first visit with nothing to show yet.
const page = <P extends object>(load: () => Promise<{ default: ComponentType<P> }>) => lazy(load)
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })))

// Public landings, log in and sign up
const OrganizersLanding = page(() => import('./pages/public/roles/OrganizersLanding'))
const SponsorsLanding = page(() => import('./pages/public/roles/SponsorsLanding'))
const CommunityLanding = page(() => import('./pages/public/roles/CommunityLanding'))
const LoginPage = page(() => import('./pages/public/auth/LoginPage'))
const SignupUserPage = page(() => import('./pages/public/auth/SignupUserPage'))
const SignupBusinessPage = page(() => import('./pages/public/auth/SignupBusinessPage'))
const VerifyEmailPage = page(() => import('./pages/public/auth/VerifyEmailPage'))
const RegistrationSentPage = page(() => import('./pages/public/auth/RegistrationSentPage'))
const ForgotPasswordPage = page(() => import('./pages/public/auth/ForgotPasswordPage'))
const ComingSoon = page(() => import('./pages/public/ComingSoon'))

// General user area
const UserLayout = page(() => import('./pages/user/UserLayout'))
const UserHome = page(() => import('./pages/user/UserHome'))
const ProgramsList = page(() => import('./pages/user/ProgramsList'))
const ProgramPage = page(() => import('./pages/user/ProgramPage'))
const MyContributions = page(() => import('./pages/user/MyContributions'))
const UserProfilePage = page(() => import('./pages/user/UserProfilePage'))

// Organizer area
const OrganizerLayout = page(() => import('./pages/organizer/OrganizerLayout'))
const OrganizerHome = named(() => import('./pages/organizer/OrganizerLayout'), 'OrganizerHome')
const CreateProject = page(() => import('./pages/organizer/CreateProject'))
const ProjectDashboard = page(() => import('./pages/organizer/ProjectDashboard'))
const ReceiveComplete = page(() => import('./pages/organizer/ReceiveComplete'))
const OrganizerMessages = page(() => import('./pages/organizer/OrganizerMessages'))
const OrganizerProfilePage = page(() => import('./pages/organizer/OrganizerProfilePage'))

// Sponsor area
const SponsorLayout = page(() => import('./pages/sponsor/SponsorLayout'))
const SponsorInbox = page(() => import('./pages/sponsor/SponsorInbox'))
const SponsorEvents = page(() => import('./pages/sponsor/SponsorEvents'))
const SponsorOffers = page(() => import('./pages/sponsor/SponsorOffers'))
const SponsorPay = page(() => import('./pages/sponsor/SponsorPay'))
const SponsorProfilePage = page(() => import('./pages/sponsor/SponsorProfilePage'))
const SponsorReportPage = page(() => import('./pages/sponsor/SponsorReportPage'))
const MockCheckout = page(() => import('./pages/sponsor/MockCheckout'))

// Admin area
const AdminLayout = page(() => import('./pages/admin/AdminLayout'))
const AdminApprovals = page(() => import('./pages/admin/AdminApprovals'))
const AdminAccounts = page(() => import('./pages/admin/AdminAccounts'))
const AdminTemplates = page(() => import('./pages/admin/AdminTemplates'))
const AdminPayments = page(() => import('./pages/admin/AdminPayments'))
const AdminComments = page(() => import('./pages/admin/AdminComments'))

// Routes follow the build prompt (section 9.1), with the landing pages in front:
//   /            main landing        /organizers  organizer landing
//   /sponsors    sponsor landing     /community   general user landing
// The general user home feed lives at /home (the build prompt has it at /).
export default function App() {
  return (
    <>
    <ScrollToTop />
    <TestingBar />
    <Suspense fallback={<FullPageSpinner />}>
    <Routes>
      {/* Landing pages */}
      <Route path="/" element={<Landing />} />
      <Route path="/organizers" element={<OrganizersLanding />} />
      <Route path="/sponsors" element={<SponsorsLanding />} />
      <Route path="/community" element={<CommunityLanding />} />

      {/* Public: log in and sign up (build prompt 3.4) */}
      <Route path="/login" element={<LoginPage role="general" />} />
      <Route path="/signup" element={<SignupUserPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/organizer/login" element={<LoginPage role="organizer" />} />
      <Route path="/organizer/register" element={<SignupBusinessPage role="organizer" />} />
      <Route path="/sponsor/login" element={<LoginPage role="sponsor" />} />
      <Route path="/sponsor/register" element={<SignupBusinessPage role="sponsor" />} />
      <Route path="/registration-sent" element={<RegistrationSentPage />} />
      <Route path="/admin/login" element={<LoginPage role="admin" />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Signed-in areas, each behind its role guard */}
      {/* General user area (build prompt 9.1; the feed is at /home, not /) */}
      <Route element={<RequireRole role="general"><UserLayout /></RequireRole>}>
        <Route path="/home" element={<UserHome />} />
        <Route path="/programs" element={<ProgramsList />} />
        <Route path="/programs/:id" element={<ProgramPage />} />
        <Route path="/my-contributions" element={<MyContributions />} />
        <Route path="/profile" element={<UserProfilePage />} />
      </Route>
      <Route path="/organizer" element={<RequireRole role="organizer"><OrganizerLayout /></RequireRole>}>
        <Route index element={<OrganizerHome />} />
        <Route path="projects/new" element={<CreateProject />} />
        <Route path="projects/:id" element={<ProjectDashboard />} />
        <Route path="projects/:id/complete" element={<ReceiveComplete />} />
        <Route path="messages" element={<OrganizerMessages />} />
        <Route path="profile" element={<OrganizerProfilePage />} />
      </Route>
      <Route path="/sponsor" element={<RequireRole role="sponsor"><SponsorLayout /></RequireRole>}>
        <Route index element={<SponsorInbox />} />
        <Route path="events" element={<SponsorEvents />} />
        <Route path="offers" element={<SponsorOffers />} />
        <Route path="offers/:id/pay" element={<SponsorPay />} />
        <Route path="profile" element={<SponsorProfilePage />} />
        <Route path="reports/:projectId" element={<SponsorReportPage />} />
        {/* Demo payment gateway (build prompt 10); the real one is the provider's page */}
        <Route path="checkout/:paymentId" element={<MockCheckout />} />
      </Route>
      <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
        <Route index element={<Navigate to="/admin/approvals" replace />} />
        <Route path="approvals" element={<AdminApprovals />} />
        <Route path="accounts" element={<AdminAccounts />} />
        <Route path="templates" element={<AdminTemplates />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="comments" element={<AdminComments />} />
      </Route>

      <Route path="*" element={<ComingSoon title="Page not found" />} />
    </Routes>
    </Suspense>
    </>
  )
}
