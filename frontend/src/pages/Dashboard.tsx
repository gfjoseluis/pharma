import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Spinner, fmtMoney } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useAuth } from '../context/AuthContext';

interface Metrics {
  salesToday: number;
  profitToday: number;
  lowStock: number;
  expiring: number;
  salesCount: number;
  byDay: Array<{ date: string; total: number }>;
}

export default function Dashboard() {
  const { user, hasPerm } = useAuth();
  const canReports = hasPerm('reports.view');
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canReports) return;
    Promise.all([api.get('/reports/sales?range=weekly'), api.get('/reports/inventory')])
      .then(([salesRes, invRes]) => {
        const report = salesRes.data;
        const byDay = report.byDay;
        setData({
          salesToday: byDay[byDay.length - 1]?.total ?? 0,
          profitToday: report.totals.totalProfit,
          lowStock: invRes.data.lowStock.length,
          expiring: invRes.data.expiring.length,
          salesCount: report.totals.totalCount,
          byDay,
        });
      })
      .catch((err) => setError(errMsg(err)));
  }, [canReports]);

  if (!canReports) {
    return (
      <div>
        <h2 style={{ marginBottom: 16 }}>Dashboard</h2>
        <div className="card">
          <div className="card-body">
            <p>Bienvenido/a. Consulta los reportes y ventas desde el menu lateral.</p>
            <div className="checkbox-row">
              <b>Sucursal activa:</b> {user?.branch?.name || 'Sin asignar'} ({user?.branch?.type || '-'})
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <Spinner />;

  const cards = [
    { label: 'Sucursal activa', value: user?.branch?.name || 'Sin asignar', sub: `Tipo: ${user?.branch?.type || '-'}` },
    { label: 'Ventas del dia', value: fmtMoney(data.salesToday), sub: 'Total vendido hoy' },
    { label: 'Ganancias (semana)', value: fmtMoney(data.profitToday), sub: 'Utilidad estimada' },
    { label: 'Stock bajo', value: data.lowStock, sub: 'Productos bajo minimo' },
    { label: 'Lotes por vencer', value: data.expiring, sub: 'Vencen en 60 dias' },
    { label: 'Ventas registradas', value: data.salesCount, sub: 'Ultimos 7 dias' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Dashboard</h2>
      <div className="grid grid-4">
        {cards.map((c) => (
          <div className="stat" key={c.label}>
            <div className="label">{c.label}</div>
            <div className="value">{c.value}</div>
            <div className="sub">{c.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        <Card title="Ventas de los últimos 7 días">
          <p className="p-meta" style={{ marginBottom: 8 }}>
            Total cobrado cada día, en bolivianos. La última barra es hoy.
          </p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byDay} margin={{ top: 8, right: 12, bottom: 22, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} label={{ value: 'Fecha', position: 'insideBottom', offset: -14, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} label={{ value: 'Ventas (Bs)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(d: any) => `Fecha: ${d}`}
                  formatter={(v: any) => [`${Number(v).toFixed(2)} Bs`, 'Ventas del día']}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" name="Ventas del día (Bs)" fill="#186a48" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
