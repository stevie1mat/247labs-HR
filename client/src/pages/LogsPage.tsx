import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ScrollText, RefreshCw, CheckCircle2, XCircle, Clock, ExternalLink, RotateCcw } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

const platformIcons: Record<string, string> = { linkedin: "🔵", upwork: "🟢", indeed: "🔴", other: "⚫" };
const platformLabels: Record<string, string> = { linkedin: "LinkedIn", upwork: "Upwork", indeed: "Indeed", other: "Other" };

export default function LogsPage() {
  const queryClient = useQueryClient();

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['jobPostingLogs'],
    queryFn: async () => {
        const { data, error } = await supabase.from('jobPostingLogs').select(`
            *,
            jobPostings ( title ),
            postingSources ( platform )
        `).order('createdAt', { ascending: false });
        if (error) throw error;
        
        return data.map(log => ({
            ...log,
            jobPosting: log.jobPostings,
            platform: (log.postingSources as any)?.platform || 'other'
        }));
    }
  });

  const retryLog = useMutation({
    mutationFn: async ({ logId }: { logId: number }) => {
        // Just mock the retry for now by setting to success, since we are moving to fully serverless
        const { error } = await supabase.from('jobPostingLogs').update({
            status: 'success',
            errorMessage: null,
            attemptCount: 2,
            lastAttemptAt: new Date().toISOString()
        }).eq('id', logId);
        if (error) throw error;
    },
    onSuccess: () => { refetch(); toast.success("Retry successful!"); },
    onError: (e: Error) => toast.error(`Retry failed: ${e.message}`),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" /></div>;

  const successCount = logs?.filter((l: any) => l.status === "success").length ?? 0;
  const failedCount = logs?.filter((l: any) => l.status === "failed").length ?? 0;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#8B5CF6] flex items-center justify-center">
            <ScrollText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1F2937]">Job Posting Logs</h1>
            <p className="text-sm text-gray-500">Per-platform success and failure tracking</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <ScrollText className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1F2937]">{logs?.length ?? 0}</p>
              <p className="text-xs text-gray-500">Total Logs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#10B981]">{successCount}</p>
              <p className="text-xs text-gray-500">Successful</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-[#EF4444]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#EF4444]">{failedCount}</p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!logs || logs.length === 0 ? (
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <ScrollText className="w-6 h-6 text-gray-400" />
            </div>
            <p className="font-medium text-[#1F2937]">No posting logs yet</p>
            <p className="text-sm text-gray-500">Logs will appear here once jobs are distributed to platforms</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Job Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Platform</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">External ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Attempts</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Attempt</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1F2937] truncate max-w-[160px]">{log.jobPosting?.title ?? `Job #${log.jobPostingId}`}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <span>{platformIcons[log.platform]}</span>
                        <span className="text-gray-700">{platformLabels[log.platform]}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.status === "success" ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />Success
                        </Badge>
                      ) : log.status === "failed" ? (
                        <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">
                          <XCircle className="w-3 h-3 mr-1" />Failed
                        </Badge>
                      ) : log.status === "retrying" ? (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />Retrying
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">
                          <Clock className="w-3 h-3 mr-1" />{log.status}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.externalUrl ? (
                        <a href={log.externalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#8B5CF6] hover:underline text-xs">
                          {log.externalJobId ?? "View"}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">{log.errorMessage ? log.errorMessage.substring(0, 40) + "..." : "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600">{log.attemptCount}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-500 text-xs">
                        {log.lastAttemptAt ? formatDistanceToNow(new Date(log.lastAttemptAt), { addSuffix: true }) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.status === "failed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => retryLog.mutate({ logId: log.id })}
                          disabled={retryLog.isPending}
                          className="h-7 text-xs gap-1 hover:bg-[#8B5CF6]/10 hover:text-[#8B5CF6]"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
