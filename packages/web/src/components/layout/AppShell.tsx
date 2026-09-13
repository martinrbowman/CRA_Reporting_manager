import { Outlet } from 'react-router-dom';
import SidebarNav from './SidebarNav.js';
import TopBar from './TopBar.js';

export default function AppShell() {
  return (
    <div className="flex h-full overflow-hidden">
      <SidebarNav />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
