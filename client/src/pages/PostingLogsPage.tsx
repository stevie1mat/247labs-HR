import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type JobPostingLog = {
  id: string;
  jobPostingId: string | null;
  postingSourceId: string | null;
  platform: string | null;
  status: string | null;
  externalJobId: string | null;
  externalUrl: string | null;
  attemptCount: number;
  lastAttemptAt: string;
  attemptedAt: string;
  errorMessage: string | null;
  jobPostings?: {
    title: string;
  };
};

const platformLabels: Record<string, string> = {
  linkedin: "LinkedIn",
  upwork: "Upwork",
  indeed: "Indeed",
  wordpress: "WordPress",
  wellfound: "Wellfound",
  remotive: "Remotive",
  dubizzle_jobs_uae: "Dubizzle Jobs",
  other: "Other",
};

const platformIcons: Record<string, string> = {
  linkedin: "in",
  upwork: "up",
  indeed: "id",
  wordpress: "wp",
  wellfound: "wf",
  remotive: "rm",
  dubizzle_jobs_uae: "du",
  other: "ot",
};

export default function PostingLogsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

  const { data: logs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["jobPostingLogs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobPostingLogs")
        .select("*, jobPostings(title)")
        .order("lastAttemptAt", { ascending: false });

      if (error) throw error;
      return (data ?? []) as JobPostingLog[];
    },
  });

  const retryLog = useMutation({
    mutationFn: async ({ logId }: { logId: string }) => {
      const { error } = await supabase
        .from("jobPostingLogs")
        .update({
          status: "pending",
          errorMessage: null,
          attemptCount: 1,
          lastAttemptAt: new Date().toISOString(),
        })
        .eq("id", logId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobPostingLogs"] });
      toast.success("Retry initiated!");
    },
    onError: (error: Error) => toast.error(`Retry failed: ${error.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const postingLogs = logs ?? [];
  const successfulCount = postingLogs.filter((log) => log.status === "success").length;
  const failedCount = postingLogs.filter((log) => log.status === "failed" || log.status === "error").length;
  const platforms = Array.from(new Set(postingLogs.map((log) => log.platform || "other")));

  const filteredLogs = postingLogs.filter((log) => {
    const query = search.trim().toLowerCase();
    const platformKey = log.platform || "other";
    const platformName = platformLabels[platformKey] || platformKey;
    const status = (log.status || "pending").toLowerCase();
    const title = log.jobPostings?.title || `Job #${log.jobPostingId?.slice(0, 6)}`;

    const matchesSearch =
      !query ||
      [title, platformName, log.externalJobId || "", log.errorMessage || "", status].some((value) =>
        value.toLowerCase().includes(query)
      );

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "success" && log.status === "success") ||
      (statusFilter === "failed" && (log.status === "failed" || log.status === "error")) ||
      (statusFilter === "pending" &&
        log.status !== "success" &&
        log.status !== "failed" &&
        log.status !== "error");

    const matchesPlatform = platformFilter === "all" || platformKey === platformFilter;

    return matchesSearch && matchesStatus && matchesPlatform;
  });

  const kpiCards = [
    {
      title: "Total logs",
      value: postingLogs.length.toString(),
      caption: "Distribution attempts captured",
      iconWrap: "bg-sky-500/15 text-sky-700",
      valueClass: "text-4xl text-slate-950",
      icon: FileText,
    },
    {
      title: "Successful",
      value: successfulCount.toString(),
      caption: "Logs that reached the destination",
      iconWrap: "bg-emerald-500/15 text-emerald-700",
      valueClass: "text-4xl text-slate-950",
      icon: CheckCircle2,
    },
    {
      title: "Failed",
      value: failedCount.toString(),
      caption: "Attempts that need attention",
      iconWrap: "bg-red-500/15 text-red-700",
      valueClass: "text-4xl text-slate-950",
      icon: XCircle,
    },
  ];

  return (
    <div className="w-full space-y-6 pb-4">
      <section className="grid gap-4 md:grid-cols-3">
        {kpiCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card
              key={card.title}
              className="group relative overflow-hidden rounded-xl border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-transform duration-300 hover:-translate-y-1"
            >
              <CardContent className="relative p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.iconWrap}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="rounded-lg border-slate-200/80 bg-white/70 px-2.5 py-1 text-[11px] text-slate-500">
                    Live
                  </Badge>
                </div>
                <div className="mt-8">
                  <p className="text-sm font-medium text-slate-500">{card.title}</p>
                  <p className={`mt-2 font-semibold ${card.valueClass}`}>{card.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{card.caption}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section>
        <Card className="overflow-hidden rounded-xl border-white/70 bg-white/88 py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <CardHeader className="border-b border-slate-200/70 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-950/10">
                <Filter className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-950">Job Posting Logs</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Per-platform success and failure tracking.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search job title, platform, external ID, or error..."
                  className="h-12 rounded-xl border-slate-200 bg-white pl-11 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="!h-12 min-w-[170px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All signals</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending / other</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="!h-12 min-w-[190px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All platforms</SelectItem>
                    {platforms.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platformLabels[platform] ?? platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  className="h-12 rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              {filteredLogs.length === 0 ? (
                <div className="px-3 pb-5 pt-5 sm:px-6">
                  <Empty className="rounded-xl border border-dashed border-slate-200 bg-slate-50">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Search />
                      </EmptyMedia>
                      <EmptyTitle>No posting logs found</EmptyTitle>
                      <EmptyDescription>Adjust the filters or wait for distribution attempts to populate the log.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Event</TableHead>
                        <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Role</TableHead>
                        <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Platform</TableHead>
                        <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">When</TableHead>
                        <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => {
                        const isSuccess = log.status === "success";
                        const isFailed = log.status === "failed" || log.status === "error";
                        const platformKey = log.platform || "other";
                        const platformName = platformLabels[platformKey] || log.platform;
                        const title = log.jobPostings?.title || `Job #${log.jobPostingId?.slice(0, 6)}`;

                        return (
                          <TableRow key={log.id} className="border-slate-200">
                            <TableCell className="px-5 py-4 align-top">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold uppercase ${
                                    isSuccess
                                      ? "bg-emerald-500/12 text-emerald-700"
                                      : isFailed
                                        ? "bg-red-500/12 text-red-700"
                                        : "bg-amber-500/12 text-amber-700"
                                  }`}
                                >
                                  {platformIcons[platformKey]?.toUpperCase() || "OT"}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-950">
                                    {isSuccess ? "Published externally" : isFailed ? "Distribution failed" : log.status || "Pending"}
                                  </p>
                                  <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
                                    {isSuccess
                                      ? `${title} reached ${platformName}${log.externalJobId ? ` with external ID ${log.externalJobId}` : ""}.`
                                      : isFailed
                                        ? (log.errorMessage || `Publishing to ${platformName} failed.`)
                                        : `${title} is still processing for ${platformName}.`}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="px-5 py-4 align-top">
                              <p className="text-sm font-medium text-slate-900">{title}</p>
                              <Badge
                                className={`mt-2 rounded-full px-2.5 py-1 text-[11px] ${
                                  isSuccess
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : isFailed
                                      ? "border-red-200 bg-red-50 text-red-700"
                                      : "border-amber-200 bg-amber-50 text-amber-700"
                                }`}
                              >
                                {isSuccess ? "Successful" : isFailed ? "Needs attention" : "Informational"}
                              </Badge>
                            </TableCell>

                            <TableCell className="px-5 py-4 align-top">
                              <p className="text-sm font-medium text-slate-900">{platformName}</p>
                              {log.externalJobId ? <p className="mt-1 text-sm text-slate-500">External ID: {log.externalJobId}</p> : null}
                              <p className="mt-1 text-xs text-slate-400">Attempts: {log.attemptCount}</p>
                            </TableCell>

                            <TableCell className="px-5 py-4 align-top">
                              <p className="text-sm font-medium text-slate-900">
                                {log.lastAttemptAt ? formatDistanceToNow(new Date(log.lastAttemptAt), { addSuffix: true }) : "-"}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {log.attemptedAt ? format(new Date(log.attemptedAt), "MMM d, yyyy p") : ""}
                              </p>
                            </TableCell>

                            <TableCell className="px-5 py-4 align-top">
                              <div className="flex flex-col items-start gap-2">
                                {log.externalUrl ? (
                                  <a
                                    href={log.externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                                  >
                                    View external
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                ) : null}
                                {isFailed ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => retryLog.mutate({ logId: log.id })}
                                    disabled={retryLog.isPending}
                                    className="gap-2 rounded-lg"
                                  >
                                    {retryLog.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                    Retry
                                  </Button>
                                ) : (
                                  <span className="text-xs text-slate-400">No action</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
