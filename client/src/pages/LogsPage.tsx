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
  Clock3,
  ExternalLink,
  Filter,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type ActivityLogRecord = {
  id: string;
  action: string;
  category: string | null;
  entityType: string | null;
  entityId: string | null;
  title: string;
  detail: string | null;
  platform: string | null;
  sourceName: string | null;
  statusTone: "success" | "warning" | "neutral" | null;
  jobPostingId: string | null;
  templateId: string | null;
  postingSourceId: string | null;
  actorEmail: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
};

type ActivityItem = {
  id: string;
  category: string;
  title: string;
  detail: string;
  occurredAt: string;
  statusTone: "success" | "warning" | "neutral";
  eventLabel: string;
  platform: string;
  platformLabel: string;
  sourceName: string;
  jobTitle: string;
  attemptCount: number;
  logId?: string;
  externalUrl?: string | null;
  errorMessage?: string | null;
  actorEmail?: string | null;
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
  internal: "Internal",
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
  internal: "hr",
};

function normalizePlatform(platform?: string | null) {
  return platform && platformLabels[platform] ? platform : "other";
}

function actionLabel(action: string) {
  const actionLabels: Record<string, string> = {
    source_enabled: "Source enabled",
    source_disabled: "Source disabled",
    template_created: "Template created",
    template_updated: "Template updated",
    template_deleted: "Template deleted",
    job_distribution_requested: "Post requested",
    job_distribution_started: "Distribution started",
    distribution_succeeded: "Published externally",
    distribution_failed: "Distribution failed",
    job_posting_created: "Job posting created",
    job_posting_fulfilled: "Job fulfilled",
    job_posting_closed: "Job closed",
    job_posting_relisted: "Job relisted",
    job_posting_deleted: "Job deleted",
  };

  return actionLabels[action] ?? action.replace(/_/g, " ");
}

function toneClasses(tone: ActivityItem["statusTone"]) {
  if (tone === "success") {
    return {
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      iconWrap: "bg-emerald-500/12 text-emerald-700",
      line: "bg-emerald-300/80",
    };
  }

  if (tone === "warning") {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      iconWrap: "bg-amber-500/12 text-amber-700",
      line: "bg-amber-300/80",
    };
  }

  return {
    badge: "border-slate-200 bg-slate-100 text-slate-700",
    iconWrap: "bg-sky-500/12 text-sky-700",
    line: "bg-slate-300/80",
  };
}

export default function LogsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["activityLogs"],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from("activityLogs")
        .select("*")
        .order("createdAt", { ascending: false });

      if (error) throw error;

      const activityItems = ((logs ?? []) as ActivityLogRecord[]).map((log) => {
        const platform = normalizePlatform(log.platform);
        const platformLabel = platform === "other" && !log.platform ? platformLabels.internal : (platformLabels[platform] ?? log.platform ?? "Other");
        const metadata = log.metadata ?? {};
        const sourceName = log.sourceName || platformLabel || "247 Labs HR";
        const jobTitle = metadata.jobTitle || log.title;

        return {
          id: log.id,
          category: log.category || "operations",
          title: log.title,
          detail: log.detail || "Activity recorded.",
          occurredAt: log.createdAt,
          statusTone: log.statusTone || "neutral",
          eventLabel: actionLabel(log.action),
          platform: log.platform ? platform : "internal",
          platformLabel: log.platform ? (platformLabels[platform] ?? log.platform) : platformLabels.internal,
          sourceName,
          jobTitle,
          attemptCount: Number(metadata.attemptCount ?? 0),
          logId: metadata.logId ?? undefined,
          externalUrl: typeof metadata.externalUrl === "string" ? metadata.externalUrl : null,
          errorMessage: typeof metadata.errorMessage === "string" ? metadata.errorMessage : null,
          actorEmail: log.actorEmail,
        } satisfies ActivityItem;
      });

      return { activityItems };
    },
  });

  const retryLog = useMutation({
    mutationFn: async ({ logId }: { logId: string }) => {
      const { error } = await supabase.from("jobPostingLogs").update({
        status: "success",
        errorMessage: null,
        attemptCount: 2,
        lastAttemptAt: new Date().toISOString(),
      }).eq("id", logId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activityLogs"] });
      toast.success("Retry successful!");
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

  const activityItems = data?.activityItems ?? [];
  const categories = Array.from(new Set(activityItems.map((item) => item.category))).sort((a, b) => a.localeCompare(b));
  const searchableItems = activityItems.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [
        item.title,
        item.detail,
        item.platformLabel,
        item.sourceName,
        item.jobTitle,
        item.eventLabel,
      ].some((value) => value.toLowerCase().includes(query));

    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "success" && item.statusTone === "success") ||
      (statusFilter === "warning" && item.statusTone === "warning") ||
      (statusFilter === "neutral" && item.statusTone === "neutral");
    const matchesPlatform = platformFilter === "all" || item.platform === platformFilter;

    return matchesSearch && matchesCategory && matchesStatus && matchesPlatform;
  });

  const needsAttention = activityItems.filter((item) => item.statusTone === "warning").length;
  const successCount = activityItems.filter((item) => item.statusTone === "success").length;
  const latestEvent = activityItems[0]?.occurredAt ?? null;
  const platforms = Array.from(new Set(activityItems.map((item) => item.platform).filter((platform) => platform !== "internal")));
  const latestEventLabel = latestEvent ? formatDistanceToNow(new Date(latestEvent), { addSuffix: true }) : "No events yet";

  const kpiCards = [
    {
      title: "Total events",
      value: activityItems.length.toString(),
      caption: "Workflow and distribution activity captured",
      iconWrap: "bg-sky-500/15 text-sky-700",
      valueClass: "text-4xl text-slate-950",
      icon: Clock3,
    },
    {
      title: "Needs attention",
      value: needsAttention.toString(),
      caption: "Events that may need follow-up",
      iconWrap: "bg-amber-500/15 text-amber-700",
      valueClass: "text-4xl text-slate-950",
      icon: AlertTriangle,
    },
    {
      title: "Successful outcomes",
      value: successCount.toString(),
      caption: "Events resolved successfully",
      iconWrap: "bg-emerald-500/15 text-emerald-700",
      valueClass: "text-4xl text-slate-950",
      icon: CheckCircle2,
    },
    {
      title: "Latest activity",
      value: latestEventLabel,
      caption: "Most recent workflow signal",
      iconWrap: "bg-violet-500/15 text-violet-700",
      valueClass: "text-slate-950 text-2xl",
      icon: Sparkles,
    },
  ];

  return (
    <div className="w-full space-y-6 pb-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                <CardTitle className="text-lg font-semibold text-slate-950">Activity List</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Narrow events by workflow stage, signal, or destination</p>
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
                  placeholder="Search titles, platforms, or event details..."
                  className="h-12 rounded-xl border-slate-200 bg-white pl-11 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="!h-12 min-w-[190px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="!h-12 min-w-[170px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All signals</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Needs attention</SelectItem>
                    <SelectItem value="neutral">In progress / info</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="!h-12 min-w-[190px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All platforms</SelectItem>
                    <SelectItem value="internal">Internal only</SelectItem>
                    {platforms.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platformLabels[platform] ?? platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <div className="p-0">
            {searchableItems.length === 0 ? (
              <div className="px-3 pb-5 pt-5 sm:px-6">
                <Empty className="rounded-xl border border-dashed border-slate-200 bg-slate-50">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Target />
                    </EmptyMedia>
                    <EmptyTitle>No activity recorded yet</EmptyTitle>
                    <EmptyDescription>Once roles are created and distributed, the audit log will populate automatically.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Event</TableHead>
                    <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Role</TableHead>
                    <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Source</TableHead>
                    <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">When</TableHead>
                    <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchableItems.map((item) => {
                    const tones = toneClasses(item.statusTone);
                    const platformMark = platformIcons[item.platform] ?? "ot";

                    return (
                      <TableRow key={item.id} className="border-slate-200">
                        <TableCell className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold uppercase ${tones.iconWrap}`}>
                              {platformMark}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-950">{item.eventLabel}</p>
                              <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{item.detail}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-4 align-top">
                          <p className="text-sm font-medium text-slate-900">{item.jobTitle}</p>
                          <Badge className={`mt-2 rounded-full px-2.5 py-1 text-[11px] ${tones.badge}`}>
                            {item.statusTone === "warning" ? "Needs attention" : item.statusTone === "success" ? "Successful" : "Informational"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-5 py-4 align-top">
                          <p className="text-sm font-medium text-slate-900">{item.sourceName}</p>
                          <p className="mt-1 text-sm text-slate-500">{item.platformLabel}</p>
                          {item.actorEmail && <p className="mt-1 text-xs text-slate-400">By {item.actorEmail}</p>}
                          {item.attemptCount > 0 && <p className="mt-1 text-xs text-slate-400">Attempts: {item.attemptCount}</p>}
                        </TableCell>
                        <TableCell className="px-5 py-4 align-top">
                          <p className="text-sm font-medium text-slate-900">{format(new Date(item.occurredAt), "MMM d, yyyy")}</p>
                          <p className="mt-1 text-sm text-slate-500">{format(new Date(item.occurredAt), "p")}</p>
                          <p className="mt-1 text-xs text-slate-400">{formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })}</p>
                        </TableCell>
                        <TableCell className="px-5 py-4 align-top">
                          <div className="flex flex-col items-start gap-2">
                            {item.externalUrl && (
                              <a
                                href={item.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                              >
                                View external
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {item.statusTone === "warning" && item.logId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => retryLog.mutate({ logId: item.logId! })}
                                disabled={retryLog.isPending}
                                className="gap-2 rounded-lg"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Retry
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
