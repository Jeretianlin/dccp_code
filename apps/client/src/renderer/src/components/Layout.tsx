import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: '仪表盘' },
    { to: '/tasks', label: '任务列表' },
    { to: '/projects', label: '项目管理' },
  ];

  const adminNavItems = [
    { to: '/users', label: '用户管理' },
  ];

  const allNavItems = user?.role === 'ADMIN' 
    ? [...navItems, ...adminNavItems] 
    : navItems;

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">DCCP</h1>
          <p className="text-xs text-gray-400">设计师创意协同平台</p>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {allNavItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `block px-4 py-2 rounded-md transition-colors ${
                      isActive ? 'bg-blue-600' : 'hover:bg-gray-800'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-700">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `block px-4 py-2 rounded-md transition-colors ${
                isActive ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`
            }
          >
            设置
          </NavLink>
        </div>

        <div className="p-4 border-t border-gray-700">
          <div className="text-sm mb-2">{user?.name}</div>
          <div className="text-xs text-gray-400 mb-3">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="w-full btn btn-secondary text-sm"
          >
            退出登录
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}