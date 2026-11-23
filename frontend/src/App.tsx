import { Navigate, Route, Routes } from 'react-router-dom'
import RequireRole from './auth/RequireRole'
import TestingBar from './components/app/TestingBar'
import AdminAccounts from './pages/admin/AdminAccounts'
import AdminApprovals from './pages/admin/AdminApprovals'
import AdminComments from './pages/admin/AdminComments'
import AdminLayout from './pages/admin/AdminLayout'
import AdminPayments from './pages/admin/AdminPayments'
import AdminTemplates from './pages/admin/AdminTemplates'
import CreateProject from './pages/organizer/CreateProject'
import OrganizerLayout, { OrganizerHome } from './pages/organizer/OrganizerLayout'
import OrganizerMessages from './pages/organizer/OrganizerMessages'
import OrganizerProfilePage from './pages/organizer/OrganizerProfilePage'
import ProjectDashboard from './pages/organizer/ProjectDashboard'
import ReceiveComplete from './pages/organizer/ReceiveComplete'
import MockCheckout from './pages/sponsor/MockCheckout'
import SponsorEvents from './pages/sponsor/SponsorEvents'
import SponsorInbox from './pages/sponsor/SponsorInbox'
import SponsorLayout from './pages/sponsor/SponsorLayout'
import SponsorOffers from './pages/sponsor/SponsorOffers'
import SponsorPay from './pages/sponsor/SponsorPay'
import SponsorProfilePage from './pages/sponsor/SponsorProfilePage'
import SponsorReportPage from './pages/sponsor/SponsorReportPage'
import ForgotPasswordPage from './pages/public/auth/ForgotPasswordPage'
import LoginPage from './pages/public/auth/LoginPage'
import RegistrationSentPage from './pages/public/auth/RegistrationSentPage'
import SignupBusinessPage from './pages/public/auth/SignupBusinessPage'
import SignupUserPage from './pages/public/auth/SignupUserPage'
import VerifyEmailPage from './pages/public/auth/VerifyEmailPage'
import ComingSoon from './pages/public/ComingSoon'
import MyContributions from './pages/user/MyContributions'
import ProgramPage from './pages/user/ProgramPage'
import ProgramsList from './pages/user/ProgramsList'
import UserHome from './pages/user/UserHome'
import UserLayout from './pages/user/UserLayout'
import UserProfilePage from './pages/user/UserProfilePage'
import Landing from './pages/public/landing/Landing'
import CommunityLanding from './pages/public/roles/CommunityLanding'
import OrganizersLanding from './pages/public/roles/OrganizersLanding'
import SponsorsLanding from './pages/public/roles/SponsorsLanding'

// Routes follow the build prompt (section 9.1), with the landing pages in front:
//   /            main landing        /organizers  organizer landing
//   /sponsors    sponsor landing     /community   general user landing
// The general user home feed lives at /home (the build prompt has it at /).
export default function App() {
  return (
    <>
    <TestingBar />
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
    </>
  )
}
