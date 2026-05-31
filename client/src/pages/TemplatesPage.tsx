import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, FileText, Plus, Pencil, Trash2, Send } from "lucide-react";
import { useLocation } from "wouter";

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: templates, isLoading, refetch } = useQuery({
    queryKey: ['jobTemplates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobTemplates').select('*').order('id', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const createTemplate = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('jobTemplates').insert([form]);
      if (error) throw error;
    },
    onSuccess: () => { refetch(); toast.success("Template created!"); setShowDialog(false); }
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...form }: any) => {
      const { error } = await supabase.from('jobTemplates').update(form).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { refetch(); toast.success("Template updated!"); setShowDialog(false); }
  });

  const deleteTemplate = useMutation({
    mutationFn: async ({ id }: any) => {
      const { error } = await supabase.from('jobTemplates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { refetch(); toast.success("Template deleted."); }
  });

  const postFromTemplate = useMutation({
    mutationFn: async ({ templateId }: { templateId: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/distribute-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ templateId })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Job posted successfully to all active platforms!");
      queryClient.invalidateQueries({ queryKey: ['jobPostings'] });
      queryClient.invalidateQueries({ queryKey: ['jobRequests'] });
      setLocation("/postings");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [postingTemplateId, setPostingTemplateId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", category: "", description: "", requirements: "", salaryRange: "", version: 1, isActive: true });

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", category: "", description: "", requirements: "", salaryRange: "", version: 1, isActive: true });
    setShowDialog(true);
  };

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setForm({ title: t.title, category: t.category ?? "", description: t.description, requirements: t.requirements ?? "", salaryRange: t.salaryRange ?? "", version: t.version, isActive: t.isActive });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.description) { toast.error("Title and description are required."); return; }
    if (editingId) {
      await updateTemplate.mutateAsync({ id: editingId, ...form });
    } else {
      await createTemplate.mutateAsync(form);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" /></div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#8B5CF6] flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1F2937]">Job Templates</h1>
            <p className="text-sm text-gray-500">Manage reusable job description templates</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white">
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {!templates || templates.length === 0 ? (
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-gray-400" />
            </div>
            <p className="font-medium text-[#1F2937]">No templates yet</p>
            <p className="text-sm text-gray-500">Create your first job template to speed up hiring</p>
            <Button onClick={openCreate} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white">Create Template</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((t: any) => (
            <Card key={t.id} className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-[#1F2937] text-sm">{t.title}</h3>
                      <Badge variant="outline" className="text-xs">v{t.version}</Badge>
                      {t.category && <Badge className="bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20 text-xs">{t.category}</Badge>}
                      {!t.isActive && <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{t.description}</p>
                    {t.salaryRange && <p className="text-xs text-gray-400 mt-0.5">{t.salaryRange}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => setPostingTemplateId(t.id)}
                    disabled={!t.isActive || postFromTemplate.isPending}
                    className="h-8 px-3 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs"
                  >
                    {postFromTemplate.isPending && postingTemplateId === t.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1" />
                    )}
                    Post Job
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)} className="h-8 w-8 p-0 hover:bg-[#8B5CF6]/10 hover:text-[#8B5CF6]">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this template?")) deleteTemplate.mutate({ id: t.id }); }} className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Post Job confirmation dialog */}
      <AlertDialog open={postingTemplateId !== null} onOpenChange={(open) => !open && setPostingTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post Job Now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately post <strong>{templates?.find((t: any) => t.id === postingTemplateId)?.title}</strong> to all active platforms (LinkedIn, Upwork, Indeed) in mock/sandbox mode.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
              onClick={() => postingTemplateId !== null && postFromTemplate.mutate({ templateId: postingTemplateId })}
              disabled={postFromTemplate.isPending}
            >
              {postFromTemplate.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Post Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Template" : "New Job Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Job Title *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" placeholder="e.g. Frontend Developer" />
              </div>
              <div>
                <Label className="text-sm font-medium">Category</Label>
                <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="mt-1" placeholder="e.g. Engineering" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Version</Label>
                <Input type="number" value={form.version} onChange={e => setForm(f => ({ ...f, version: parseInt(e.target.value) || 1 }))} className="mt-1" min={1} />
              </div>
              <div>
                <Label className="text-sm font-medium">Salary Range</Label>
                <Input value={form.salaryRange} onChange={e => setForm(f => ({ ...f, salaryRange: e.target.value }))} className="mt-1" placeholder="e.g. $80,000 - $120,000" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Description *</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1 min-h-[120px]" placeholder="Job description..." />
            </div>
            <div>
              <Label className="text-sm font-medium">Requirements</Label>
              <Textarea value={form.requirements} onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))} className="mt-1 min-h-[100px]" placeholder="Required skills and qualifications..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label className="text-sm">Active (visible to AI assistant)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white">
              {(createTemplate.isPending || updateTemplate.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingId ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
