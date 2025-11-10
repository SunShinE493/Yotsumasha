import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/queryClient';

export default function DevToolsPage() {
  const queryClient = useQueryClient();
  const [csrf, setCsrf] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [exportJson, setExportJson] = useState<string>('');
  const [importJson, setImportJson] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [incorrectOnly, setIncorrectOnly] = useState<boolean>(false);
  const [builtin, setBuiltin] = useState<{ name: string; wordCount: number|null }[]>([]);
  const [selectedBuiltin, setSelectedBuiltin] = useState<string>('');
  const [builtinContent, setBuiltinContent] = useState<string>('');

  useEffect(() => {
    fetch('/api/csrf', { credentials: 'same-origin' })
      .then(r=>r.json())
      .then(d=> setCsrf(d.csrfToken || '')); 
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest('GET', '/api/files');
        const data = await res.json();
        const list = Array.isArray(data?.builtin) ? data.builtin.map((f:any)=>({ name: f.name, wordCount: f.wordCount ?? null })) : [];
        setBuiltin(list);
      } catch {}
    })();
  }, []);

  const loadBuiltin = async (name: string) => {
    setSelectedBuiltin(name);
    try {
      // 読み込みは /src/components/data から直接は不可のため、/api/vocabulary?source= を使わず、/api/files は built-in 禁止。ここでは空テンプレ挿入→保存時に上書き。
      // 最低限、現在の文字数は出せない場合があるが、保存のたびに上書きする運用。
      // 可能ならサーバに専用GETを追加するが今回は簡易対応で空の配列か既存値を試行。
      const res = await fetch(`/src/components/data/${name}`, { credentials: 'same-origin' });
      if (res.ok) {
        const text = await res.text();
        setBuiltinContent(text);
      } else {
        setBuiltinContent('[]');
      }
    } catch {
      setBuiltinContent('[]');
    }
  };

  const saveBuiltin = async () => {
    if (!selectedBuiltin) return;
    try {
      const res = await apiRequest('POST', '/api/admin/files/builtin', { name: selectedBuiltin, content: builtinContent, email, password });
      if (!res.ok) {
        setStatus(`Save builtin failed (${res.status})`);
        return;
      }
      setStatus('Builtin saved');
      try { await apiRequest('POST', '/api/admin/backup/gist', {}); } catch {}
    } catch {
      setStatus('Save builtin error');
    }
  };

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
      // Invalidate caches so UI reflects imported data immediately
      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['/api/vocabulary/review'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/vocabulary'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/score-attack/me'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/datasets'] }),
        ]);
      } catch {}
      setStatus('Imported');
    } catch (e) {
      setStatus('Import error');
    }
  };

  const doBackupToGist = async () => {
    try {
      setStatus('Backing up to Gist...');
      const res = await fetch('/api/admin/backup/gist', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) { setStatus(`Backup failed (${res.status})`); return; }
      setStatus('Backed up to Gist');
    } catch (e) {
      setStatus('Backup error');
    }
  };

  const doFetchFromGist = async () => {
    try {
      setStatus('Fetching from Gist...');
      const res = await fetch('/api/admin/backup/gist/fetch', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, apply: true })
      });
      if (!res.ok) { setStatus(`Fetch failed (${res.status})`); return; }
      const data = await res.json();
      if (data && data.applied) {
        setStatus('Fetched from Gist and applied to storage');
        // Optionally clear textareas since data was applied
        setExportJson(data.content || exportJson);
        setImportJson(data.content || importJson);
        try {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['/api/vocabulary/review'] }),
            queryClient.invalidateQueries({ queryKey: ['/api/vocabulary'] }),
            queryClient.invalidateQueries({ queryKey: ['/api/score-attack/me'] }),
            queryClient.invalidateQueries({ queryKey: ['/api/datasets'] }),
          ]);
        } catch {}
      } else {
        setExportJson(data.content || '');
        setImportJson(data.content || '');
        setStatus('Fetched from Gist');
      }
    } catch (e) {
      setStatus('Fetch error');
    }
  };

  return (
    <div className="min-h-screen bg-background bg-[linear-gradient(to_bottom,transparent_0,transparent_calc(100%-2rem)),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.06),transparent_60%)]">
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
                    body: JSON.stringify({ email, password, all: true, ...(incorrectOnly ? { incorrectOnly: true } : { full: true }) })
                  });
                  if (!res.ok) { setStatus(`Export all failed (${res.status})`); return; }
                  const data = await res.json();
                  const str = JSON.stringify(data, null, 2);
                  setExportJson(str);
                  setStatus('Exported all users');
                } catch (e) { setStatus('Export all error'); }
              }}>Export ALL Users</Button>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={incorrectOnly} onChange={(e)=>setIncorrectOnly(e.target.checked)} />
                間違えた問題のみ（ALL）
              </label>
              <Button variant="outline" onClick={async ()=>{
                try {
                  setStatus('Exporting (full)...');
                  const res = await fetch('/api/admin/export', {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, full: true })
                  });
                  if (!res.ok) { setStatus(`Export failed (${res.status})`); return; }
                  const data = await res.json();
                  setExportJson(JSON.stringify(data, null, 2));
                  setStatus('Exported (full)');
                } catch (e) { setStatus('Export error'); }
              }}>Export FULL (me)</Button>
              <Button variant="outline" onClick={doBackupToGist}>Backup to Gist</Button>
              <Button variant="outline" onClick={doFetchFromGist}>Fetch from Gist</Button>
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
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">Builtin JSON Editor</h2>
            <div>
              <Label className="text-xs text-muted-foreground">内蔵ファイル</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {builtin.map(b => (
                  <button key={b.name}
                    className={`text-left px-3 py-2 rounded-md border ${selectedBuiltin===b.name?'bg-accent':'bg-background'} hover:bg-accent transition-colors`}
                    onClick={()=>loadBuiltin(b.name)}>
                    <div className="text-sm text-foreground">{b.name}</div>
                    <div className="text-xs text-muted-foreground">{typeof b.wordCount==='number'?`${b.wordCount} 語`:''}</div>
                  </button>
                ))}
              </div>
            </div>
            <Textarea className="min-h-[320px]" value={builtinContent} onChange={(e)=>setBuiltinContent(e.target.value)} placeholder='[ { "word": "apple", "meaning": "りんご" } ]' />
            <div className="flex gap-2">
              <Button onClick={saveBuiltin} disabled={!selectedBuiltin}>Save Builtin</Button>
              <div className="text-sm text-muted-foreground">{status}</div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
