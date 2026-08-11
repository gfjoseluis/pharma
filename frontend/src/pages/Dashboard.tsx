import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Spinner, fmtMoney } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
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
  const { user } = useAuth();
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
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
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <Spinner />;

  const cards = [
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
        <Card title="Ventas de los ultimos 7 dias (Bs)">
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" name="Ventas Bs" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="checkbox-row">
            <b>Sucursal activa:</b> {user?.branch?.name || 'Sin asignar'} ({user?.branch?.type || '-'})
          </div>
        </div>
      </div>
    </div>
  );
}
