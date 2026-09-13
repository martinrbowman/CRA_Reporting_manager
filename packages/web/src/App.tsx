import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getCurrentUser } from './lib/auth.js';
import AppShell from './components/layout/AppShell.js';
import LoginPage from './pages/Login.js';
import DashboardPage from './pages/Dashboard.js';
import ProductsPage from './pages/Products.js';
import ProductNewPage from './pages/ProductNew.js';
import ProductDetailPage from './pages/ProductDetail.js';
import VersionsPage from './pages/Versions.js';
import VulnerabilitiesPage from './pages/Vulnerabilities.js';
import VulnerabilityDetailPage from './pages/VulnerabilityDetail.js';
import VulnerabilityNewPage from './pages/VulnerabilityNew.js';
import PsirtPage from './pages/Psirt.js';
import PsirtDetailPage from './pages/PsirtDetail.js';
import PsirtNewPage from './pages/PsirtNew.js';
import PatchesPage from './pages/Patches.js';
import IncidentsPage from './pages/Incidents.js';
import ReportingPage from './pages/Reporting.js';
import CraTimelinePage from './pages/CraTimeline.js';
import NotificationsPage from './pages/Notifications.js';
import ApprovalsPage from './pages/Approvals.js';
import UsersPage from './pages/Users.js';
import SettingsPage from './pages/Settings.js';
import ProfilePage from './pages/Profile.js';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductNewPage />} />
          <Route path="products/:productId" element={<ProductDetailPage />} />
          <Route path="products/:productId/versions" element={<VersionsPage />} />
          <Route path="vulnerabilities" element={<VulnerabilitiesPage />} />
          <Route path="vulnerabilities/new" element={<VulnerabilityNewPage />} />
          <Route path="vulnerabilities/:vulnerabilityId" element={<VulnerabilityDetailPage />} />
          <Route path="psirt" element={<PsirtPage />} />
          <Route path="psirt/new" element={<PsirtNewPage />} />
          <Route path="psirt/:caseId" element={<PsirtDetailPage />} />
          <Route path="patches" element={<PatchesPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="reporting" element={<ReportingPage />} />
          <Route path="cra-timeline" element={<CraTimelinePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
