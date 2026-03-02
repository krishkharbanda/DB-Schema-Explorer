import React, { useState } from 'react';
import { Database } from 'lucide-react';

const DEFAULT_PORTS = { postgresql: 5432, mysql: 3306 };

export default function ConnectionForm({ onConnect }) {
  const [form, setForm] = useState({
    db_type: 'postgresql',
    host: '',
    port: 5432,
    user: '',
    password: '',
    dbname: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (field, value) => {
    const next = { ...form, [field]: value };
    if (field === 'db_type') next.port = DEFAULT_PORTS[value] || 5432;
    setForm(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onConnect({ ...form, port: Number(form.port) });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="connect-screen">
      <form className="connect-card" onSubmit={handleSubmit}>
        <h1><Database size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />DB Schema Explorer</h1>
        <p className="subtitle">Connect to your database to extract and explore its schema</p>

        <div className="form-group">
          <label>Database Type</label>
          <select value={form.db_type} onChange={(e) => update('db_type', e.target.value)}>
            <option value="postgresql">PostgreSQL</option>
            <option value="mysql">MySQL</option>
          </select>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 3 }}>
            <label>Host</label>
            <input type="text" placeholder="localhost" value={form.host} onChange={(e) => update('host', e.target.value)} required />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Port</label>
            <input type="number" value={form.port} onChange={(e) => update('port', e.target.value)} required />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Username</label>
            <input type="text" placeholder="postgres" value={form.user} onChange={(e) => update('user', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={form.password} onChange={(e) => update('password', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>Database Name</label>
          <input type="text" placeholder="mydb" value={form.dbname} onChange={(e) => update('dbname', e.target.value)} required />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <><span className="spinner" /> Connecting...</> : 'Connect & Extract Schema'}
        </button>

        {error && <div className="error-msg">{error}</div>}
      </form>
    </div>
  );
}
