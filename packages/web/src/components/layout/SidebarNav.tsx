import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  ShieldAlert, Package, Bug, AlertTriangle,
  Settings, LayoutDashboard, Bell, CalendarClock,
  ClipboardCheck, Wrench, Send, Users,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/vulnerabilities', label: 'Vulnerabilities', icon: Bug },
  { to: '/patches', label: 'Patches', icon: Wrench },
  { to: '/psirt', label: 'PSIRT', icon: ShieldAlert },
  { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { to: '/approvals', label: 'Approvals', icon: ClipboardCheck },
  { to: '/reporting', label: 'Reporting', icon: Send },
  { to: '/cra-timeline', label: 'CRA Timeline', icon: CalendarClock },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function SidebarNav() {
  return (
    <aside className="w-60 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-gray-800">
        <ShieldAlert className="w-5 h-5 text-blue-400 mr-2" />
        <span className="font-semibold text-sm text-white tracking-wide">CRA Platform</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800',
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-800 text-xs text-gray-400">
        CRA Compliance v0.1
      </div>
    </aside>
  );
}
