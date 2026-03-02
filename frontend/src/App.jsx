import React, { useState, useCallback } from 'react';
import { Download, Database } from 'lucide-react';
import ConnectionForm from './components/ConnectionForm';
import Sidebar from './components/Sidebar';
import TableDetail from './components/TableDetail';
import ERDiagram from './components/ERDiagram';
import TextToSQL from './components/TextToSQL';
import SchemaOverview from './components/SchemaOverview';
import { connectDb, extractSchema, disconnect } from './api/client';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'detail', label: 'Detail' },
  { id: 'diagram', label: 'ER Diagram' },
  { id: 'sql', label: 'Text to SQL' },
];

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selected, setSelected] = useState(null);

  const handleConnect = useCallback(async (creds) => {
    const { session_id } = await connectDb(creds);
    setSessionId(session_id);
    setLoading(true);
    try {
      const data = await extractSchema(session_id);
      setSchema(data);
      setActiveTab('overview');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (sessionId) {
      try { await disconnect(sessionId); } catch {}
    }
    setSessionId(null);
    setSchema(null);
    setSelected(null);
  }, [sessionId]);

  const handleSelect = useCallback((item) => {
    setSelected(item);
    setActiveTab('detail');
  }, []);

  const handleDownload = useCallback(() => {
    if (!schema) return;
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [schema]);

  if (!sessionId || !schema) {
    if (loading) {
      return (
        <div className="loading-screen">
          <div className="spinner" />
          <p>Extracting schema...</p>
        </div>
      );
    }
    return <ConnectionForm onConnect={handleConnect} />;
  }

  const getSelectedData = () => {
    if (!selected) return null;
    const { type, name } = selected;
    if (type === 'table') return schema.tables?.[name];
    if (type === 'view') return schema.views?.[name];
    if (type === 'enum') return schema.enums?.find((e) => e.name === name);
    if (type === 'matview') return schema.interfaces?.materialized_views?.find((v) => v.name === name);
    if (type === 'function') return schema.interfaces?.functions?.find((f) => f.name === name);
    return null;
  };

  return (
    <div className="app-container">
      <Sidebar
        schema={schema}
        active={selected}
        onSelect={handleSelect}
        onDisconnect={handleDisconnect}
        sessionId={sessionId}
      />
      <div className="main-content">
        <div className="main-header">
          <h1><Database size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />Schema Explorer</h1>
          <button className="btn btn-secondary btn-sm" onClick={handleDownload}>
            <Download size={14} /> Download JSON
          </button>
        </div>
        <div className="tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="content-area">
          {activeTab === 'overview' && <SchemaOverview schema={schema} />}
          {activeTab === 'detail' && (
            selected ? (
              <TableDetail name={selected.name} data={getSelectedData()} type={selected.type} />
            ) : (
              <div className="empty-state">
                <h3>Select an item</h3>
                <p>Choose a table, view, or other object from the sidebar to view its details.</p>
              </div>
            )
          )}
          {activeTab === 'diagram' && <ERDiagram schema={schema} />}
          {activeTab === 'sql' && <TextToSQL sessionId={sessionId} />}
        </div>
      </div>
    </div>
  );
}
