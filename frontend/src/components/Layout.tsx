import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ExpiryBell from './ExpiryBell';
import LowStockBell from './LowStockBell';

interface NavEntry {
  to: string;
  label: string;
  code: string;
  perm: string;
  group: 'Mostrador' | 'Botica' | 'Administración';
}

const NAV: NavEntry[] = [
  { to: '/', label: 'Tablero', code: 'Ta', perm: 'dashboard.view', group: 'Mostrador' },
  { to: '/pos', label: 'Punto de Venta', code: 'Pv', perm: 'pos.view', group: 'Mostrador' },
  { to: '/cash', label: 'Caja', code: 'Cj', perm: 'cash.view', group: 'Mostrador' },
  { to: '/sales', label: 'Ventas', code: 'Ve', perm: 'sales.view', group: 'Mostrador' },
  { to: '/clients', label: 'Clientes', code: 'Cl', perm: 'clients.view', group: 'Mostrador' },
  { to: '/products', label: 'Productos', code: 'Pr', perm: 'products.view', group: 'Botica' },
  { to: '/suppliers', label: 'Proveedores', code: 'Pd', perm: 'inventory.refs.view', group: 'Botica' },
  { to: '/purchases', label: 'Compras', code: 'Co', perm: 'purchases.view', group: 'Botica' },
  { to: '/branches', label: 'Sucursales y stock', code: 'Su', perm: 'branches.view', group: 'Botica' },
  { to: '/categories', label: 'Categorías', code: 'Ca', perm: 'inventory.refs.view', group: 'Botica' },
  { to: '/labs', label: 'Laboratorios', code: 'La', perm: 'inventory.refs.view', group: 'Botica' },
  { to: '/units', label: 'Unidades de medida', code: 'Um', perm: 'inventory.refs.view', group: 'Botica' },
  { to: '/forms', label: 'Formas farmacéuticas', code: 'Ff', perm: 'forms.manage', group: 'Botica' },
  { to: '/reports', label: 'Reportes', code: 'Re', perm: 'reports.view', group: 'Administración' },
  { to: '/users', label: 'Usuarios', code: 'Us', perm: 'users.view', group: 'Administración' },
  { to: '/backups', label: 'Respaldos', code: 'Rs', perm: 'backups.view', group: 'Administración' },
  { to: '/logs', label: 'Registros', code: 'Rg', perm: 'logs.view', group: 'Administración' },
];

const GROUPS: Array<'Mostrador' | 'Botica' | 'Administración'> = ['Mostrador', 'Botica', 'Administración'];

export default function Layout() {
  const { user, logout, hasPerm } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Cierra el menu movil al navegar
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const visible = NAV.filter((n) => hasPerm(n.perm));

  return (
    <div className="layout">
      {menuOpen && <button type="button" className="scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">Rx</span>
          <span>
            <span className="brand-name">FarmaciaPOS</span>
            <br />
            <span className="brand-sub">{user?.branch?.name || 'Sin sucursal'}</span>
          </span>
        </div>
        <nav>
          {GROUPS.map((g) => {
            const items = visible.filter((n) => n.group === g);
            if (items.length === 0) return null;
            return (
              <div className="nav-group" key={g}>
                <div className="nav-group-title">{g}</div>
                {items.map((n) => (
                  <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                    <span className="nav-tile">{n.code}</span> {n.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bells">
          <ExpiryBell />
          <LowStockBell />
        </div>
        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="uc-name">{user?.fullName}</div>
            <div className="uc-sub">
              {user?.role}, {user?.branch?.type || 'sin tipo'}
            </div>
          </div>
          <button
            className="btn btn-danger btn-block"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <span className="brand-mark" style={{ width: 30, height: 30, fontSize: 15 }}>Rx</span>
          <span className="brand-name">FarmaciaPOS</span>
          <button type="button" className="topbar-menu" onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? 'Cerrar' : 'Menú'}
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
