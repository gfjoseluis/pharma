import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Modal, Field, Input, Alert, Spinner, Badge, Table, fmtMoney, fmtDate, Pagination } from '../components/ui';
import { isValidMoney, moneyToNumber } from '../money';

interface CashStatus {
  open: boolean;
  session: {
    id: number;
    openedAt: string;
    openingAmount: number;
    branch: { id: number; name: string };
    user: { id: number; fullName: string };
  } | null;
  totals?: { count: number; salesTotal: number; cashTotal: number; otherTotal: number; byMethod: Record<string, { count: number; total: number }> };
  expectedCash?: number;
}

interface ReportRow {
  sessionId: number;
  cashier: string;
  branch: string;
  openedAt: string;
  closedAt: string | null;
  status: string;
  openingAmount: number;
  salesCount: number;
  salesTotal: number;
  cashTotal: number;
  cardTotal: number;
  qrTotal: number;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
}

interface ReportTotals {
  openingAmount: number; salesCount: number; salesTotal: number;
  cashTotal: number; cardTotal: number; qrTotal: number;
  expectedCash: number; countedCash: number; difference: number;
}

interface HistoryRow {
  id: number;
  openedAt: string;
  closedAt: string | null;
  status: string;
  openingAmount: number;
  countedCash: number | null;
  expectedCash: number | null;
  difference: number | null;
  note: string | null;
  branch: { id: number; name: string };
  user: { id: number; fullName: string };
  totals: { count: number; salesTotal: number };
}

export default function Cash() {
  const { user, hasPerm } = useAuth();
  const canOpen = hasPerm('cash.open');
  const canClose = hasPerm('cash.close');
  const [status, setStatus] = useState<CashStatus | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [hPage, setHPage] = useState(1);
  const [hTotal, setHTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [counted, setCounted] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [closeResult, setCloseResult] = useState<{ expectedCash: number; countedCash: number; difference: number } | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [reportDate, setReportDate] = useState(today);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [reportTotals, setReportTotals] = useState<ReportTotals | null>(null);

  const loadHistory = (pg: number = hPage) => {
    api.get('/cash/history', { params: { page: pg, pageSize: 20 } })
      .then((r) => {
        setHistory(r.data.data);
        setHTotal(r.data.total);
      })
      .catch((e) => setError(errMsg(e)));
  };

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/cash/status'), api.get('/cash/report', { params: { date: reportDate } })])
      .then(([s, r]) => {
        setStatus(s.data);
        setReportRows(r.data.rows);
        setReportTotals(r.data.totals);
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
    loadHistory(1);
    setHPage(1);
  };

  const printReport = () => {
    document.body.classList.add('print-cash-report');
    const done = () => document.body.classList.remove('print-cash-report');
    window.addEventListener('afterprint', done, { once: true });
    setTimeout(done, 2000);
    window.print();
  };

  const loadReport = () => {
    api.get('/cash/report', { params: { date: reportDate } })
      .then((r) => {
        setReportRows(r.data.rows);
        setReportTotals(r.data.totals);
      })
      .catch((e) => setError(errMsg(e)));
  };

  useEffect(load, []);

  const doOpen = async () => {
    if (!isValidMoney(opening)) { setError('Monto inicial inválido (use punto o coma)'); return; }
    setBusy(true);
    setError('');
    try {
      await api.post('/cash/open', { openingAmount: moneyToNumber(opening) });
      setOpening('');
      load();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const doClose = async () => {
    if (!isValidMoney(counted)) { setError('Efectivo contado inválido (use punto o coma)'); return; }
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/cash/close', { countedCash: moneyToNumber(counted), note: closeNote || undefined });
      setCloseResult({
        expectedCash: Number(r.data.session.expectedCash),
        countedCash: Number(r.data.session.countedCash),
        difference: Number(r.data.session.difference),
      });
      setCounted('');
      setCloseNote('');
      setCloseModal(false);
      load();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  if (loading && !status) return <Spinner />;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Caja</h2>
      <Alert type="error">{error}</Alert>

      {closeResult && (
        <Card title="Cierre registrado">
          <p><b>Efectivo esperado:</b> {fmtMoney(closeResult.expectedCash)}</p>
          <p><b>Efectivo contado:</b> {fmtMoney(closeResult.countedCash)}</p>
          <p><b>Diferencia:</b>{' '}
            <b style={{ color: closeResult.difference === 0 ? '#166b44' : '#b42318' }}>
              {fmtMoney(closeResult.difference)}{closeResult.difference === 0 ? ' (cuadra exacto)' : closeResult.difference > 0 ? ' (sobrante)' : ' (faltante)'}
            </b>
          </p>
          <Button variant="secondary" onClick={() => setCloseResult(null)}>Cerrar</Button>
        </Card>
      )}

      {status?.open && status.session ? (
        <Card
          title={`Caja abierta desde ${fmtDate(status.session.openedAt)}`}
          actions={canClose ? <Button variant="danger" onClick={() => setCloseModal(true)}>Cerrar caja</Button> : undefined}
        >
          <div className="kpi-row">
            <div className="kpi"><div className="k-label">Monto inicial</div><div className="k-value">{fmtMoney(status.session.openingAmount)}</div></div>
            <div className="kpi"><div className="k-label">Ventas del turno</div><div className="k-value">{status.totals?.count ?? 0}</div></div>
            <div className="kpi"><div className="k-label">Efectivo esperado en caja</div><div className="k-value">{fmtMoney(status.expectedCash ?? 0)}</div></div>
            <div className="kpi"><div className="k-label">Tarjeta y QR</div><div className="k-value">{fmtMoney(status.totals?.otherTotal ?? 0)}</div></div>
          </div>
          <p className="p-meta" style={{ marginTop: 12 }}>
            Cajero: {status.session.user.fullName} · Sucursal: {status.session.branch.name}.
            Para vender, la caja debe estar abierta: <Link to="/pos">ir al punto de venta</Link>.
          </p>
        </Card>
      ) : (
        <Card title="Caja cerrada">
          <p className="p-meta" style={{ marginBottom: 12 }}>
            No tiene caja abierta. Apertúrela con el efectivo inicial del turno para poder vender.
          </p>
          {canOpen ? (
            <div className="form-row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ maxWidth: 220 }}>
                <span>Monto inicial en efectivo (Bs)</span>
                <Input placeholder="0.00" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} />
              </div>
              <div className="field">
                <span>&nbsp;</span>
                <Button variant="primary" disabled={busy} onClick={doOpen}>
                  {busy ? 'Aperturando...' : 'Aperturar caja'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="empty">Sin permiso para aperturar caja.</div>
          )}
        </Card>
      )}

      <div className="print-area">
      <Card
        title={`Cuadre del día por cajero (${reportDate})`}
        actions={<>
          <input type="date" className="input" style={{ width: 150 }} value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          <Button variant="secondary" onClick={loadReport}>Filtrar</Button>
          <Button variant="secondary" onClick={printReport}>Imprimir / PDF</Button>
        </>}
      >
        <p className="p-meta screen-only" style={{ marginBottom: 12 }}>
          Un renglón por turno abierto ese día: inicial más ventas en efectivo da el esperado; el contado menos el esperado da la diferencia.
        </p>
        {reportRows.length === 0 ? (
          <div className="empty">Sin turnos ese día</div>
        ) : (
          <>
          <div className="screen-only">
          <Table head={['Cajero', 'Sucursal', 'Apertura', 'Cierre', 'Inicial', 'Ventas', 'Efectivo', 'Tarjeta', 'QR', 'Esperado', 'Contado', 'Diferencia']}>
            {reportRows.map((r) => (
              <tr key={r.sessionId}>
                <td><b>{r.cashier}</b></td>
                <td>{r.branch}</td>
                <td>{fmtDate(r.openedAt)}</td>
                <td>{r.closedAt ? fmtDate(r.closedAt) : <Badge color="green">Abierta</Badge>}</td>
                <td>{fmtMoney(r.openingAmount)}</td>
                <td>{r.salesCount} ({fmtMoney(r.salesTotal)})</td>
                <td>{fmtMoney(r.cashTotal)}</td>
                <td>{fmtMoney(r.cardTotal)}</td>
                <td>{fmtMoney(r.qrTotal)}</td>
                <td><b>{fmtMoney(r.expectedCash)}</b></td>
                <td>{r.countedCash !== null ? fmtMoney(r.countedCash) : '-'}</td>
                <td>
                  {r.difference === null ? '-' : (
                    <b style={{ color: r.difference === 0 ? '#166b44' : '#b42318' }}>{fmtMoney(r.difference)}</b>
                  )}
                </td>
              </tr>
            ))}
            {reportTotals && (
              <tr style={{ background: '#f4f7f0' }}>
                <td colSpan={4}><b>TOTALES</b></td>
                <td><b>{fmtMoney(reportTotals.openingAmount)}</b></td>
                <td><b>{reportTotals.salesCount} ({fmtMoney(reportTotals.salesTotal)})</b></td>
                <td><b>{fmtMoney(reportTotals.cashTotal)}</b></td>
                <td><b>{fmtMoney(reportTotals.cardTotal)}</b></td>
                <td><b>{fmtMoney(reportTotals.qrTotal)}</b></td>
                <td><b>{fmtMoney(reportTotals.expectedCash)}</b></td>
                <td><b>{fmtMoney(reportTotals.countedCash)}</b></td>
                <td><b style={{ color: reportTotals.difference === 0 ? '#166b44' : '#b42318' }}>{fmtMoney(reportTotals.difference)}</b></td>
              </tr>
            )}
          </Table>
          </div>
          <table className="table print-only">
            <thead><tr><th>Cajero</th><th>Inicial</th><th>Ventas</th><th>Efectivo</th><th>Esperado</th><th>Contado</th><th>Diferencia</th></tr></thead>
            <tbody>
              {reportRows.map((r) => (
                <tr key={r.sessionId}>
                  <td><b>{r.cashier}</b></td>
                  <td>{fmtMoney(r.openingAmount)}</td>
                  <td>{r.salesCount} ({fmtMoney(r.salesTotal)})</td>
                  <td>{fmtMoney(r.cashTotal)}</td>
                  <td><b>{fmtMoney(r.expectedCash)}</b></td>
                  <td>{r.countedCash !== null ? fmtMoney(r.countedCash) : 'Pendiente'}</td>
                  <td>
                    {r.difference === null ? 'Pendiente' : (
                      <b>{fmtMoney(r.difference)}{r.difference === 0 ? ' (cuadra)' : r.difference > 0 ? ' (sobrante)' : ' (faltante)'}</b>
                    )}
                  </td>
                </tr>
              ))}
              {reportTotals && (
                <tr>
                  <td><b>TOTALES</b></td>
                  <td><b>{fmtMoney(reportTotals.openingAmount)}</b></td>
                  <td><b>{reportTotals.salesCount} ({fmtMoney(reportTotals.salesTotal)})</b></td>
                  <td><b>{fmtMoney(reportTotals.cashTotal)}</b></td>
                  <td><b>{fmtMoney(reportTotals.expectedCash)}</b></td>
                  <td><b>{fmtMoney(reportTotals.countedCash)}</b></td>
                  <td><b>{fmtMoney(reportTotals.difference)}</b></td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="p-meta print-only" style={{ marginTop: 10 }}>
            Generado el {new Date().toLocaleString('es-BO')} por {user?.fullName || ''}.
          </p>
          </>
        )}
      </Card>
      </div>

      <Card title="Historial de turnos">
        {history.length === 0 ? (
          <div className="empty">Sin turnos registrados</div>
        ) : (
          <Table head={['Apertura', 'Cierre', 'Cajero', 'Sucursal', 'Inicial', 'Ventas', 'Esperado', 'Contado', 'Diferencia', 'Estado']}>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{fmtDate(h.openedAt)}</td>
                <td>{h.closedAt ? fmtDate(h.closedAt) : '-'}</td>
                <td>{h.user.fullName}</td>
                <td>{h.branch.name}</td>
                <td>{fmtMoney(h.openingAmount)}</td>
                <td>{h.totals.count} ({fmtMoney(h.totals.salesTotal)})</td>
                <td>{h.expectedCash !== null ? fmtMoney(h.expectedCash) : '-'}</td>
                <td>{h.countedCash !== null ? fmtMoney(h.countedCash) : '-'}</td>
                <td>
                  {h.difference === null ? '-' : (
                    <b style={{ color: h.difference === 0 ? '#166b44' : '#b42318' }}>{fmtMoney(h.difference)}</b>
                  )}
                </td>
                <td>{h.status === 'OPEN' ? <Badge color="green">Abierta</Badge> : <Badge color="gray">Cerrada</Badge>}</td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination page={hPage} total={hTotal} pageSize={20} onChange={(p) => { setHPage(p); loadHistory(p); }} />
      </Card>

      <Modal
        title="Cerrar caja"
        open={closeModal}
        onClose={() => setCloseModal(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setCloseModal(false)}>Cancelar</Button>
          <Button variant="danger" disabled={busy} onClick={doClose}>{busy ? 'Cerrando...' : 'Confirmar cierre'}</Button>
        </>}
      >
        <p className="p-meta" style={{ marginBottom: 12 }}>
          Efectivo esperado en caja: <b>{fmtMoney(status?.expectedCash ?? 0)}</b> (inicial + ventas en efectivo del turno).
          Cuente el dinero y registre el monto.
        </p>
        <Field label="Efectivo contado (Bs)"><Input placeholder="0.00" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} /></Field>
        <Field label="Observación (opcional)"><Input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}
