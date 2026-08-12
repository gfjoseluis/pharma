import React, { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ExpiryBell from './ExpiryBell';
import LowStockBell from './LowStockBell';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', perm: 'dashboard.view' },
  { to: '/pos', label: 'Punto de Venta', icon: '🛒', perm: 'pos.view' },
  { to: '/sales', label: 'Ventas', icon: '🧾', perm: 'sales.view' },
  { to: '/clients', label: 'Clientes', icon: '👤', perm: 'clients.view' },
  { to: '/products', label: 'Productos', icon: '💊', perm: 'products.view' },
  { to: '/suppliers', label: 'Proveedores', icon: '🚚', perm: 'inventory.refs.view' },
  { to: '/purchases', label: 'Compras', icon: '📦', perm: 'purchases.view' },
  { to: '/branches', label: 'Sucursales / Stock', icon: '🏬', perm: 'branches.view' },
  { to: '/categories', label: 'Categorias', icon: '🗂️', perm: 'inventory.refs.view' },
  { to: '/labs', label: 'Laboratorios', icon: '🔬', perm: 'inventory.refs.view' },
  { to: '/units', label: 'Unidades de Medida', icon: '⚖️', perm: 'inventory.refs.view' },
  { to: '/forms', label: 'Formas farmaceuticas', icon: '💧', perm: 'forms.manage' },
  { to: '/reports', label: 'Reportes', icon: '📈', perm: 'reports.view' },
  { to: '/users', label: 'Usuarios', icon: '👥', perm: 'users.view' },
  { to: '/backups', label: 'Backups', icon: '💾', perm: 'backups.view' },
  { to: '/logs', label: 'Logs', icon: '📜', perm: 'logs.view' },
];

export default function Layout() {
  const { user, logout, hasPerm } = useAuth();
  const navigate = useNavigate();

  // Modo compacto por pantalla fisica (no por viewport): el zoom del navegador
  // agranda el viewport CSS y desactiva las media queries, asi que se decide
  // con window.screen, que el zoom no modifica.
  useEffect(() => {
    const small = window.screen.availWidth <= 1500 || window.screen.availHeight <= 820;
    document.documentElement.classList.toggle('app-compact', small);
  }, []);

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
        <ExpiryBell />
        <LowStockBell />
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
