import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function TableNode({ data }) {
  return (
    <div className="er-node">
      <Handle type="target" position={Position.Left} style={{ background: 'var(--accent)' }} />
      <div className="er-node-header">{data.label}</div>
      <div className="er-node-columns">
        {data.columns.map((col) => (
          <div key={col.name} className={`er-node-col ${col.isPk ? 'pk' : ''} ${col.isFk ? 'fk' : ''}`}>
            <span className="col-name">
              {col.isPk && '🔑 '}
              {col.isFk && '🔗 '}
              {col.name}
            </span>
            <span className="col-type">{col.type}</span>
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--success)' }} />
    </div>
  );
}

const nodeTypes = { tableNode: TableNode };

function buildGraph(schema) {
  const tables = schema.tables || {};
  const tableNames = Object.keys(tables);

  const COLS_PER_ROW = Math.max(3, Math.ceil(Math.sqrt(tableNames.length)));
  const X_GAP = 320;
  const Y_GAP = 300;

  const nodes = tableNames.map((name, i) => {
    const table = tables[name];
    const pkCols = new Set(table.primary_key?.columns || []);
    const fkCols = new Set(
      (table.foreign_keys || []).flatMap((fk) => fk.constrained_columns)
    );

    return {
      id: name,
      type: 'tableNode',
      position: {
        x: (i % COLS_PER_ROW) * X_GAP,
        y: Math.floor(i / COLS_PER_ROW) * Y_GAP,
      },
      data: {
        label: name,
        columns: table.columns.map((col) => ({
          name: col.name,
          type: col.type,
          isPk: pkCols.has(col.name),
          isFk: fkCols.has(col.name),
        })),
      },
    };
  });

  const edges = [];
  for (const [tableName, table] of Object.entries(tables)) {
    for (const fk of table.foreign_keys || []) {
      if (tableNames.includes(fk.referred_table)) {
        edges.push({
          id: `${tableName}-${fk.referred_table}-${fk.constrained_columns.join(',')}`,
          source: tableName,
          target: fk.referred_table,
          label: fk.constrained_columns.join(', '),
          type: 'smoothstep',
          animated: true,
          style: { stroke: 'var(--accent)', strokeWidth: 1.5 },
          labelStyle: { fontSize: 10, fill: 'var(--text-muted)' },
          labelBgStyle: { fill: 'var(--bg-primary)', fillOpacity: 0.9 },
        });
      }
    }
  }

  return { nodes, edges };
}

export default function ERDiagram({ schema }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(schema),
    [schema]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  if (Object.keys(schema.tables || {}).length === 0) {
    return (
      <div className="empty-state">
        <h3>No Tables Found</h3>
        <p>The database has no tables to visualize.</p>
      </div>
    );
  }

  return (
    <div className="er-diagram">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        colorMode="dark"
      >
        <Background color="var(--border)" gap={24} size={1} />
        <Controls />
        <MiniMap
          nodeColor="var(--bg-tertiary)"
          maskColor="rgba(0, 0, 0, 0.5)"
          style={{ background: 'var(--bg-secondary)' }}
        />
      </ReactFlow>
    </div>
  );
}
