import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Globe, Plus, Pencil, Linkedin, FlaskConical } from "lucide-react";

const platformIcons: Record<string, string> = {
  linkedin: "🔵",
  upwork: "🟢",
  indeed: "🔴",
  other: "⚫",
};

const platformLabels: Record<string, string> = {
  linkedin: "LinkedIn",
  upwork: "Upwork",
  indeed: "Indeed",
  other: "Other",
};

const credentialFields: Record<string, { key: string; label: string; placeholder: string }[]> = {
  linkedin: [
    { key: "clientId", label: "Client ID", placeholder: "LinkedIn Client ID" },
    { key: "clientSecret", label: "Client Secret", placeholder: "LinkedIn Client Secret" },
    { key: "accessToken", label: "Access Token", placeholder: "OAuth Access Token" },
    { key: "companyId", label: "Company ID", placeholder: "LinkedIn Company Page ID" },
  ],
  upwork: [
    { key: "consumerKey", label: "Consumer Key", placeholder: "Upwork Consumer Key" },
    { key: "consumerSecret", label: "Consumer Secret", placeholder: "Upwork Consumer Secret" },
    { key: "accessToken", label: "Access Token", placeholder: "OAuth Access Token" },
    { key: "accessSecret", label: "Access Secret", placeholder: "OAuth Access Secret" },
  ],
  indeed: [
    { key: "feedUrl", label: "Feed URL", placeholder: "https://yoursite.com/api/indeed-feed" },
    { key: "publisherId", label: "Publisher ID", placeholder: "Indeed Publisher ID" },
  ],
  other: [
    { key: "apiKey", label: "API Key", placeholder: "API Key" },
    { key: "apiUrl", label: "API URL", placeholder: "https://api.example.com" },
  ],
};

export default function SourcesPage() {
  const queryClient = useQueryClient();

  const { data: sources, isLoading, refetch } = useQuery({
    queryKey: ['postingSources'],
    queryFn: async () => {
        const { data, error } = await supabase.from('postingSources').select('*').order('id', { ascending: true });
        if (error) throw error;
        return data;
    }
  });

  const createSource = useMutation({
    mutationFn: async (form: any) => {
        const { error } = await supabase.from('postingSources').insert([form]);
        if (error) throw error;
    },
    onSuccess: () => { refetch(); toast.success("Source added!"); setShowDialog(false); }
  });

  const updateSource = useMutation({
    mutationFn: async ({ id, ...form }: any) => {
        const { error } = await supabase.from('postingSources').update(form).eq('id', id);
        if (error) throw error;
    },
    onSuccess: () => { refetch(); toast.success("Source updated!"); setShowDialog(false); }
  });

  const toggleSource = useMutation({
    mutationFn: async ({ id, isActive }: { id: number, isActive: boolean }) => {
        const { error } = await supabase.from('postingSources').update({ isActive }).eq('id', id);
        if (error) throw error;
    },
    onSuccess: () => { refetch(); }
  });

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", platform: "linkedin" as "linkedin" | "upwork" | "indeed" | "other", isActive: true, isMockMode: true, credentials: {} as Record<string, string> });

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", platform: "linkedin", isActive: true, isMockMode: true, credentials: {} });
    setShowDialog(true);
  };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setForm({ name: s.name, platform: s.platform, isActive: s.isActive, isMockMode: s.isMockMode, credentials: (s.credentials as Record<string, string>) ?? {} });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("Name is required."); return; }
    if (editingId) {
      await updateSource.mutateAsync({ id: editingId, name: form.name, isActive: form.isActive, isMockMode: form.isMockMode, credentials: form.credentials });
    } else {
      await createSource.mutateAsync(form);
    }
  };

  const fields = credentialFields[form.platform] ?? credentialFields.other;

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" /></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#8B5CF6] flex items-center justify-center">
            <Globe className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1F2937]">Posting Sources</h1>
            <p className="text-sm text-gray-500">Configure job board integrations and credentials</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Source
        </Button>
      </div>

      {!sources || sources.length === 0 ? (
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <Globe className="w-6 h-6 text-gray-400" />
            </div>
            <p className="font-medium text-[#1F2937]">No posting sources configured</p>
            <p className="text-sm text-gray-500">Add LinkedIn, Upwork, or Indeed to start distributing jobs</p>
            <Button onClick={openCreate} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white">Add First Source</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sources.map((s: any) => (
            <Card key={s.id} className="border-0 shadow-sm bg-white">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-xl">
                    {platformIcons[s.platform]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-[#1F2937] text-sm">{s.name}</h3>
                      <Badge variant="outline" className="text-xs">{platformLabels[s.platform]}</Badge>
                      {s.isMockMode && (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                          <FlaskConical className="w-3 h-3 mr-1" />
                          Mock Mode
                        </Badge>
                      )}
                      {!s.isActive && <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {s.isMockMode ? "Sandbox mode — no real API calls" : "Live mode — real API credentials active"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{s.isActive ? "Active" : "Inactive"}</span>
                    <Switch
                      checked={s.isActive}
                      onCheckedChange={v => toggleSource.mutate({ id: s.id, isActive: v })}
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(s)} className="h-8 w-8 p-0 hover:bg-[#8B5CF6]/10 hover:text-[#8B5CF6]">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Posting Source" : "Add Posting Source"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder="e.g. LinkedIn Jobs" />
            </div>
            {!editingId && (
              <div>
                <Label className="text-sm font-medium">Platform *</Label>
                <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v as any, credentials: {} }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="upwork">Upwork</SelectItem>
                    <SelectItem value="indeed">Indeed</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={form.isMockMode} onCheckedChange={v => setForm(f => ({ ...f, isMockMode: v }))} />
              <Label className="text-sm">Mock/Sandbox Mode (no real API calls)</Label>
            </div>
            {!form.isMockMode && (
              <div className="space-y-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs font-medium text-amber-700">Live Mode — Enter real API credentials below</p>
                {fields.map(field => (
                  <div key={field.key}>
                    <Label className="text-xs font-medium text-gray-700">{field.label}</Label>
                    <Input
                      type="password"
                      value={form.credentials[field.key] ?? ""}
                      onChange={e => setForm(f => ({ ...f, credentials: { ...f.credentials, [field.key]: e.target.value } }))}
                      className="mt-1 text-sm"
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label className="text-sm">Active (include in job distribution)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createSource.isPending || updateSource.isPending} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white">
              {(createSource.isPending || updateSource.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingId ? "Save Changes" : "Add Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
