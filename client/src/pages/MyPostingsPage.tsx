import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Briefcase, MessageSquarePlus, Clock,
  CheckCircle2, Circle, MoreVertical, RefreshCw,
  Users, XCircle, Search, List, LayoutGrid, AlertTriangle, Trash2
} from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow, format } from "date-fns";

const platformIcons: Record<string, string> = {
  linkedin: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/LinkedIn_icon.svg/1280px-LinkedIn_icon.svg.png",
  indeed: "https://upload.wikimedia.org/wikipedia/commons/f/fc/Indeed_logo.svg",
  wordpress: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/WordPress_blue_logo.svg/960px-WordPress_blue_logo.svg.png?_=20170312030453",
};

export default function MyPostingsPage() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [confirmManage, setConfirmManage] = useState<{id: string, action: 'fulfill' | 'close' | 'relist' | 'delete'} | null>(null);
  const [manageResult, setManageResult] = useState<{
    status: "success" | "warning" | "error";
    title: string;
    detail: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: postings, isLoading } = useQuery({
    queryKey: ['jobPostings'],
    queryFn: async () => {
        const { data, error } = await supabase
          .from('jobPostings')
          .select('*')
          .order('createdAt', { ascending: false });

        if (error) throw error;

        const postingIds = (data ?? []).map((posting: any) => posting.id).filter(Boolean);
        let logs: any[] = [];

        if (postingIds.length) {
          const [{ data: logsByJobPostingId, error: jobPostingLogError }, { data: logsByPostingId, error: postingLogError }] =
            await Promise.all([
              supabase
                .from('jobPostingLogs')
                .select('jobPostingId, postingId, platform')
                .in('jobPostingId', postingIds),
              supabase
                .from('jobPostingLogs')
                .select('jobPostingId, postingId, platform')
                .in('postingId', postingIds),
            ]);

          if (jobPostingLogError) throw jobPostingLogError;
          if (postingLogError) throw postingLogError;

          logs = [...(logsByJobPostingId ?? []), ...(logsByPostingId ?? [])];
        }

        const logsByPostingId = (logs ?? []).reduce((acc: Record<string, any[]>, log: any) => {
          const id = String(log.jobPostingId || log.postingId || "");
          if (!id) return acc;
          acc[id] = acc[id] || [];
          acc[id].push(log);
          return acc;
        }, {});

        return (data ?? []).map((posting: any) => ({
          ...posting,
          postedAt: posting.postedAt ?? posting.createdAt,
          jobPostingLogs: logsByPostingId[String(posting.id)] ?? [],
        }));
    }
  });

  const { data: applicants } = useQuery({
    queryKey: ['applicants'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('applicants').select('id, jobPostingId');
        if (error) throw error;
        return data || [];
      } catch {
        return [];
      }
    }
  });

  const formatWpDebugError = (errorEntry: any) => {
    if (!errorEntry) {
      return "Unknown WordPress error";
    }

    if (typeof errorEntry === "string") {
      return errorEntry;
    }

    const response = typeof errorEntry.response === "string" ? errorEntry.response : "";
    const parsedResponse = (() => {
      if (!response) return "";
      try {
        const parsed = JSON.parse(response);
        return parsed?.message || parsed?.code || response;
      } catch {
        return response;
      }
    })();

    const details = [
      parsedResponse,
      errorEntry.postType ? `postType: ${errorEntry.postType}` : "",
      errorEntry.externalJobId ? `externalJobId: ${errorEntry.externalJobId}` : "",
      errorEntry.username ? `user: ${errorEntry.username}` : "",
    ].filter(Boolean);

    return details.join(" | ") || errorEntry.error || "Unknown WordPress error";
  };

  const managePostingMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string, action: 'fulfill' | 'close' | 'relist' | 'delete' }) => {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-posting`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                Authorization: `Bearer ${session?.access_token || ''}`,
            },
            body: JSON.stringify({ postingId: id, action })
        });
        if (!res.ok) {
            let errMessage = "Failed to update posting";
            try {
                const err = await res.json();
                errMessage = err.error || errMessage;
            } catch {}
            throw new Error(errMessage);
        }
        return await res.json();
    },
    onSuccess: (data, variables) => {
      if (data?.debug?.wpErrors?.length > 0) {
          console.error("WordPress manage-posting debug", data.debug);
          setManageResult({
            status: "error",
            title: "WordPress update failed",
            detail: formatWpDebugError(data.debug.wpErrors[0]),
          });
      } else if (data?.debug?.logsFound === 0) {
          setManageResult({
            status: "warning",
            title: "Updated with limited verification",
            detail: "The posting was updated locally, but no WordPress publishing log was found for this posting.",
          });
      }
      else if (variables.action === 'close') {
        setManageResult({
          status: "success",
          title: "Posting moved to draft",
          detail: "The posting was moved to draft locally and the WordPress listing was updated successfully.",
        });
      }
      else if (variables.action === 'delete') {
        setManageResult({
          status: "success",
          title: "Posting deleted permanently",
          detail: "The posting was permanently deleted from the dashboard, related local records were removed, and the linked WordPress listing was deleted.",
        });
      }
      else if (variables.action === 'relist') {
        setManageResult({
          status: "success",
          title: "Posting relisted",
          detail: "The posting is live again and the linked WordPress listing was republished successfully.",
        });
      }
      else {
        setManageResult({
          status: "success",
          title: "Posting fulfilled",
          detail: "The posting was marked as fulfilled and the linked WordPress listing was moved to draft.",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['jobPostings'] });
      queryClient.invalidateQueries({ queryKey: ['activityLogs'] });
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
    },
    onError: (e: Error) => {
      setManageResult({
        status: "error",
        title: "Update failed",
        detail: e.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const filteredPostings = [...(postings ?? [])].sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).filter((posting: any) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      posting.title,
      posting.description,
      posting.salaryRange,
    ].some(value => typeof value === "string" && value.toLowerCase().includes(query));

    const matchesStatus =
      statusFilter === "all" ||
      posting.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const applicantCounts = (applicants ?? []).reduce((acc: Record<string, number>, applicant: any) => {
    if (!applicant.jobPostingId) return acc;
    const key = String(applicant.jobPostingId);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search postings by title or keywords..."
            className="h-12 rounded-xl border-slate-200 bg-white pl-11 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="!h-12 min-w-[170px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="fulfilled">Fulfilled</SelectItem>
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

      {!postings || postings.length === 0 ? (
        <Card className="rounded-xl border border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
              <Briefcase className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-[#1F2937]">No job postings yet</p>
              <p className="text-sm text-gray-500 mt-1">Complete a hire request to create your first posting</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredPostings.length === 0 ? (
        <Card className="rounded-xl border border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <CardContent className="flex flex-col items-center gap-4 pb-12 pt-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <p className="font-medium text-[#1F2937]">No matching postings</p>
            <p className="text-sm text-gray-500">Try a different search or filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 2xl:grid-cols-3" : "grid gap-3"}>
          {filteredPostings.map((posting: any) => (
            <Card key={posting.id} className="h-full rounded-xl border border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_20px_48px_rgba(15,23,42,0.10)]">
              <CardContent className={viewMode === "grid" ? "flex h-full flex-col p-5" : "p-5"}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Briefcase className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{posting.title}</h3>
                      </div>
                    </div>
                  </div>

                  {/* Actions dropdown */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation(`/applicants?posting=${posting.id}`)}
                      className="h-8 text-slate-500 hover:text-slate-700"
                    >
                      <Users className="w-4 h-4 mr-1.5" />
                      {applicantCounts[String(posting.id)] || 0} Applicant{(applicantCounts[String(posting.id)] || 0) === 1 ? "" : "s"}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {(posting.status === 'open' || posting.status === 'active') && (
                          <DropdownMenuItem
                            onClick={() => setConfirmManage({ id: posting.id, action: 'fulfill' })}
                            className="text-emerald-700 focus:text-emerald-700 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Mark as Fulfilled
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => setConfirmManage({ id: posting.id, action: 'close' })}
                          className="text-amber-700 focus:text-amber-700 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Put in Draft
                        </DropdownMenuItem>
                        {(posting.status === 'draft' || posting.status === 'fulfilled') && (
                          <DropdownMenuItem
                            onClick={() => setConfirmManage({ id: posting.id, action: 'relist' })}
                            className="text-sky-700 focus:text-sky-700 cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Relist Posting
                          </DropdownMenuItem>
                        )}
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setConfirmManage({ id: posting.id, action: 'delete' })}
                            className="text-rose-700 focus:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Posting
                          </DropdownMenuItem>
                        </>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {posting.salaryRange && (
                  <div className="mt-4 text-sm font-semibold text-slate-600">
                    {posting.salaryRange}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2.5 overflow-x-auto pb-1">
                  <Badge className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold ${posting.status === "fulfilled" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : posting.status === "open" || posting.status === "active" ? "bg-blue-50 text-blue-700 border-blue-200" : posting.status === "draft" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                    {posting.status === "open" || posting.status === "active" ? <Circle className="w-4 h-4 mr-1.5" /> : posting.status === "fulfilled" ? <CheckCircle2 className="w-4 h-4 mr-1.5" /> : <XCircle className="w-4 h-4 mr-1.5" />}
                    {posting.status === "open" || posting.status === "active" ? "Open" : posting.status === "fulfilled" ? "Fulfilled" : posting.status === "draft" ? "Draft" : posting.status}
                  </Badge>
                  {posting.jobPostingLogs && posting.jobPostingLogs.length > 0 && Array.from(new Set(posting.jobPostingLogs.map((l: any) => l.platform).filter(Boolean))).map(platform => (
                    <Badge
                      key={platform as string}
                      variant="outline"
                      className="h-9 shrink-0 rounded-full border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 shadow-sm"
                    >
                      {platformIcons[platform as string] ? (
                        <img src={platformIcons[platform as string]} alt={platform as string} className="h-4 w-4 shrink-0 object-contain" />
                      ) : (
                        <span className="text-xs font-semibold uppercase">{String(platform).slice(0, 2)}</span>
                      )}
                    </Badge>
                  ))}
                  <div className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-500 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>{posting.postedAt ? formatDistanceToNow(new Date(posting.postedAt), { addSuffix: true }) : "Posted recently"}</span>
                  </div>
                </div>

                {posting.fulfilledAt && (
                  <div className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.08)]">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Fulfilled {format(new Date(posting.fulfilledAt), "MMM d, yyyy")}</span>
                  </div>
                )}

                {posting.description && (
                  <div className="mt-5 rounded-2xl border border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.98))] p-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Preview</p>
                    <p className="line-clamp-4 min-h-[6rem] text-sm leading-7 text-slate-600">{posting.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={confirmManage !== null} onOpenChange={(open) => !open && setConfirmManage(null)}>
        <AlertDialogContent>
          {managePostingMutation.isPending ? (
            <div className="py-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <div className="flex-1">
                  <AlertDialogTitle className="text-left">
                    {confirmManage?.action === 'close' ? "Moving posting to draft" :
                     confirmManage?.action === 'delete' ? "Deleting posting permanently" :
                     confirmManage?.action === 'relist' ? "Relisting posting" : "Marking posting as fulfilled"}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="mt-2 text-left">
                    Updating the local record and syncing the linked WordPress listing now.
                  </AlertDialogDescription>
                </div>
              </div>
            </div>
          ) : manageResult ? (
            <>
              <AlertDialogHeader>
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    manageResult.status === "success"
                      ? "bg-emerald-100 text-emerald-700"
                      : manageResult.status === "warning"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700"
                  }`}>
                    {manageResult.status === "success" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : manageResult.status === "warning" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <AlertDialogTitle className="text-left">{manageResult.title}</AlertDialogTitle>
                    <AlertDialogDescription className="mt-2 text-left">
                      {manageResult.detail}
                    </AlertDialogDescription>
                  </div>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button
                  className="bg-slate-950 text-white hover:bg-slate-800"
                  onClick={() => {
                    setManageResult(null);
                    setConfirmManage(null);
                  }}
                >
                  Continue
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirmManage?.action === 'close' ? "Move Posting to Draft?" :
                   confirmManage?.action === 'delete' ? "Delete Posting Permanently?" :
                   confirmManage?.action === 'relist' ? "Relist Posting?" : "Mark as Fulfilled?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmManage?.action === 'close'
                    ? "This will move the posting to draft locally and update the WordPress listing to draft as well."
                    : confirmManage?.action === 'delete'
                      ? "This will permanently delete the posting from the dashboard, remove related local records, and permanently delete the linked WordPress listing."
                    : confirmManage?.action === 'relist'
                      ? "This will relist the posting locally and republish the linked WordPress listing."
                      : "This will mark the posting as fulfilled locally and move the WordPress listing to draft."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  className={
                    confirmManage?.action === 'close' ? "bg-amber-600 hover:bg-amber-700 text-white" :
                    confirmManage?.action === 'delete' ? "bg-rose-600 hover:bg-rose-700 text-white" :
                    confirmManage?.action === 'relist' ? "bg-sky-600 hover:bg-sky-700 text-white" :
                    "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }
                  onClick={() => {
                    setManageResult(null);
                    confirmManage !== null && managePostingMutation.mutate(confirmManage);
                  }}
                >
                  {confirmManage?.action === 'close' ? "Move to Draft" :
                   confirmManage?.action === 'delete' ? "Delete Permanently" :
                   confirmManage?.action === 'relist' ? "Relist" : "Mark Fulfilled"}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
