import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Sales from './pages/Sales';
import Clients from './pages/Clients';
import Products from './pages/Products';
import Suppliers from './pages/Suppliers';
import Categories from './pages/Categories';
import Labs from './pages/Labs';
import Units from './pages/Units';
import Purchases from './pages/Purchases';
import Branches from './pages/Branches';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Licenses from './pages/Licenses';
import Backups from './pages/Backups';
import Logs from './pages/Logs';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-loading">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Guarded({ module, children }: { module: string; children: React.ReactNode }) {
  const { hasPerm } = useAuth();
  if (!hasPerm(module)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<Guarded module="pos"><POS /></Guarded>} />
        <Route path="sales" element={<Guarded module="pos"><Sales /></Guarded>} />
        <Route path="clients" element={<Guarded module="clients"><Clients /></Guarded>} />
        <Route path="products" element={<Guarded module="inventory"><Products /></Guarded>} />
        <Route path="suppliers" element={<Guarded module="inventory"><Suppliers /></Guarded>} />
        <Route path="categories" element={<Guarded module="inventory"><Categories /></Guarded>} />
        <Route path="labs" element={<Guarded module="inventory"><Labs /></Guarded>} />
        <Route path="units" element={<Guarded module="inventory"><Units /></Guarded>} />
        <Route path="purchases" element={<Guarded module="purchases"><Purchases /></Guarded>} />
        <Route path="branches" element={<Guarded module="branches"><Branches /></Guarded>} />
        <Route path="reports" element={<Guarded module="reports"><Reports /></Guarded>} />
        <Route path="users" element={<Guarded module="users"><Users /></Guarded>} />
        <Route path="licenses" element={<Guarded module="licenses"><Licenses /></Guarded>} />
        <Route path="backups" element={<Guarded module="backups"><Backups /></Guarded>} />
        <Route path="logs" element={<Guarded module="logs"><Logs /></Guarded>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
