import React, { useState } from 'react';
import { Send, Play, Copy, Check } from 'lucide-react';
import { textToSql, executeSql } from '../api/client';

export default function TextToSQL({ sessionId }) {
  const [question, setQuestion] = useState('');
  const [sql, setSql] = useState('');
  const [results, setResults] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!question.trim()) return;
    setGenerating(true);
    setError('');
    setSql('');
    setResults(null);
    try {
      const res = await textToSql(sessionId, question);
      setSql(res.sql);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleExecute = async () => {
    if (!sql.trim()) return;
    setExecuting(true);
    setError('');
    setResults(null);
    try {
      const res = await executeSql(sessionId, sql);
      setResults(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setExecuting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="sql-panel">
      <h2 style={{ marginBottom: 4 }}>Text to SQL</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Ask a question in plain English and get a SQL query generated from your schema.
      </p>

      <div className="sql-input-group">
        <input
          type="text"
          placeholder="e.g., Show me the top 10 users by total purchase amount"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleGenerate} disabled={generating || !question.trim()}>
          {generating ? <span className="spinner" /> : <Send size={16} />}
        </button>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

      {sql && (
        <div className="sql-output">
          <h3 style={{ fontSize: 13, marginBottom: 8, color: 'var(--text-secondary)' }}>Generated SQL</h3>
          <div className="sql-code-block">
            {sql}
            <div className="actions">
              <button className="btn btn-ghost btn-sm" onClick={handleCopy} title="Copy SQL">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleExecute} disabled={executing}>
                {executing ? <span className="spinner" /> : <><Play size={14} /> Run</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {results && (
        <div>
          <h3 style={{ fontSize: 13, marginBottom: 8, color: 'var(--text-secondary)' }}>
            Results {results.truncated && <span style={{ color: 'var(--warning)' }}>(truncated to 500 rows)</span>}
          </h3>
          {results.rows.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No rows returned.</p>
          ) : (
            <div className="results-table-wrapper" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="results-table">
                <thead>
                  <tr>
                    {results.columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map((row, i) => (
                    <tr key={i}>
                      {results.columns.map((col) => (
                        <td key={col}>{row[col] != null ? String(row[col]) : 'NULL'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
