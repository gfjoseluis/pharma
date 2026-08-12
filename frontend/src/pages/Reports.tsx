import React, { useEffect, useState } from 'react';
import { api, errMsg } from '../api/client';
import { Card, Button, Spinner, Alert, fmtMoney, fmtDate, Badge } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';

type Range = 'daily' | 'weekly' | 'monthly' | 'custom';
type View = 'cuadre' | 'graficos' | 'tablas';

const METHOD_LABEL: Record<string, string> = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', QR: 'QR / transferencia' };

export default function Reports() {
  const [range, setRange] = useState<Range>('daily');
  const [view, setView] = useState<View>('cuadre');
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
        <button className={`tab ${view === 'cuadre' ? 'active' : ''}`} onClick={() => setView('cuadre')}>💰 Cuadre de caja (por cajero)</button>
        <button className={`tab ${view === 'graficos' ? 'active' : ''}`} onClick={() => setView('graficos')}>📊 Graficos</button>
        <button className={`tab ${view === 'tablas' ? 'active' : ''}`} onClick={() => setView('tablas')}>📋 Tablas (stock bajo y vencimientos)</button>
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

      {view === 'cuadre' && report && (
        <Card title={`Cuadre de caja por cajero (${range})`} actions={<Button variant="secondary" onClick={print}>Imprimir / PDF</Button>}>
          <p className="p-meta" style={{ marginBottom: 12 }}>
            Totales por cajero y sucursal, desglosados por metodo de cobro, para verificar el arqueo de cada cajero al cierre del periodo.
          </p>
          <table className="table">
            <thead><tr><th>Cajero</th><th>Sucursal</th><th>Ventas</th><th>💵 Efectivo</th><th>💳 Tarjeta</th><th>📱 QR / transferencia</th><th>Total</th><th>Ganancia</th></tr></thead>
            <tbody>
              {(report.byUser || []).map((u: any) => (
                <tr key={`${u.userId}-${u.branchName}`}>
                  <td><b>{u.fullName}</b></td>
                  <td>{u.branchName}</td>
                  <td>{u.count}</td>
                  <td>{fmtMoney(u.methods.EFECTIVO?.total || 0)}</td>
                  <td>{fmtMoney(u.methods.TARJETA?.total || 0)}</td>
                  <td>{fmtMoney(u.methods.QR?.total || 0)}</td>
                  <td><b>{fmtMoney(u.total)}</b></td>
                  <td>{fmtMoney(u.profit)}</td>
                </tr>
              ))}
              {(!report.byUser || report.byUser.length === 0) && (
                <tr><td colSpan={8} className="p-meta">Sin ventas en el periodo</td></tr>
              )}
            </tbody>
            {report.byUser && report.byUser.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan={3}><b>TOTALES</b></td>
                  <td><b>{fmtMoney(report.byUser.reduce((a: number, u: any) => a + (u.methods.EFECTIVO?.total || 0), 0))}</b></td>
                  <td><b>{fmtMoney(report.byUser.reduce((a: number, u: any) => a + (u.methods.TARJETA?.total || 0), 0))}</b></td>
                  <td><b>{fmtMoney(report.byUser.reduce((a: number, u: any) => a + (u.methods.QR?.total || 0), 0))}</b></td>
                  <td><b>{fmtMoney(report.totals.totalSales)}</b></td>
                  <td><b>{fmtMoney(report.totals.totalProfit)}</b></td>
                </tr>
              </tfoot>
            )}
          </table>
        </Card>
      )}

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
{/**  
          <h4 style={{ marginTop: 16 }}>Ganancia por tipo de cobro (cuadre de cajas)</h4>
          <table className="table">
            <thead><tr><th>Metodo</th><th>Ventas</th><th>Total cobrado</th><th>Ganancia estimada</th></tr></thead>
            <tbody>
              {(report.byMethod || []).map((m: any) => (
                <tr key={m.method}>
                  <td><Badge color={m.method === 'EFECTIVO' ? 'green' : 'blue'}>{METHOD_LABEL[m.method] || m.method}</Badge></td>
                  <td>{m.count}</td>
                  <td><b>{fmtMoney(m.total)}</b></td>
                  <td>{fmtMoney(m.profit)}</td>
                </tr>
              ))}
              {(!report.byMethod || report.byMethod.length === 0) && (
                <tr><td colSpan={4} className="p-meta">Sin ventas en el periodo</td></tr>
              )}
            </tbody>
          </table>
 */}
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

      {view === 'graficos' && inventory && (
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
        </Card>
      )}

      {view === 'tablas' && inventory && (
        <Card title="Stock bajo (reponer)" actions={<Button variant="secondary" onClick={exportInventory}>Exportar inventario CSV</Button>}>
          <table className="table">
            <thead><tr><th>Producto</th><th>SKU</th><th>Total</th><th>Minimo</th><th>Sucursales</th></tr></thead>
            <tbody>
              {inventory.lowStock.map((s: any) => (
                <tr key={s.product.id}>
                  <td>{s.product.name}</td>
                  <td>{s.product.sku}</td>
                  <td><b style={{ color: s.total <= 0 ? '#dc2626' : '#b45309' }}>{s.total}</b></td>
                  <td>{s.product.minStock}</td>
                  <td>{s.branches.join(', ') || 'ninguna'}</td>
                </tr>
              ))}
              {inventory.lowStock.length === 0 && (
                <tr><td colSpan={5} className="p-meta">Sin productos con stock bajo</td></tr>
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