import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <span className="auth-mark">Rx</span>
          <span className="auth-title">FarmaciaPOS</span>
        </div>
        <div className="auth-sub">Control de mostrador, stock y caja de su farmacia</div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="field">
          <span>Usuario</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <span>Contraseña</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Ingresando...' : 'Ingresar'}
        </button>
        <div className="demo-box">
          Cuentas de prueba: admin / admin123 (acceso completo), cajero / cajero123 (solo ventas)
        </div>
      </form>
    </div>
  );
}
