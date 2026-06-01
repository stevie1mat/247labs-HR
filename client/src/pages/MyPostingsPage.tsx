import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

export default function MyPostingsPage() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [confirmFulfill, setConfirmFulfill] = useState<number | null>(null);
  const [confirmReopen, setConfirmReopen] = useState<number | null>(null);

  const { data: postings, isLoading } = useQuery({
    queryKey: ['jobPostings'],
    queryFn: async () => {
        const { data, error } = await supabase.from('jobPostings').select('*').order('createdAt', { ascending: false });
        if (error) throw error;
        return data;
    }
  });

  const markFulfilledMutation = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
        const { error } = await supabase.from('jobPostings').update({
            status: 'fulfilled',
            fulfilledAt: new Date().toISOString()
        }).eq('id', id);
        if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job marked as fulfilled");
      queryClient.invalidateQueries({ queryKey: ['jobPostings'] });
      setConfirmFulfill(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopenMutation = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
        const { error } = await supabase.from('jobPostings').update({
            status: 'open',
            fulfilledAt: null
        }).eq('id', id);
        if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job reopened");
      queryClient.invalidateQueries({ queryKey: ['jobPostings'] });
      setConfirmReopen(null);
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

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1F2937]">My Job Postings</h1>
            <p className="text-sm text-gray-500">All jobs you've posted across platforms</p>
          </div>
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {postings.map((posting: any) => (
            <Card key={posting.id} className="h-full rounded-xl border border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_20px_48px_rgba(15,23,42,0.10)]">
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Briefcase className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{posting.title}</h3>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge className={`rounded-lg text-xs ${posting.status === "fulfilled" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : posting.status === "open" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {posting.status === "fulfilled" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Circle className="w-3 h-3 mr-1" />}
                          {posting.status === "open" ? "Open" : posting.status === "fulfilled" ? "Fulfilled" : posting.status}
                        </Badge>
                      </div>
                      {posting.salaryRange && (
                        <p className="text-xs text-slate-500 mt-2">{posting.salaryRange}</p>
                      )}
                      <div className="mt-3 flex items-center gap-4 text-xs font-medium text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Posted {posting.postedAt ? formatDistanceToNow(new Date(posting.postedAt), { addSuffix: true }) : "recently"}
                        </span>
                        {posting.fulfilledAt && (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" />
                            Fulfilled {format(new Date(posting.fulfilledAt), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600 shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {posting.status === "open" ? (
                        <DropdownMenuItem
                          onClick={() => setConfirmFulfill(posting.id)}
                          className="text-emerald-700 focus:text-emerald-700"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                          Mark as Fulfilled
                        </DropdownMenuItem>
                      ) : posting.status === "fulfilled" ? (
                        <DropdownMenuItem
                          onClick={() => setConfirmReopen(posting.id)}
                          className="text-blue-700 focus:text-blue-700"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-2" />
                          Reopen Posting
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {posting.description && (
                  <p className="mt-4 line-clamp-4 min-h-[6rem] text-sm leading-6 text-slate-500">{posting.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mark Fulfilled confirmation */}
      <AlertDialog open={confirmFulfill !== null} onOpenChange={(open) => !open && setConfirmFulfill(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Fulfilled?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the position as filled. You can reopen it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => confirmFulfill !== null && markFulfilledMutation.mutate({ id: confirmFulfill })}
              disabled={markFulfilledMutation.isPending}
            >
              {markFulfilledMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Mark Fulfilled
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reopen confirmation */}
      <AlertDialog open={confirmReopen !== null} onOpenChange={(open) => !open && setConfirmReopen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this posting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the posting status back to Open and clear the fulfilled date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => confirmReopen !== null && reopenMutation.mutate({ id: confirmReopen })}
              disabled={reopenMutation.isPending}
            >
              {reopenMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Reopen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
