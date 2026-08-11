import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Select, Button, Spinner, Alert, fmtMoney, fmtDate } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

type Range = 'daily' | 'weekly' | 'monthly' | 'custom';

export default function Reports() {
  const [range, setRange] = useState<Range>('weekly');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [sin, setSin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSales = () => {
    setLoading(true);
    const params: Record<string, string> = { range };
    if (range === 'custom') { params.from = from; params.to = to; }
    api
      .get('/reports/sales', { params })
      .then((r) => setReport(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSales();
    api.get('/reports/inventory').then((r) => setInventory(r.data)).catch((e) => setError(errMsg(e)));
    api.get('/reports/sin').then((r) => setSin(r.data)).catch(() => {});
  }, [range]);

  if (loading && !report) return <Spinner />;

  const exportSales = () => {
    window.location.href = `/api/reports/export?type=sales&token=${localStorage.getItem('token')}`;
  };
  const exportInventory = () => {
    window.location.href = `/api/reports/export?type=inventory&token=${localStorage.getItem('token')}`;
  };

  const print = () => window.print();

  const pieData = sin
    ? [
        { name: 'Emitidas', value: sin.emitted },
        { name: 'Anuladas', value: sin.annulled },
        { name: 'Rechazadas', value: sin.rejected },
      ]
    : [];
  const COLORS = ['#16a34a', '#dc2626', '#d97706'];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Reportes</h2>
      <Alert type="error">{error}</Alert>

      <div className="tabs">
        <button className={`tab ${range === 'daily' ? 'active' : ''}`} onClick={() => setRange('daily')}>Diario</button>
        <button className={`tab ${range === 'weekly' ? 'active' : ''}`} onClick={() => setRange('weekly')}>Semanal</button>
        <button className={`tab ${range === 'monthly' ? 'active' : ''}`} onClick={() => setRange('monthly')}>Mensual</button>
        <button className={`tab ${range === 'custom' ? 'active' : ''}`} onClick={() => setRange('custom')}>Personalizado</button>
        {range === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" className="input" style={{ width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className="input" style={{ width: 150 }} value={to} onChange={(e) => setTo(e.target.value)} />
            <Button onClick={loadSales}>Filtrar</Button>
          </div>
        )}
      </div>

      {report && (
        <Card title={`Ventas y ganancias (${range})`} actions={<>
          <Button variant="secondary" onClick={exportSales}>Exportar CSV</Button>
          <Button variant="secondary" onClick={print}>Imprimir / PDF</Button>
        </>}>
          <div className="kpi-row">
            <div className="kpi"><div className="k-label">Total ventas</div><div className="k-value">{fmtMoney(report.totals.totalSales)}</div></div>
            <div className="kpi"><div className="k-label">Ganancia estimada</div><div className="k-value">{fmtMoney(report.totals.totalProfit)}</div></div>
            <div className="kpi"><div className="k-label">Numero de ventas</div><div className="k-value">{report.totals.totalCount}</div></div>
          </div>
          <div className="chart-box" style={{ marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" name="Ventas Bs" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-box" style={{ marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={report.byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line dataKey="profit" name="Ganancia Bs" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {report.byBranch?.length > 0 && (
            <div className="grid grid-3" style={{ marginTop: 16 }}>
              {report.byBranch.map((b: any) => (
                <div className="kpi" key={b.name}>
                  <div className="k-label">{b.name}</div>
                  <div className="k-value">{fmtMoney(b.total)}</div>
                  <div className="k-label">{b.count} ventas</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {inventory && (
        <Card title="Inventario: mas vendidos (90 dias)" actions={<Button variant="secondary" onClick={exportInventory}>Exportar inventario CSV</Button>}>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventory.bestSellers.slice(0, 10).map((b: any) => ({ name: b.product.name, qty: b.qty }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qty" name="Unidades" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <h4 style={{ marginTop: 16 }}>Stock bajo ({inventory.lowStock.length})</h4>
          <table className="table">
            <thead><tr><th>Producto</th><th>SKU</th><th>Total</th><th>Minimo</th><th>Sucursales</th></tr></thead>
            <tbody>
              {inventory.lowStock.slice(0, 20).map((s: any) => (
                <tr key={s.product.id}>
                  <td>{s.product.name}</td>
                  <td>{s.product.sku}</td>
                  <td><b style={{ color: '#dc2626' }}>{s.total}</b></td>
                  <td>{s.product.minStock}</td>
                  <td>{s.branches.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4 style={{ marginTop: 16 }}>Lotes por vencer o vencidos ({inventory.expiring.length})</h4>
          <table className="table">
            <thead><tr><th>Producto</th><th>Lote</th><th>Vence</th><th>Cantidad</th><th>Sucursal</th><th>Estado</th></tr></thead>
            <tbody>
              {inventory.expiring.slice(0, 20).map((s: any, i: number) => (
                <tr key={i}>
                  <td>{s.product.name}</td>
                  <td>{s.lot}</td>
                  <td>{fmtDate(s.expiryDate)}</td>
                  <td>{s.quantity}</td>
                  <td>{s.branch.name}</td>
                  <td>{s.expired ? <span className="badge badge-red">VENCIDO</span> : <span className="badge badge-yellow">Por vencer</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {sin && (
        <Card title={`Facturacion SIN (${sin.period})`}>
          <div className="grid grid-2">
            <div className="kpi"><div className="k-label">Emitidas</div><div className="k-value">{sin.emitted}</div></div>
            <div className="kpi"><div className="k-label">Monto emitido</div><div className="k-value">{fmtMoney(sin.totalEmitted)}</div></div>
            <div className="kpi"><div className="k-label">Anuladas</div><div className="k-value">{sin.annulled}</div></div>
            <div className="kpi"><div className="k-label">Rechazadas</div><div className="k-value">{sin.rejected}</div></div>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
