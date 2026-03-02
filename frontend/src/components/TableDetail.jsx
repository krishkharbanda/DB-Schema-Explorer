import React from 'react';
import { Key, Link, Hash } from 'lucide-react';

export default function TableDetail({ name, data, type }) {
  if (!data) return null;

  if (type === 'enum') {
    return (
      <div className="table-detail">
        <h2 style={{ marginBottom: 16 }}>Enum: <code>{name}</code></h2>
        <div className="enum-values" style={{ gap: 8, display: 'flex', flexWrap: 'wrap' }}>
          {data.values.map((v) => (
            <span key={v} className="enum-value">{v}</span>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'matview') {
    return (
      <div className="table-detail">
        <h2 style={{ marginBottom: 16 }}>Materialized View: <code>{name}</code></h2>
        {data.definition && (
          <div className="view-definition">
            <pre>{data.definition}</pre>
          </div>
        )}
      </div>
    );
  }

  if (type === 'function') {
    return (
      <div className="table-detail">
        <h2 style={{ marginBottom: 16 }}>
          {data.kind === 'procedure' ? 'Procedure' : 'Function'}: <code>{name}</code>
        </h2>
        <div className="interface-card">
          {data.arguments && <div className="meta">Arguments: {data.arguments}</div>}
          {data.return_type && <div className="meta">Returns: {data.return_type}</div>}
        </div>
      </div>
    );
  }

  const pkCols = new Set(data.primary_key?.columns || []);
  const fkMap = {};
  (data.foreign_keys || []).forEach((fk) => {
    fk.constrained_columns.forEach((col, i) => {
      fkMap[col] = `${fk.referred_table}.${fk.referred_columns[i]}`;
    });
  });

  const isView = type === 'view';

  return (
    <div className="table-detail">
      <h2 style={{ marginBottom: 24 }}>
        {isView ? 'View' : 'Table'}: <code>{name}</code>
      </h2>

      <div className="detail-section">
        <h3>Columns <span className="badge">{data.columns.length}</span></h3>
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Type</th>
              <th>Nullable</th>
              <th>Default</th>
              {!isView && <th>References</th>}
            </tr>
          </thead>
          <tbody>
            {data.columns.map((col) => (
              <tr key={col.name}>
                <td style={{ width: 32, textAlign: 'center' }}>
                  {pkCols.has(col.name) && <Key size={13} className="pk-icon" title="Primary Key" />}
                  {fkMap[col.name] && <Link size={13} className="fk-icon" title="Foreign Key" />}
                </td>
                <td><code>{col.name}</code></td>
                <td><span className="type-badge">{col.type}</span></td>
                <td><span className="nullable-badge">{col.nullable ? 'YES' : 'NO'}</span></td>
                <td><code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{col.default || '—'}</code></td>
                {!isView && <td style={{ fontSize: 12, color: 'var(--success)' }}>{fkMap[col.name] || ''}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isView && data.foreign_keys?.length > 0 && (
        <div className="detail-section">
          <h3>Foreign Keys <span className="badge">{data.foreign_keys.length}</span></h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Column(s)</th>
                <th>References</th>
              </tr>
            </thead>
            <tbody>
              {data.foreign_keys.map((fk, i) => (
                <tr key={i}>
                  <td><code>{fk.name || '—'}</code></td>
                  <td><code>{fk.constrained_columns.join(', ')}</code></td>
                  <td><code>{fk.referred_table}({fk.referred_columns.join(', ')})</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isView && data.indexes?.length > 0 && (
        <div className="detail-section">
          <h3>Indexes <span className="badge">{data.indexes.length}</span></h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Columns</th>
                <th>Unique</th>
              </tr>
            </thead>
            <tbody>
              {data.indexes.map((idx, i) => (
                <tr key={i}>
                  <td><code>{idx.name}</code></td>
                  <td><code>{idx.columns.join(', ')}</code></td>
                  <td>{idx.unique ? 'YES' : 'NO'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isView && data.unique_constraints?.length > 0 && (
        <div className="detail-section">
          <h3>Unique Constraints <span className="badge">{data.unique_constraints.length}</span></h3>
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Columns</th></tr>
            </thead>
            <tbody>
              {data.unique_constraints.map((uc, i) => (
                <tr key={i}>
                  <td><code>{uc.name}</code></td>
                  <td><code>{uc.columns.join(', ')}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isView && data.check_constraints?.length > 0 && (
        <div className="detail-section">
          <h3>Check Constraints <span className="badge">{data.check_constraints.length}</span></h3>
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Expression</th></tr>
            </thead>
            <tbody>
              {data.check_constraints.map((cc, i) => (
                <tr key={i}>
                  <td><code>{cc.name}</code></td>
                  <td><code>{cc.sqltext}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isView && data.definition && (
        <div className="detail-section">
          <h3>View Definition</h3>
          <div className="view-definition">
            <pre>{data.definition}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
