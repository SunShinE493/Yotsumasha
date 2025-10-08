import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DevToolsPage() {
  const [csrf, setCsrf] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [exportJson, setExportJson] = useState<string>('');
  const [importJson, setImportJson] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    fetch('/api/csrf', { credentials: 'same-origin' })
      .then(r=>r.json())
      .then(d=> setCsrf(d.csrfToken || '')); 
  }, []);

  const doExport = async () => {
    try {
      setStatus('Exporting...');
      const res = await fetch('/api/admin/export', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 
          'Content-Type': 'application/json', 
          'CSRF-Token': csrf,
          'csrf-token': csrf,
          'x-csrf-token': csrf
        },
        body: JSON.stringify({ email, password, csrfToken: csrf })
      });
      if (!res.ok) { setStatus(`Export failed (${res.status})`); return; }
      const data = await res.json();
      const str = JSON.stringify(data, null, 2);
      setExportJson(str);
      setStatus('Exported');
    } catch (e) {
      setStatus('Export error');
    }
  };

  const doImport = async () => {
    try {
      setStatus('Importing...');
      const payload = JSON.parse(importJson);
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrf, 'csrf-token': csrf, 'x-csrf-token': csrf },
        body: JSON.stringify({ email, password, data: payload, csrfToken: csrf })
      });
      if (!res.ok) { setStatus(`Import failed (${res.status})`); return; }
      setStatus('Imported');
    } catch (e) {
      setStatus('Import error');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Developer Tools</h1>
          <a href="/" className="text-sm text-muted-foreground hover:underline">Home</a>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4 space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">Developer Email</label>
              <Input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="developper_mailAddress" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">Developer Password</label>
              <Input value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="password" type="password" />
            </div>
            <div className="flex gap-2 items-center">
              <Button onClick={doExport}>Export User Data</Button>
              <Button variant="outline" onClick={()=>{ setImportJson(exportJson); }}>Load Above as Import</Button>
              <Button variant="secondary" onClick={async ()=>{
                try {
                  setStatus('Exporting all users...');
                  const res = await fetch('/api/admin/export', {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, all: true })
                  });
                  if (!res.ok) { setStatus(`Export all failed (${res.status})`); return; }
                  const data = await res.json();
                  const str = JSON.stringify(data, null, 2);
                  setExportJson(str);
                  setStatus('Exported all users');
                } catch (e) { setStatus('Export all error'); }
              }}>Export ALL Users</Button>
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">Exported JSON</label>
              <textarea className="w-full h-60 rounded-md border border-border bg-background p-2 text-sm text-foreground" value={exportJson} onChange={(e)=>setExportJson(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">Import JSON</label>
              <textarea className="w-full h-60 rounded-md border border-border bg-background p-2 text-sm text-foreground" value={importJson} onChange={(e)=>setImportJson(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={doImport}>Import User Data</Button>
              <div className="text-sm text-muted-foreground">{status}</div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
