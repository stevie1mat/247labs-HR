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
import { Loader2, Globe, Plus, Pencil, FlaskConical, Search, Link2, CheckCircle2 } from "lucide-react";

type SourcePlatform = "linkedin" | "upwork" | "indeed" | "wordpress" | "other";
type SourcePlatformOption =
  | "linkedin"
  | "upwork"
  | "indeed"
  | "wordpress"
  | "dubizzle_jobs_uae"
  | "wellfound"
  | "remotive"
  | "other";

const platformIcons: Record<string, string> = {
  linkedin: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/LinkedIn_icon.svg/1280px-LinkedIn_icon.svg.png",
  wordpress: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/WordPress_blue_logo.svg/960px-WordPress_blue_logo.svg.png?_=20170312030453",
  indeed: "https://d2q79iu7y748jz.cloudfront.net/s/_squarelogo/256x256/ff794fb897747bee7ebc1325d4b7a7da",
  upwork: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/upwork-icon.png",
  dubizzle_jobs_uae: "https://static.dubizzle.com/frontend-web/static-resources/assets/images/dubizzle-logo@2x.png",
  wellfound: "https://s3-eu-west-1.amazonaws.com/tpd/logos/6374d38ef759da4900b01966/0x0.png",
  remotive: "https://logos-world.net/wp-content/uploads/2022/01/Remotive-Emblem.png",
};

const platformLabels: Record<string, string> = {
  linkedin: "LinkedIn",
  upwork: "Upwork",
  indeed: "Indeed",
  wordpress: "WordPress",
  dubizzle_jobs_uae: "Dubizzle Jobs (UAE)",
  wellfound: "Wellfound",
  remotive: "Remotive",
  other: "Other",
};

const platformDescriptions: Record<SourcePlatformOption, string> = {
  linkedin: "Publish roles to your LinkedIn company hiring workflow.",
  upwork: "Distribute contract and freelance roles to Upwork.",
  indeed: "Connect your Indeed feed and publisher credentials.",
  wordpress: "Sync openings with your WordPress careers site.",
  dubizzle_jobs_uae: "Connect an AI-assisted distribution flow for Dubizzle Jobs (UAE).",
  wellfound: "Connect startup hiring distribution through Wellfound.",
  remotive: "Distribute remote-friendly openings through Remotive.",
  other: "Configure a custom source or external posting endpoint.",
};

const platformCatalog: SourcePlatformOption[] = [
  "linkedin",
  "wordpress",
  "indeed",
  "upwork",
  "dubizzle_jobs_uae",
  "wellfound",
  "remotive",
];

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
  wordpress: [
    { key: "siteUrl", label: "Site URL", placeholder: "https://yourcompany.com" },
    { key: "username", label: "Username", placeholder: "WordPress username" },
    { key: "applicationPassword", label: "Application Password", placeholder: "WordPress application password" },
    { key: "postType", label: "Post Type", placeholder: "career" },
  ],
  other: [
    { key: "apiKey", label: "API Key", placeholder: "API Key" },
    { key: "apiUrl", label: "API URL", placeholder: "https://api.example.com" },
  ],
};

export default function SourcesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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
  const [form, setForm] = useState({ name: "", platform: "linkedin" as SourcePlatformOption, isActive: true, isMockMode: true, credentials: {} as Record<string, string> });

  const linkedByPlatform = new Map<string, any>((sources ?? []).map((source: any) => [source.platform, source]));

  const filteredPlatforms = platformCatalog.filter((platform) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [platformLabels[platform], platformDescriptions[platform], platform]
        .some(value => typeof value === "string" && value.toLowerCase().includes(query));

    const matchesPlatform =
      platformFilter === "all" || platform === platformFilter;

    const linkedSource = linkedByPlatform.get(platform);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? linkedSource?.isActive === true : linkedSource?.isActive === false);

    return matchesSearch && matchesPlatform && matchesStatus;
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", platform: "linkedin", isActive: true, isMockMode: true, credentials: {} });
    setShowDialog(true);
  };

  const openCreateForPlatform = (platform: SourcePlatformOption) => {
    setEditingId(null);
    setForm({
      name: `${platformLabels[platform]} Source`,
      platform,
      isActive: true,
      isMockMode: true,
      credentials: {},
    });
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

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="w-full">
      <div className="mb-6 flex justify-end">
        <Button onClick={openCreate} className="rounded-md bg-primary text-white shadow-[0_10px_20px_rgba(120,19,124,0.16)] hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Source
        </Button>
      </div>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sources by name or platform..."
            className="h-12 rounded-xl border-slate-200 bg-white pl-11 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="!h-12 min-w-[190px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <SelectValue placeholder="All platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="wordpress">WordPress</SelectItem>
              <SelectItem value="upwork">Upwork</SelectItem>
              <SelectItem value="indeed">Indeed</SelectItem>
              <SelectItem value="dubizzle_jobs_uae">Dubizzle Jobs (UAE) — AI Agent</SelectItem>
              <SelectItem value="wellfound">Wellfound — AI Agent</SelectItem>
              <SelectItem value="remotive">Remotive — AI Agent</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="!h-12 min-w-[170px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredPlatforms.length === 0 ? (
        <Card className="rounded-xl border border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <CardContent className="flex flex-col items-center gap-4 pb-12 pt-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <p className="font-medium text-[#1F2937]">No matching sources</p>
            <p className="text-sm text-gray-500">Try a different search or filter combination.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredPlatforms.map((platform) => {
            const linkedSource = linkedByPlatform.get(platform);
            const isLinked = Boolean(linkedSource);

            return (
            <Card key={platform} className="rounded-xl border border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_20px_48px_rgba(15,23,42,0.10)]">
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 flex items-center justify-center shrink-0 overflow-hidden">
                    {platformIcons[platform] ? (
                      <img
                        src={platformIcons[platform]}
                        alt={`${platformLabels[platform]} logo`}
                        className="h-12 w-12 object-contain"
                      />
                    ) : (
                      <span className="text-xl">
                        {platform === "upwork" ? "🟢" : platform === "indeed" ? "🔴" : "⚫"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{platformLabels[platform]}</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-500">
                          {platformDescriptions[platform]}
                        </p>
                      </div>
                      {isLinked ? (
                        <Badge className="rounded-lg border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Linked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50 text-xs text-slate-500">
                          Not linked
                        </Badge>
                      )}
                    </div>
                    {isLinked && (
                      <div className="mt-4 flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50 text-xs">{linkedSource.name}</Badge>
                        {linkedSource.isMockMode && (
                        <Badge className="rounded-lg bg-amber-50 text-amber-700 border-amber-200 text-xs">
                          <FlaskConical className="w-3 h-3 mr-1" />
                          Mock Mode
                        </Badge>
                      )}
                        {!linkedSource.isActive && <Badge className="rounded-lg bg-gray-100 text-gray-500 border-gray-200 text-xs">Inactive</Badge>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex-1" />

                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  {isLinked ? (
                    <>
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                        <span className="text-xs font-medium text-slate-500">{linkedSource.isActive ? "Active" : "Inactive"}</span>
                        <Switch
                          checked={linkedSource.isActive}
                          onCheckedChange={v => toggleSource.mutate({ id: linkedSource.id, isActive: v })}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(linkedSource)}
                          className="h-9 rounded-md border-primary/20 px-3 text-xs text-primary shadow-[0_8px_18px_rgba(120,19,124,0.10)] hover:bg-primary/5"
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Manage
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      onClick={() => openCreateForPlatform(platform)}
                      className="h-9 rounded-md bg-primary px-4 text-xs text-white shadow-[0_10px_20px_rgba(120,19,124,0.16)] hover:bg-primary/90"
                    >
                      <Link2 className="mr-1 h-3.5 w-3.5" />
                      Link it
                    </Button>
                  )}
                </div>
                {isLinked && (
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {linkedSource.isMockMode ? "Sandbox mode — no real API calls" : "Live mode — real API credentials active"}
                  </p>
                )}
                {!isLinked && (
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    No credentials connected yet. Link this platform to include it in job distribution.
                  </p>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white">
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
                  <SelectTrigger className="mt-1 rounded-xl border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="wordpress">WordPress</SelectItem>
              <SelectItem value="upwork">Upwork</SelectItem>
              <SelectItem value="indeed">Indeed</SelectItem>
              <SelectItem value="dubizzle_jobs_uae">Dubizzle Jobs (UAE) — AI Agent</SelectItem>
              <SelectItem value="wellfound">Wellfound — AI Agent</SelectItem>
              <SelectItem value="remotive">Remotive — AI Agent</SelectItem>
            </SelectContent>
          </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={form.isMockMode} onCheckedChange={v => setForm(f => ({ ...f, isMockMode: v }))} />
              <Label className="text-sm">Mock/Sandbox Mode (no real API calls)</Label>
            </div>
            {!form.isMockMode && (
              <div className="space-y-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs font-medium text-amber-700">Live Mode — Enter real API credentials below</p>
                {fields.map(field => (
                  <div key={field.key}>
                    <Label className="text-xs font-medium text-gray-700">{field.label}</Label>
                    <Input
                      type="text"
                      value={form.credentials[field.key] ?? ""}
                      onChange={e => setForm(f => ({ ...f, credentials: { ...f.credentials, [field.key]: e.target.value } }))}
                      className="mt-1 text-sm rounded-xl border-slate-200"
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
            <Button onClick={handleSave} disabled={createSource.isPending || updateSource.isPending} className="rounded-md bg-primary hover:bg-primary/90 text-white shadow-[0_10px_20px_rgba(120,19,124,0.16)]">
              {(createSource.isPending || updateSource.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingId ? "Save Changes" : "Add Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
