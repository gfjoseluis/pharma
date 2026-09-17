import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Button, Spinner, Alert, fmtMoney, fmtDate, Badge } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts';

type Range = 'daily' | 'weekly' | 'monthly' | 'custom';
type View = 'graficos' | 'tablas';

export default function Reports() {
  const [range, setRange] = useState<Range>('daily');
  const [view, setView] = useState<View>('graficos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
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
  }, [range]);

  if (loading && !report) return <Spinner />;

  const exportSales = () => {
    window.location.href = `/api/reports/export?type=sales&token=${localStorage.getItem('token')}`;
  };
  const exportInventory = () => {
    window.location.href = `/api/reports/export?type=inventory&token=${localStorage.getItem('token')}`;
  };

  const print = () => window.print();

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Reportes</h2>
      <Alert type="error">{error}</Alert>

      <div className="tabs">
        <button className={`tab ${view === 'graficos' ? 'active' : ''}`} onClick={() => setView('graficos')}>Gráficos</button>
        <button className={`tab ${view === 'tablas' ? 'active' : ''}`} onClick={() => setView('tablas')}>Stock bajo y vencimientos</button>
      </div>

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

      {view === 'graficos' && report && (
        <Card title={`Ventas y ganancias (${range})`} actions={<>
          <Button variant="secondary" onClick={exportSales}>Exportar CSV</Button>
          <Button variant="secondary" onClick={print}>Imprimir / PDF</Button>
        </>}>
          <div className="kpi-row">
            <div className="kpi"><div className="k-label">Total ventas</div><div className="k-value">{fmtMoney(report.totals.totalSales)}</div></div>
            <div className="kpi"><div className="k-label">Ganancia estimada</div><div className="k-value">{fmtMoney(report.totals.totalProfit)}</div></div>
            <div className="kpi"><div className="k-label">Numero de ventas</div><div className="k-value">{report.totals.totalCount}</div></div>
          </div>
          <p className="p-meta" style={{ margin: '16px 0 8px' }}>
            Cada barra suma todo lo vendido ese día, en bolivianos. Sirve para ver qué días se mueve más la farmacia.
          </p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.byDay} margin={{ top: 8, right: 12, bottom: 22, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} label={{ value: 'Fecha', position: 'insideBottom', offset: -14, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: 'Ventas (Bs)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(d: any) => `Fecha: ${d}`}
                  formatter={(v: any) => [`${Number(v).toFixed(2)} Bs`, 'Ventas del día']}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" name="Ventas del día (Bs)" fill="#186a48" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="p-meta" style={{ margin: '16px 0 8px' }}>
            Utilidad estimada por día: total vendido menos el costo de los productos.
          </p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={report.byDay} margin={{ top: 8, right: 12, bottom: 22, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} label={{ value: 'Fecha', position: 'insideBottom', offset: -14, fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: 'Ganancia (Bs)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(d: any) => `Fecha: ${d}`}
                  formatter={(v: any) => [`${Number(v).toFixed(2)} Bs`, 'Ganancia del día']}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="profit" name="Ganancia del día (Bs)" stroke="#92400e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {view === 'graficos' && inventory && (
        <Card title="Productos más vendidos (últimos 90 días)" actions={<Button variant="secondary" onClick={exportInventory}>Exportar inventario CSV</Button>}>
          <p className="p-meta" style={{ marginBottom: 8 }}>
            Los 10 productos con más unidades vendidas. Útil para decidir qué reponer primero.
          </p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={inventory.bestSellers.slice(0, 10).map((b: any) => ({
                  name: b.product.name.length > 24 ? b.product.name.slice(0, 24) + '…' : b.product.name,
                  fullName: b.product.name,
                  qty: b.qty,
                }))}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 22, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} label={{ value: 'Unidades vendidas', position: 'insideBottom', offset: -14, fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.fullName || ''}
                  formatter={(v: any) => [`${v} unidades`, 'Vendido']}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="qty" name="Unidades vendidas" fill="#186a48" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {view === 'tablas' && inventory && (
        <Card title="Stock bajo (reponer)" actions={<Button variant="secondary" onClick={exportInventory}>Exportar inventario CSV</Button>}>
          <p className="p-meta" style={{ marginBottom: 12 }}>
            Productos cuyo stock vendible (sin contar vencidos) llegó al mínimo o menos. La columna de vencidas indica lo que hay que dar de baja, no lo que sirve para vender.
          </p>
          <table className="table">
            <thead><tr><th>Producto</th><th>SKU</th><th>Vendible</th><th>Mínimo</th><th>Vencidas por dar de baja</th><th>Sucursales</th></tr></thead>
            <tbody>
              {inventory.lowStock.map((s: any) => (
                <tr key={s.product.id}>
                  <td>{s.product.name}</td>
                  <td>{s.product.sku}</td>
                  <td><b style={{ color: s.total <= 0 ? '#dc2626' : '#b45309' }}>{s.total}</b></td>
                  <td>{s.product.minStock}</td>
                  <td>{s.expiredQty > 0 ? <Badge color="yellow">{s.expiredQty}</Badge> : '-'}</td>
                  <td>{s.branches.join(', ') || 'ninguna'}</td>
                </tr>
              ))}
              {inventory.lowStock.length === 0 && (
                <tr><td colSpan={6} className="p-meta">Sin productos con stock bajo</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {view === 'tablas' && inventory && (
        <Card title={`Lotes por vencer o vencidos (${inventory.expiring.length})`}>
          <table className="table">
            <thead><tr><th>Producto</th><th>Lote</th><th>Vence</th><th>Cantidad</th><th>Sucursal</th><th>Estado</th></tr></thead>
            <tbody>
              {inventory.expiring.map((s: any, i: number) => (
                <tr key={i}>
                  <td>{s.product.name}</td>
                  <td>{s.lot}</td>
                  <td>{fmtDate(s.expiryDate)}</td>
                  <td>{s.quantity}</td>
                  <td>{s.branch.name}</td>
                  <td>{s.expired ? <Badge color="red">VENCIDO</Badge> : <Badge color="yellow">Por vencer</Badge>}</td>
                </tr>
              ))}
              {inventory.expiring.length === 0 && (
                <tr><td colSpan={6} className="p-meta">Sin lotes por vencer</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}