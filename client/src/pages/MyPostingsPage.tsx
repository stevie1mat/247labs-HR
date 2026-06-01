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
  AlertDialogAction,
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
  Users, XCircle, Trash2, Search, List, LayoutGrid
} from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

export default function MyPostingsPage() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [confirmManage, setConfirmManage] = useState<{id: number, action: 'fulfill' | 'close' | 'delete'} | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: postings, isLoading } = useQuery({
    queryKey: ['jobPostings'],
    queryFn: async () => {
        const { data, error } = await supabase.from('jobPostings').select('*').order('createdAt', { ascending: false });
        if (error) throw error;
        return data;
    }
  });

  const managePostingMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number, action: 'fulfill' | 'close' | 'delete' }) => {
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
          toast.error(`WordPress failed to delete: ${data.debug.wpErrors[0]}`);
      } else if (data?.debug?.logsFound === 0) {
          toast.warning("Deleted locally, but NO WordPress log was found in database!");
      } else if (variables.action === 'delete') {
          toast.success("Job posting deleted");
      }
      else if (variables.action === 'close') toast.success("Job posting closed");
      else toast.success("Job marked as fulfilled");
      
      queryClient.invalidateQueries({ queryKey: ['jobPostings'] });
      setConfirmManage(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const filteredPostings = (postings ?? []).filter((posting: any) => {
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
                        <Badge className={`rounded-lg text-xs font-medium ${posting.status === "fulfilled" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : posting.status === "open" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {posting.status === "open" ? <Circle className="w-3 h-3 mr-1" /> : posting.status === "fulfilled" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                          {posting.status === "open" ? "Open" : posting.status === "fulfilled" ? "Fulfilled" : posting.status}
                        </Badge>
                      </div>
                      
                      {posting.salaryRange && (
                        <p className="text-sm font-medium text-slate-500 mt-1">{posting.salaryRange}</p>
                      )}

                      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                        <span>Active on:</span>
                        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 border-slate-200 bg-slate-50 text-slate-700 font-medium text-xs">
                          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/WordPress_blue_logo.svg/960px-WordPress_blue_logo.svg.png?_=20170312030453" alt="WordPress" className="w-3.5 h-3.5 mr-1.5" />
                          WordPress
                        </Badge>
                      </div>

                      <div className="mt-2 flex items-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Posted {posting.postedAt ? formatDistanceToNow(new Date(posting.postedAt), { addSuffix: true }) : "recently"}
                        </span>
                        {posting.fulfilledAt && (
                          <span className="flex items-center gap-1.5 text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Fulfilled {format(new Date(posting.fulfilledAt), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions dropdown */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" className="h-8 text-slate-500 hover:text-slate-700">
                      <Users className="w-4 h-4 mr-1.5" />
                      Applicants
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => setConfirmManage({ id: posting.id, action: 'fulfill' })}
                          className="text-emerald-700 focus:text-emerald-700 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Mark as Fulfilled
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setConfirmManage({ id: posting.id, action: 'close' })}
                          className="text-amber-700 focus:text-amber-700 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Close Posting
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setConfirmManage({ id: posting.id, action: 'delete' })}
                          className="text-rose-600 focus:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Posting
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {posting.description && (
                  <p className="mt-4 line-clamp-4 min-h-[6rem] text-sm leading-6 text-slate-500">{posting.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={confirmManage !== null} onOpenChange={(open) => !open && setConfirmManage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmManage?.action === 'delete' ? "Delete Posting?" : 
               confirmManage?.action === 'close' ? "Close Posting?" : "Mark as Fulfilled?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmManage?.action === 'delete' 
                ? "This will permanently delete the posting from the database and remove it entirely from WordPress. This action cannot be undone." 
                : "This will update the posting's status locally and switch the live WordPress post to a draft to hide it from the public."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmManage?.action === 'delete' ? "bg-rose-600 hover:bg-rose-700 text-white" :
                confirmManage?.action === 'close' ? "bg-amber-600 hover:bg-amber-700 text-white" :
                "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
              onClick={() => confirmManage !== null && managePostingMutation.mutate(confirmManage)}
              disabled={managePostingMutation.isPending}
            >
              {managePostingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {confirmManage?.action === 'delete' ? "Delete" : 
               confirmManage?.action === 'close' ? "Close" : "Mark Fulfilled"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
