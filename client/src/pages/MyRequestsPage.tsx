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
  Loader2, ListChecks, MessageSquarePlus, Clock,
  CheckCircle2, Send, AlertCircle, MoreVertical, Trash2, RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200", icon: Clock },
  pending_review: { label: "Pending Review", color: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertCircle },
  approved: { label: "Approved", color: "bg-blue-50 text-blue-700 border-blue-200", icon: CheckCircle2 },
  distributed: { label: "Distributed", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Send },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-600 border-red-200", icon: AlertCircle },
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "distributed", label: "Distributed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export default function MyRequestsPage() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['jobRequests'],
    queryFn: async () => {
        const { data, error } = await supabase.from('jobRequests').select('*').order('createdAt', { ascending: false });
        if (error) throw error;
        return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
        const { error } = await supabase.from('jobRequests').delete().eq('id', id);
        if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request deleted");
      queryClient.invalidateQueries({ queryKey: ['jobRequests'] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
        const { error } = await supabase.from('jobRequests').update({ status }).eq('id', id);
        if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ['jobRequests'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#8B5CF6] flex items-center justify-center">
            <ListChecks className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1F2937]">My Requests</h1>
            <p className="text-sm text-gray-500">Track all your hiring requests</p>
          </div>
        </div>
        <Button onClick={() => setLocation("/hire")} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white">
          <MessageSquarePlus className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>

      {!requests || requests.length === 0 ? (
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <ListChecks className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-[#1F2937]">No requests yet</p>
              <p className="text-sm text-gray-500 mt-1">Start a new hire request to get going</p>
            </div>
            <Button onClick={() => setLocation("/hire")} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white">
              Start New Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req: any) => {
            const config = statusConfig[req.status] ?? statusConfig.draft;
            const Icon = config.icon;
            return (
              <Card key={req.id} className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div
                    className="flex items-center gap-4 flex-1 cursor-pointer"
                    onClick={() => setLocation("/hire")}
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
                      <MessageSquarePlus className="w-5 h-5 text-[#8B5CF6]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#1F2937] text-sm">{req.title || "Untitled Request"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Created {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs border ${config.color}`}>
                      <Icon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Change Status
                        </div>
                        {STATUS_OPTIONS.map((opt) => (
                          <DropdownMenuItem
                            key={opt.value}
                            disabled={req.status === opt.value || updateStatusMutation.isPending}
                            onClick={() => updateStatusMutation.mutate({ id: req.id, status: opt.value })}
                            className={req.status === opt.value ? "font-semibold text-[#8B5CF6]" : ""}
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-2 opacity-60" />
                            {opt.label}
                            {req.status === opt.value && " ✓"}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => setDeleteId(req.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete Request
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this hiring request. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
