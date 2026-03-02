import React, { useState, useMemo } from 'react';
import { Table2, Eye, ListTree, Hash, FunctionSquare, ChevronDown, ChevronRight, Search, LogOut } from 'lucide-react';

function Section({ icon: Icon, label, items, active, onSelect, type }) {
  const [open, setOpen] = useState(true);
  if (!items || items.length === 0) return null;

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-header" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Icon size={12} />
        {label}
        <span style={{ marginLeft: 'auto', fontSize: 11 }}>{items.length}</span>
      </div>
      {open && items.map((name) => (
        <div
          key={`${type}-${name}`}
          className={`sidebar-item ${active?.type === type && active?.name === name ? 'active' : ''}`}
          onClick={() => onSelect({ type, name })}
        >
          {name}
        </div>
      ))}
    </div>
  );
}

export default function Sidebar({ schema, active, onSelect, onDisconnect, sessionId }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const filter = (arr) => arr.filter((n) => n.toLowerCase().includes(q));
    return {
      tables: filter(Object.keys(schema.tables || {})),
      views: filter(Object.keys(schema.views || {})),
      enums: filter((schema.enums || []).map((e) => e.name)),
      matViews: filter((schema.interfaces?.materialized_views || []).map((v) => v.name)),
      functions: filter((schema.interfaces?.functions || []).map((f) => f.name)),
    };
  }, [schema, search]);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Schema</h2>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {schema.dialect}
        </span>
      </div>
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search tables, views..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="sidebar-content">
        <Section icon={Table2} label="Tables" items={filtered.tables} active={active} onSelect={onSelect} type="table" />
        <Section icon={Eye} label="Views" items={filtered.views} active={active} onSelect={onSelect} type="view" />
        <Section icon={Hash} label="Enums" items={filtered.enums} active={active} onSelect={onSelect} type="enum" />
        <Section icon={ListTree} label="Materialized Views" items={filtered.matViews} active={active} onSelect={onSelect} type="matview" />
        <Section icon={FunctionSquare} label="Functions" items={filtered.functions} active={active} onSelect={onSelect} type="function" />
      </div>
      <div className="sidebar-footer">
        <button className="btn btn-ghost btn-sm" onClick={onDisconnect} title="Disconnect">
          <LogOut size={14} /> Disconnect
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
          {sessionId}
        </span>
      </div>
    </div>
  );
}
