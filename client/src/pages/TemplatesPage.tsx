import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  FileText,
  Link2,
  LayoutGrid,
  Loader2,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Shuffle,
  Trash2,
  Wand2,
} from "lucide-react";
import { useLocation } from "wouter";

type GeneratedTemplate = {
  title: string;
  category: string;
  description: string;
  requirements: string;
  salaryRange: string;
};

const QUICK_PICKS = [
  "Front-End Developer",
  "Back-End Developer",
  "Full Stack Developer",
  "UI/UX Designer",
  "Product Manager",
  "DevOps Engineer",
  "Sales Manager",
  "QA Engineer",
];

const platformIcons: Record<string, string> = {
  linkedin: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/LinkedIn_icon.svg/1280px-LinkedIn_icon.svg.png",
  wordpress: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/WordPress_blue_logo.svg/960px-WordPress_blue_logo.svg.png?_=20170312030453",
  indeed: "https://d2q79iu7y748jz.cloudfront.net/s/_squarelogo/256x256/ff794fb897747bee7ebc1325d4b7a7da",
  upwork: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/upwork-icon.png",
  dubizzle_jobs_uae: "https://static.dubizzle.com/frontend-web/static-resources/assets/images/dubizzle-logo@2x.png",
  wellfound: "https://s3-eu-west-1.amazonaws.com/tpd/logos/6374d38ef759da4900b01966/0x0.png",
  remotive: "https://logos-world.net/wp-content/uploads/2022/01/Remotive-Emblem.png",
};

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<any | null>(null);
  const [postingTemplateId, setPostingTemplateId] = useState<number | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<number[]>([]);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateStep, setGenerateStep] = useState<1 | 2 | 3>(1);
  const [positionInput, setPositionInput] = useState("");
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate>({
    title: "",
    category: "",
    description: "",
    requirements: "",
    salaryRange: "",
  });
  const [form, setForm] = useState({ title: "", category: "", description: "", requirements: "", salaryRange: "", version: 1, isActive: true });

  const { data: templates, isLoading, refetch } = useQuery({
    queryKey: ["jobTemplates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobTemplates").select("*").order("id", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sources } = useQuery({
    queryKey: ["postingSources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("postingSources").select("*").eq("isActive", true);
      if (error) throw error;
      return data;
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("jobTemplates").insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      toast.success("Template created!");
      setShowDialog(false);
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const { error } = await supabase.from("jobTemplates").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      toast.success("Template updated!");
      setShowDialog(false);
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async ({ id }: any) => {
      const { error } = await supabase.from("jobTemplates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      toast.success("Template deleted.");
    },
  });

  const postFromTemplate = useMutation({
    mutationFn: async ({ templateId, sourceIds }: { templateId: number; sourceIds?: number[] }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/distribute-job`, {
        method: "POST",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ templateId, sourceIds }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Job posted successfully to all active platforms!");
      queryClient.invalidateQueries({ queryKey: ["jobPostings"] });
      queryClient.invalidateQueries({ queryKey: ["jobRequests"] });
      setPostingTemplateId(null);
      setSelectedSourceIds([]);
      setLocation("/my-postings");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateTemplate = useMutation({
    mutationFn: async ({ position }: { position: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("You must be signed in to generate a template.");
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-template`, {
        method: "POST",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ position }),
      });

      if (!res.ok) {
        const raw = await res.text();
        let parsedMessage = "";

        try {
          const parsed = JSON.parse(raw);
          parsedMessage = parsed.error ?? parsed.message ?? "";
        } catch {}

        throw new Error(parsedMessage || raw || "Failed to generate template.");
      }

      return res.json() as Promise<GeneratedTemplate>;
    },
    onSuccess: (data) => {
      setGeneratedTemplate({
        title: data.title ?? positionInput,
        category: data.category ?? "",
        description: data.description ?? "",
        requirements: data.requirements ?? "",
        salaryRange: data.salaryRange ?? "",
      });
      setGenerateStep(3);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to generate template. Please try again.");
      setGenerateStep(1);
    },
  });

  const filteredTemplates = (templates ?? []).filter((template: any) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      template.title,
      template.category,
      template.description,
      template.requirements,
      template.salaryRange,
    ].some(value => typeof value === "string" && value.toLowerCase().includes(query));

    const matchesCategory =
      categoryFilter === "all" ||
      (template.category ?? "").toLowerCase() === categoryFilter.toLowerCase();

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? template.isActive === true : template.isActive === false);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const availableCategories = Array.from(
    new Set(
      (templates ?? [])
        .map((template: any) => template.category)
        .filter((value: string | null | undefined): value is string => Boolean(value && value.trim()))
    )
  ).sort((a, b) => a.localeCompare(b));

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", category: "", description: "", requirements: "", salaryRange: "", version: 1, isActive: true });
    setShowDialog(true);
  };

  const openEdit = (template: any) => {
    setEditingId(template.id);
    setForm({
      title: template.title,
      category: template.category ?? "",
      description: template.description,
      requirements: template.requirements ?? "",
      salaryRange: template.salaryRange ?? "",
      version: template.version,
      isActive: template.isActive,
    });
    setShowDialog(true);
  };

  const openPostDialog = (templateId: number) => {
    setPostingTemplateId(templateId);
    setSelectedSourceIds((sources ?? []).map((source: any) => source.id));
  };

  const toggleSelectedSource = (sourceId: number) => {
    setSelectedSourceIds(prev => (
      prev.includes(sourceId)
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    ));
  };

  const resetGenerateDialog = () => {
    setShowGenerateDialog(false);
    setGenerateStep(1);
    setPositionInput("");
    setGeneratedTemplate({
      title: "",
      category: "",
      description: "",
      requirements: "",
      salaryRange: "",
    });
  };

  const handleSave = async () => {
    if (!form.title || !form.description) {
      toast.error("Title and description are required.");
      return;
    }

    if (editingId) {
      await updateTemplate.mutateAsync({ id: editingId, ...form });
    } else {
      await createTemplate.mutateAsync(form);
    }
  };

  const handleGenerate = async (position?: string) => {
    const value = (position ?? positionInput).trim();
    if (!value) {
      toast.error("Please enter a position first.");
      return;
    }

    setPositionInput(value);
    setGenerateStep(2);
    await generateTemplate.mutateAsync({ position: value });
  };

  const handleSaveGeneratedTemplate = async () => {
    if (!generatedTemplate.title || !generatedTemplate.description) {
      toast.error("Title and description are required.");
      return;
    }

    await createTemplate.mutateAsync({
      ...generatedTemplate,
      version: 1,
      isActive: true,
    });
    resetGenerateDialog();
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex justify-end">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowGenerateDialog(true)} className="rounded-md border-primary/30 text-primary shadow-[0_8px_18px_rgba(120,19,124,0.10)] hover:bg-primary/5">
            <Wand2 className="mr-2 h-4 w-4" />
            Generate with AI
          </Button>
          <Button onClick={openCreate} className="rounded-md bg-primary text-white shadow-[0_10px_20px_rgba(120,19,124,0.16)] hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates by title, category, or keywords..."
            className="h-12 rounded-xl border-slate-200 bg-white pl-11 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="!h-12 min-w-[190px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {availableCategories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
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

          <Button
            type="button"
            variant="outline"
            onClick={() => setViewMode(prev => prev === "grid" ? "list" : "grid")}
            className="h-12 min-w-[132px] rounded-md border-slate-200 bg-white px-4 text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)] hover:bg-slate-50"
          >
            {viewMode === "grid" ? (
              <>
                <List className="mr-2 h-4 w-4" />
                List view
              </>
            ) : (
              <>
                <LayoutGrid className="mr-2 h-4 w-4" />
                Grid view
              </>
            )}
          </Button>
        </div>
      </div>

      {!templates || templates.length === 0 ? (
        <Card className="rounded-xl border border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <CardContent className="flex flex-col items-center gap-4 pb-12 pt-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
              <FileText className="h-6 w-6 text-gray-400" />
            </div>
            <p className="font-medium text-[#1F2937]">No templates yet</p>
            <p className="text-sm text-gray-500">Create your first job template to speed up hiring</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => setShowGenerateDialog(true)} variant="outline" className="rounded-md border-primary/30 text-primary shadow-[0_8px_18px_rgba(120,19,124,0.10)] hover:bg-primary/5">
                <Wand2 className="mr-2 h-4 w-4" />
                Generate with AI
              </Button>
              <Button onClick={openCreate} className="rounded-md bg-primary text-white shadow-[0_10px_20px_rgba(120,19,124,0.16)] hover:bg-primary/90">
                Create Template
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : filteredTemplates.length === 0 ? (
        <Card className="rounded-xl border border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <CardContent className="flex flex-col items-center gap-4 pb-12 pt-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <p className="font-medium text-[#1F2937]">No matching templates</p>
            <p className="text-sm text-gray-500">Try a different search or create a new template with AI.</p>
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 2xl:grid-cols-3" : "grid gap-3"}>
          {filteredTemplates.map((template: any) => (
            <Card key={template.id} className="h-full rounded-xl border border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_20px_48px_rgba(15,23,42,0.10)]">
              <CardContent className={viewMode === "grid" ? "flex h-full flex-col p-5" : "p-5"}>
                {viewMode === "grid" ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{template.title}</h3>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50 text-xs">v{template.version}</Badge>
                            {template.category && <Badge className="rounded-lg border-primary/20 bg-primary/10 text-xs text-primary">{template.category}</Badge>}
                            {!template.isActive && <Badge className="rounded-lg border-gray-200 bg-gray-100 text-xs text-gray-500">Inactive</Badge>}
                          </div>
                          <p className="mt-3 line-clamp-4 min-h-[6rem] text-sm leading-6 text-slate-500">{template.description}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {template.salaryRange && (
                              <div className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                                {template.salaryRange}
                              </div>
                            )}
                            {template.category && (
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                                {template.category}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {!template.isActive && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                            Archived
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 flex-1" />

                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                      onClick={() => openPostDialog(template.id)}
                          disabled={!template.isActive || postFromTemplate.isPending}
                          className="h-9 flex-1 rounded-md bg-primary px-3 text-xs text-white shadow-[0_10px_20px_rgba(120,19,124,0.16)] hover:bg-primary/90"
                        >
                          {postFromTemplate.isPending && postingTemplateId === template.id ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="mr-1 h-3.5 w-3.5" />
                          )}
                          Post Job
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/hire?templateId=${template.id}`)}
                          className="h-9 flex-1 rounded-md border-primary/20 text-xs text-primary shadow-[0_8px_18px_rgba(120,19,124,0.10)] hover:bg-primary/5"
                        >
                          <Shuffle className="mr-1 h-3.5 w-3.5" />
                          Remix
                        </Button>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingTemplate(template)}
                          className="h-9 w-9 rounded-md border border-slate-200 bg-white p-0 text-slate-700 shadow-[0_8px_16px_rgba(120,19,124,0.06)] hover:bg-primary/5 hover:text-primary"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(template)} className="h-9 w-9 rounded-md border border-slate-200 bg-white p-0 text-slate-700 shadow-[0_8px_16px_rgba(120,19,124,0.06)] hover:bg-primary/10 hover:text-primary">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this template?")) deleteTemplate.mutate({ id: template.id }); }} className="h-9 w-9 rounded-md border border-slate-200 bg-white p-0 text-slate-700 shadow-[0_8px_16px_rgba(239,68,68,0.06)] hover:bg-red-50 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{template.title}</h3>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50 text-xs">v{template.version}</Badge>
                          {template.category && <Badge className="rounded-lg border-primary/20 bg-primary/10 text-xs text-primary">{template.category}</Badge>}
                          {!template.isActive && <Badge className="rounded-lg border-gray-200 bg-gray-100 text-xs text-gray-500">Inactive</Badge>}
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{template.description}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {template.salaryRange && (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                              {template.salaryRange}
                            </div>
                          )}
                          {template.category && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                              {template.category}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => openPostDialog(template.id)}
                        disabled={!template.isActive || postFromTemplate.isPending}
                        className="h-9 rounded-md bg-primary px-3 text-xs text-white shadow-[0_10px_20px_rgba(120,19,124,0.16)] hover:bg-primary/90"
                      >
                        {postFromTemplate.isPending && postingTemplateId === template.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="mr-1 h-3.5 w-3.5" />
                        )}
                        Post Job
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/hire?templateId=${template.id}`)}
                        className="h-9 rounded-md border-primary/20 text-xs text-primary shadow-[0_8px_18px_rgba(120,19,124,0.10)] hover:bg-primary/5"
                      >
                        <Shuffle className="mr-1 h-3.5 w-3.5" />
                        Remix
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingTemplate(template)}
                        className="h-9 w-9 rounded-md border border-slate-200 bg-white p-0 text-slate-700 shadow-[0_8px_16px_rgba(120,19,124,0.06)] hover:bg-primary/5 hover:text-primary"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(template)} className="h-9 w-9 rounded-md border border-slate-200 bg-white p-0 text-slate-700 shadow-[0_8px_16px_rgba(120,19,124,0.06)] hover:bg-primary/10 hover:text-primary">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this template?")) deleteTemplate.mutate({ id: template.id }); }} className="h-9 w-9 rounded-md border border-slate-200 bg-white p-0 text-slate-700 shadow-[0_8px_16px_rgba(239,68,68,0.06)] hover:bg-red-50 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={postingTemplateId !== null} onOpenChange={(open) => {
        if (!open && !postFromTemplate.isPending) {
          setPostingTemplateId(null);
          setSelectedSourceIds([]);
        }
      }}>
        <AlertDialogContent>
          {postFromTemplate.isPending ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-slate-900">Distributing Job...</h2>
              <p className="text-sm text-slate-500 mt-2 text-center max-w-[280px]">
                Please wait while we automatically post your job to all active platforms.
              </p>
            </div>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Post Job Now?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="mt-2 text-slate-500">
                    This will immediately post <strong>{templates?.find((template: any) => template.id === postingTemplateId)?.title}</strong> to the selected active platforms:
                    {sources && sources.length > 0 ? (
                      <div className="mt-3 flex flex-col gap-2">
                        {sources.map((s: any) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSelectedSource(s.id)}
                            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${selectedSourceIds.includes(s.id) ? "border-primary/30 bg-primary/5" : "border-slate-200 bg-slate-50"}`}
                          >
                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selectedSourceIds.includes(s.id) ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"}`}>
                              {selectedSourceIds.includes(s.id) ? <Check className="h-3.5 w-3.5" /> : null}
                            </div>
                            {platformIcons[s.platform] ? (
                              <img src={platformIcons[s.platform]} alt={s.platform} className="h-5 w-5 shrink-0 object-contain" />
                            ) : (
                              <div className="h-5 w-5 shrink-0 rounded bg-slate-200" />
                            )}
                            <span className="text-sm font-medium text-slate-700">{s.name || s.platform}</span>
                            {s.isMockMode && <Badge variant="outline" className="ml-auto bg-amber-50 text-amber-700 border-amber-200">Mock Mode</Badge>}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                        No active platforms. Please configure platforms in the sources page before posting.
                      </div>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-primary text-white hover:bg-primary/90"
                  onClick={(e) => {
                    e.preventDefault();
                    if (postingTemplateId !== null) {
                      postFromTemplate.mutate({ templateId: postingTemplateId, sourceIds: selectedSourceIds });
                    }
                  }}
                  disabled={postFromTemplate.isPending || !sources || sources.length === 0 || selectedSourceIds.length === 0}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Post Job
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Template" : "New Job Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Job Title *</Label>
                <Input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} className="mt-1" placeholder="e.g. Frontend Developer" />
              </div>
              <div>
                <Label className="text-sm font-medium">Category</Label>
                <Input value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))} className="mt-1" placeholder="e.g. Engineering" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Version</Label>
                <Input type="number" value={form.version} onChange={e => setForm(prev => ({ ...prev, version: parseInt(e.target.value, 10) || 1 }))} className="mt-1" min={1} />
              </div>
              <div>
                <Label className="text-sm font-medium">Salary Range</Label>
                <Input value={form.salaryRange} onChange={e => setForm(prev => ({ ...prev, salaryRange: e.target.value }))} className="mt-1" placeholder="e.g. $80,000 - $120,000" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Description *</Label>
              <Textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} className="mt-1 min-h-[120px]" placeholder="Job description..." />
            </div>
            <div>
              <Label className="text-sm font-medium">Requirements</Label>
              <Textarea value={form.requirements} onChange={e => setForm(prev => ({ ...prev, requirements: e.target.value }))} className="mt-1 min-h-[100px]" placeholder="Required skills and qualifications..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={value => setForm(prev => ({ ...prev, isActive: value }))} />
              <Label className="text-sm">Active (visible to AI assistant)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending} className="bg-primary text-white hover:bg-primary/90">
              {(createTemplate.isPending || updateTemplate.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingId ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewingTemplate !== null} onOpenChange={(open) => !open && setViewingTemplate(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
          </DialogHeader>
          {viewingTemplate && (
            <div className="space-y-6 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold tracking-[-0.02em] text-slate-950">{viewingTemplate.title}</h3>
                <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50 text-xs">v{viewingTemplate.version}</Badge>
                {viewingTemplate.category && (
                  <Badge className="rounded-lg border-primary/20 bg-primary/10 text-xs text-primary">{viewingTemplate.category}</Badge>
                )}
                {!viewingTemplate.isActive && (
                  <Badge className="rounded-lg border-gray-200 bg-gray-100 text-xs text-gray-500">Inactive</Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {viewingTemplate.salaryRange && (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    {viewingTemplate.salaryRange}
                  </div>
                )}
                {viewingTemplate.category && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    {viewingTemplate.category}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium">Description</Label>
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                  {viewingTemplate.description || "No description available."}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Requirements</Label>
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                  {viewingTemplate.requirements || "No requirements available."}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingTemplate(null)} className="rounded-md border-slate-200 shadow-[0_8px_18px_rgba(120,19,124,0.08)]">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGenerateDialog} onOpenChange={(open) => !open ? resetGenerateDialog() : setShowGenerateDialog(true)}>
        <DialogContent className="flex w-[min(1180px,calc(100vw-3rem))] sm:max-w-[1180px] max-h-[92vh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-[#f8fafc] p-0 shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
          <div className="shrink-0 border-b border-slate-200 bg-white px-8 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-[-0.03em] text-slate-950">Generate with AI</DialogTitle>
                <p className="mt-1 text-sm text-slate-500">Create a reusable template with the same clean workflow used across the dashboard.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <StepBadge step={1} label="Position" active={generateStep === 1} complete={generateStep > 1} />
              <StepBadge step={2} label="Generating" active={generateStep === 2} complete={generateStep > 2} />
              <StepBadge step={3} label="Review & Save" active={generateStep === 3} complete={false} />
            </div>
          </div>

          {generateStep === 1 && (
            <div className="overflow-y-auto px-8 py-8">
              <section className="rounded-xl border border-slate-200 bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700">
                    <Wand2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">Start with the role</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Enter a job title and AI will draft a structured, reusable template for your hiring team.
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Position</Label>
                  <div className="mt-3 flex gap-3">
                    <Input
                      value={positionInput}
                      onChange={e => setPositionInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleGenerate();
                        }
                      }}
                      placeholder="e.g. Front-End Developer"
                      className="h-14 rounded-xl border-slate-200 bg-white px-5 text-base shadow-none focus-visible:ring-0"
                    />
                    <Button
                      onClick={() => void handleGenerate()}
                      className="h-14 w-14 shrink-0 rounded-xl bg-primary p-0 text-white hover:bg-primary/90"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50/80 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Quick picks</p>
                      <h4 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-950">Popular roles</h4>
                    </div>
                    <Badge variant="outline" className="rounded-lg border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500">
                      Fast start
                    </Badge>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                  {QUICK_PICKS.map(pick => (
                    <button
                      key={pick}
                      onClick={() => setPositionInput(pick)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    >
                      {pick}
                    </button>
                  ))}
                </div>
                </div>
              </section>
            </div>
          )}

          {generateStep === 2 && (
            <div className="overflow-y-auto px-8 py-8">
              <div className="flex min-h-[360px] items-center justify-center py-2">
              <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">Generating template</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Building a reusable description, requirements, and salary suggestion for {positionInput}.
                    </p>
                    <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full w-2/3 rounded-full bg-primary" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}

          {generateStep === 3 && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="text-sm font-semibold">Job description generated. Review and refine before saving.</p>
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                  <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                    <div className="grid gap-5">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Job Title</Label>
                        <Input
                          value={generatedTemplate.title}
                          onChange={e => setGeneratedTemplate(prev => ({ ...prev, title: e.target.value }))}
                          className="mt-3 h-12 rounded-xl border-slate-200 px-4"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Category / Department</Label>
                        <Input
                          value={generatedTemplate.category}
                          onChange={e => setGeneratedTemplate(prev => ({ ...prev, category: e.target.value }))}
                          className="mt-3 h-12 rounded-xl border-slate-200 px-4"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Salary Range</Label>
                        <Input
                          value={generatedTemplate.salaryRange}
                          onChange={e => setGeneratedTemplate(prev => ({ ...prev, salaryRange: e.target.value }))}
                          className="mt-3 h-12 rounded-xl border-slate-200 px-4"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Snapshot</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {generatedTemplate.category && (
                          <Badge className="rounded-lg border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-primary">{generatedTemplate.category}</Badge>
                        )}
                        {generatedTemplate.salaryRange && (
                          <Badge variant="outline" className="rounded-lg border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700">{generatedTemplate.salaryRange}</Badge>
                        )}
                        <Badge variant="outline" className="rounded-lg border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700">AI draft</Badge>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</Label>
                      <Textarea
                        value={generatedTemplate.description}
                        onChange={e => setGeneratedTemplate(prev => ({ ...prev, description: e.target.value }))}
                        className="mt-3 min-h-[240px] rounded-xl border-slate-200 px-4 py-3 text-sm leading-7"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Requirements</Label>
                      <Textarea
                        value={generatedTemplate.requirements}
                        onChange={e => setGeneratedTemplate(prev => ({ ...prev, requirements: e.target.value }))}
                        className="mt-3 min-h-[180px] rounded-xl border-slate-200 px-4 py-3 text-sm leading-7"
                      />
                    </div>
                  </section>
                </div>
              </div>

              <div className="shrink-0 flex flex-col gap-3 border-t border-slate-200 bg-white px-8 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={() => setGenerateStep(1)} className="h-11 rounded-xl border-slate-200 px-5">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleGenerate(positionInput)}
                    disabled={generateTemplate.isPending}
                    className="h-11 rounded-xl border-primary/30 px-5 text-primary hover:bg-primary/5"
                  >
                    {generateTemplate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                    Regenerate
                  </Button>
                </div>
                <Button onClick={() => void handleSaveGeneratedTemplate()} className="h-11 rounded-xl bg-primary px-6 text-white hover:bg-primary/90">
                  <FileText className="mr-2 h-4 w-4" />
                  Save as Template
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepBadge({
  step,
  label,
  active,
  complete,
}: {
  step: number;
  label: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${active ? "border-primary/20 bg-primary/5 text-primary" : complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg font-semibold ${active ? "bg-primary text-white" : complete ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-400"}`}>
        {complete ? <Check className="h-5 w-5" /> : step}
      </div>
      <span className={active || complete ? "font-semibold" : "font-medium"}>{label}</span>
    </div>
  );
}
