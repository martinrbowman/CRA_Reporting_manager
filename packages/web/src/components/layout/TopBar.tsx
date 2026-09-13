import { LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { logout, getCurrentUser } from '../../lib/auth.js';

export default function TopBar() {
  const user = getCurrentUser();

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-gray-900 border-b border-gray-800 flex-shrink-0">
      <div />
      <div className="flex items-center gap-4">
        <Link to="/profile" className="text-sm text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors">
          <User className="w-3.5 h-3.5" />
          {user?.email}
        </Link>
        <button
          onClick={logout}
          className="text-gray-500 hover:text-white transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
