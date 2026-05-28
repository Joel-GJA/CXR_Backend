import React from 'react';

const MAP = {
  running:  'badge-running',
  ok:       'badge-ok',
  open:     'badge-open',
  starting: 'badge-starting',
  pending:  'badge-pending',
  loading:  'badge-loading',
  stopped:  'badge-stopped',
  stopping: 'badge-stopped',
  error:    'badge-error',
  closed:   'badge-closed',
  failed:   'badge-error',
};

export default function StatusBadge({ status }) {
  const s     = (status || 'unknown').toLowerCase();
  const cls   = MAP[s] || 'badge-unknown';
  return <span className={`badge ${cls}`}>{status || 'unknown'}</span>;
}
