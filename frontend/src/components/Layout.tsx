import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', perm: 'dashboard' },
  { to: '/pos', label: 'Punto de Venta', icon: '🛒', perm: 'pos' },
  { to: '/sales', label: 'Ventas y Facturacion', icon: '🧾', perm: 'pos' },
  { to: '/clients', label: 'Clientes', icon: '👤', perm: 'clients' },
  { to: '/products', label: 'Productos', icon: '💊', perm: 'inventory' },
  { to: '/suppliers', label: 'Proveedores', icon: '🚚', perm: 'inventory' },
  { to: '/purchases', label: 'Compras', icon: '📦', perm: 'purchases' },
  { to: '/branches', label: 'Sucursales / Stock', icon: '🏬', perm: 'branches' },
  { to: '/categories', label: 'Categorias', icon: '🗂️', perm: 'inventory' },
  { to: '/labs', label: 'Laboratorios', icon: '🔬', perm: 'inventory' },
  { to: '/units', label: 'Unidades de Medida', icon: '⚖️', perm: 'inventory' },
  { to: '/reports', label: 'Reportes', icon: '📈', perm: 'reports' },
  { to: '/users', label: 'Usuarios', icon: '👥', perm: 'users' },
  { to: '/licenses', label: 'Licencias', icon: '🔑', perm: 'licenses' },
  { to: '/backups', label: 'Backups', icon: '💾', perm: 'backups' },
  { to: '/logs', label: 'Logs', icon: '📜', perm: 'logs' },
];

export default function Layout() {
  const { user, logout, hasPerm } = useAuth();
  const navigate = useNavigate();

  const items = NAV.filter((n) => hasPerm(n.perm));

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">💊</span> FarmaciaPOS
        </div>
        <nav>
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <span>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="uc-name">{user?.fullName}</div>
            <div className="uc-sub">
              {user?.role} · {user?.branch?.name || 'sin sucursal'}
            </div>
          </div>
          <button
            className="btn btn-danger btn-block"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Cerrar sesion
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
