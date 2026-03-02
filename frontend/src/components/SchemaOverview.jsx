import React from 'react';
import { Table2, Eye, Hash, ListTree, FunctionSquare } from 'lucide-react';

function StatCard({ icon: Icon, label, count, color }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        background: `${color}18`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700 }}>{count}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}

export default function SchemaOverview({ schema }) {
  const tables = Object.keys(schema.tables || {}).length;
  const views = Object.keys(schema.views || {}).length;
  const enums = (schema.enums || []).length;
  const matViews = (schema.interfaces?.materialized_views || []).length;
  const functions = (schema.interfaces?.functions || []).length;

  const totalCols = Object.values(schema.tables || {}).reduce(
    (sum, t) => sum + (t.columns?.length || 0), 0
  );
  const totalFks = Object.values(schema.tables || {}).reduce(
    (sum, t) => sum + (t.foreign_keys?.length || 0), 0
  );
  const totalIndexes = Object.values(schema.tables || {}).reduce(
    (sum, t) => sum + (t.indexes?.length || 0), 0
  );

  return (
    <div style={{ maxWidth: 960 }}>
      <h2 style={{ marginBottom: 4 }}>Schema Overview</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
        {schema.dialect} database with {tables} tables, {totalCols} columns, and {totalFks} relationships
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
        marginBottom: 32,
      }}>
        <StatCard icon={Table2} label="Tables" count={tables} color="#6c7cff" />
        <StatCard icon={Eye} label="Views" count={views} color="#a78bfa" />
        <StatCard icon={Hash} label="Enums" count={enums} color="#fbbf24" />
        <StatCard icon={ListTree} label="Mat. Views" count={matViews} color="#4ade80" />
        <StatCard icon={FunctionSquare} label="Functions" count={functions} color="#f87171" />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 32,
      }}>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{totalCols}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Columns</div>
        </div>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{totalFks}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Foreign Keys</div>
        </div>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{totalIndexes}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Indexes</div>
        </div>
      </div>

      {(schema.enums || []).length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Enums</h3>
          <div className="enum-grid">
            {schema.enums.map((e) => (
              <div key={e.name} className="enum-card">
                <h4>{e.name}</h4>
                <div className="enum-values">
                  {e.values.map((v) => (
                    <span key={v} className="enum-value">{v}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
