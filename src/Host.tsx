import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Row {
  name: string;
  mastery: Record<string, number>;
  weakest: [string, number][];
}

function color(m: number): string {
  if (m < 0.4) return "bg-red-500/80 text-white";
  if (m < 0.7) return "bg-yellow-500/80 text-black";
  return "bg-green-500/80 text-white";
}

export default function Host() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  const concepts = rows ? [...new Set(rows.flatMap(r => Object.keys(r.mastery)))] : [];

  const load = () => {
    const tok = prompt("Token host:") || "";
    if (!tok) return;
    fetch("/api/host-matrix", { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => (r.ok ? r.json() : Promise.reject("token salah")))
      .then(d => setRows(d.participants))
      .catch(e => setErr(String(e)));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-xl font-semibold">Host view — mastery heatmap</h1>
      <p className="mb-4 text-sm text-muted-foreground">Peserta × konsep. Merah = perlu intervensi.</p>
      {err && <Card className="mb-4 p-3 text-sm text-red-500">{err}</Card>}
      {!rows && <Button onClick={load}>Masukkan token host</Button>}
      {rows && (
        <Card>
          <CardHeader><CardTitle className="text-base">{rows.length} peserta</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left">Peserta</th>
                  {concepts.map(c => <th key={c} className="p-2 text-left">{c.slice(0, 30)}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.name} className="border-t">
                    <td className="p-2 font-medium">{r.name}</td>
                    {concepts.map(c => {
                      const m = r.mastery[c];
                      return (
                        <td key={c} className="p-1">
                          {m === undefined
                            ? <span className="text-muted-foreground">—</span>
                            : <span className={`inline-block rounded px-2 py-1 ${color(m)}`}>{Math.round(m * 100)}%</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.every(r => Object.keys(r.mastery).length === 0) && (
              <p className="p-3 text-sm text-muted-foreground">Belum ada quiz yang dijawab.</p>
            )}
          </CardContent>
        </Card>
      )}
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="bg-red-500/80 text-white">&lt;40%</Badge>
        <Badge variant="secondary" className="bg-yellow-500/80 text-black">40-69%</Badge>
        <Badge variant="secondary" className="bg-green-500/80 text-white">≥70%</Badge>
      </div>
    </div>
  );
}