import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  Briefcase,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  MoveUpRight,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const platformIcons: Record<string, string> = {
  linkedin: "in",
  wordpress: "wp",
  wellfound: "wf",
  remotive: "rm",
  upwork: "up",
  indeed: "id",
  dubizzle_jobs_uae: "du",
  other: "ot",
};
const platformLabels: Record<string, string> = {
  linkedin: "LinkedIn",
  wordpress: "WordPress",
  wellfound: "Wellfound",
  remotive: "Remotive",
  upwork: "Upwork",
  indeed: "Indeed",
  dubizzle_jobs_uae: "Dubizzle Jobs",
  other: "Other",
};
const chartColors = ["#8b5cf6", "#10b981", "#ef4444", "#f59e0b", "#0f172a"];

function formatDays(value: number | null) {
  return `${value ?? 0}d`;
}

function getPostingAgeDays(postedAt?: string | null, fulfilledAt?: string | null) {
  if (!postedAt) return null;
  const end = fulfilledAt ? new Date(fulfilledAt).getTime() : Date.now();
  return Math.max(0, Math.round((end - new Date(postedAt).getTime()) / (1000 * 60 * 60 * 24)));
}

function ageToneClass(days: number | null) {
  if (days == null) return "text-slate-400";
  if (days <= 7) return "text-emerald-600";
  if (days <= 14) return "text-sky-600";
  return "text-amber-500";
}

export default function DashboardPage() {
  const queryClient = useQueryClient();

  const { data: board, isLoading: boardLoading } = useQuery({
    queryKey: ["hrBoard"],
    queryFn: async () => {
      const [{ data: postings, error: postingsError }, { data: postingLogs, error: logsError }] = await Promise.all([
        supabase
          .from("jobPostings")
          .select("id, title, status, salaryRange, createdAt, fulfilledAt, isWpDraft")
          .order("createdAt", { ascending: false }),
        supabase
          .from("jobPostingLogs")
          .select("jobPostingId, platform, status"),
      ]);

      if (postingsError) throw postingsError;
      if (logsError) throw logsError;

      const successfulPlatformsByPosting = (postingLogs ?? []).reduce((acc: Record<string, string[]>, log: any) => {
        if (log.status !== "success" || !log.jobPostingId || !log.platform) {
          return acc;
        }

        if (!acc[log.jobPostingId]) {
          acc[log.jobPostingId] = [];
        }

        if (!acc[log.jobPostingId].includes(log.platform)) {
          acc[log.jobPostingId].push(log.platform);
        }

        return acc;
      }, {});

      return (postings || []).map((posting: any) => ({
        ...posting,
        postedAt: posting.createdAt,
        platforms: successfulPlatformsByPosting[posting.id] ?? [],
      }));
    },
  });

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["kpis"],
    queryFn: async () => {
      const { data: postings, error } = await supabase.from("jobPostings").select("*");
      if (error) throw error;
      if (!postings) return { totalPostings: 0, totalOpen: 0, totalFulfilled: 0, avgTimeToFill: null };

      const fulfilled = postings.filter(posting => posting.status === "fulfilled");
      let totalDays = 0;
      fulfilled.forEach(posting => {
        if (posting.fulfilledAt && posting.createdAt) {
          totalDays += (new Date(posting.fulfilledAt).getTime() - new Date(posting.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        }
      });

      return {
        totalPostings: postings.length,
        totalOpen: postings.filter(posting => posting.status === "active" || posting.status === "open").length,
        totalFulfilled: fulfilled.length,
        avgTimeToFill: fulfilled.length > 0 ? Math.round(totalDays / fulfilled.length) : null,
      };
    },
  });

  const markFulfilled = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-posting`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ postingId: id, action: "fulfill" }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hrBoard"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
      queryClient.invalidateQueries({ queryKey: ["activityLogs"] });
      toast.success("Job marked as fulfilled!");
    },
  });

  const isLoading = kpisLoading || boardLoading;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const rows = board ?? [];
  const totalPostings = kpis?.totalPostings ?? 0;
  const totalOpen = kpis?.totalOpen ?? 0;
  const totalFulfilled = kpis?.totalFulfilled ?? 0;
  const avgTimeToFill = kpis?.avgTimeToFill ?? null;
  const platformCounts = rows.reduce((acc: Record<string, number>, row: any) => {
    (row.platforms ?? []).forEach((platform: string) => {
      acc[platform] = (acc[platform] ?? 0) + 1;
    });
    return acc;
  }, {});

  const pieData = Object.entries(platformCounts).map(([name, value]) => ({
    name: platformLabels[name] ?? name,
    value,
  }));

  const monthlyDataMap = rows.reduce((acc: Record<string, { open: number; fulfilled: number }>, row: any) => {
    const month = row.postedAt ? format(new Date(row.postedAt), "MMM") : "Unknown";
    if (!acc[month]) acc[month] = { open: 0, fulfilled: 0 };
    if (row.status === "fulfilled") acc[month].fulfilled += 1;
    else acc[month].open += 1;
    return acc;
  }, {});

  const barData = Object.entries(monthlyDataMap).map(([month, counts]) => ({ month, ...counts }));

  const kpiCards = [
    {
      title: "Total Jobs Posted",
      value: totalPostings.toString(),
      caption: "All postings created in the pipeline",
      iconWrap: "bg-violet-500/15 text-violet-700",
      valueClass: "text-slate-950",
      icon: Briefcase,
    },
    {
      title: "Open Positions",
      value: totalOpen.toString(),
      caption: "Positions currently in market",
      iconWrap: "bg-sky-500/15 text-sky-700",
      valueClass: "text-slate-950",
      icon: Circle,
    },
    {
      title: "Fulfilled",
      value: totalFulfilled.toString(),
      caption: "Closed successfully",
      iconWrap: "bg-emerald-500/15 text-emerald-700",
      valueClass: "text-slate-950",
      icon: CheckCircle2,
    },
    {
      title: "Avg. Time to Fill",
      value: formatDays(avgTimeToFill),
      caption: "Measured across fulfilled postings",
      iconWrap: "bg-amber-500/15 text-amber-700",
      valueClass: "text-slate-950",
      icon: Clock,
    },
  ];

  return (
    <div className="w-full space-y-6 pb-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map(card => {
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
                  <MoveUpRight className="h-4 w-4 text-slate-300" />
                </div>
                <div className="mt-8">
                  <p className="text-sm font-medium text-slate-500">{card.title}</p>
                  <p className={`mt-2 text-4xl font-semibold tracking-[-0.04em] ${card.valueClass}`}>{card.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{card.caption}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden rounded-xl border-white/70 bg-white/88 py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <CardHeader className="border-b border-slate-200/70 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-950/10">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-950">Monthly Job Postings</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Created and fulfilled job volume by month</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-4 pt-5 sm:px-6">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData} barGap={10}>
                  <defs>
                    <linearGradient id="dashboardOpenBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.28} />
                    </linearGradient>
                    <linearGradient id="dashboardFulfilledBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.28} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 6" />
                  <XAxis axisLine={false} tickLine={false} dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                    contentStyle={{
                      borderRadius: 18,
                      border: "1px solid rgba(226,232,240,0.9)",
                      boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
                    }}
                  />
                    <Bar dataKey="open" name="Open" fill="url(#dashboardOpenBar)" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="fulfilled" name="Fulfilled" fill="url(#dashboardFulfilledBar)" radius={[8, 8, 0, 0]} />
                  </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-slate-500">
                No posting trend data yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-xl border-white/70 bg-white/88 py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <CardHeader className="border-b border-slate-200/70 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-700">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-950">Distribution by Platform</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Which platforms are carrying your distribution</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-5 pt-5 sm:px-6">
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={92}
                      paddingAngle={4}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 18,
                        border: "1px solid rgba(226,232,240,0.9)",
                        boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="mt-2 grid gap-2">
                  {pieData.map((item, index) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-lg border border-slate-200/70 bg-slate-50/80 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-950">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-[320px] items-center justify-center text-sm text-slate-500">
                No successful platform distribution yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="overflow-hidden rounded-xl border border-white/70 bg-white/88 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="border-b border-slate-200/70 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-950">HR Board — All Job Postings</h2>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <Briefcase className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold text-slate-950">No job postings yet</p>
            <p className="max-w-md text-sm leading-6 text-slate-500">
              Create your first hiring request and the board will start filling with live recruiting activity.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Job Title</TableHead>
                <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Date Posted</TableHead>
                <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Platforms</TableHead>
                <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</TableHead>
                <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Days Since Posted</TableHead>
                <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Time to Fill</TableHead>
                <TableHead className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: any) => {
                const daysSincePosted = getPostingAgeDays(row.postedAt, null);
                const timeToFill = row.status === "fulfilled" ? getPostingAgeDays(row.postedAt, row.fulfilledAt) : null;
                const isOpen = row.status === "open" || row.status === "active";
                const statusLabel = isOpen ? "Open" : row.status === "fulfilled" ? "Fulfilled" : row.status;

                return (
                  <TableRow key={row.id} className="border-slate-200">
                    <TableCell className="px-5 py-4 align-top">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">{row.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{row.salaryRange || "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 align-top">
                      <p className="text-sm text-slate-700">{row.postedAt ? format(new Date(row.postedAt), "MMM d, yyyy") : "—"}</p>
                    </TableCell>
                    <TableCell className="px-5 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {(row.platforms ?? []).length > 0 ? (
                          row.platforms.map((platform: string) => (
                            <div
                              key={platform}
                              title={platformLabels[platform] ?? platform}
                              className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold uppercase text-slate-600"
                            >
                              {platformIcons[platform] ?? platform.slice(0, 2)}
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        {statusLabel === "Fulfilled" ? (
                          <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Fulfilled
                          </Badge>
                        ) : statusLabel === "Open" ? (
                          <Badge className="rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">
                            <Circle className="mr-1 h-3.5 w-3.5" />
                            Open
                          </Badge>
                        ) : (
                          <Badge className="rounded-full border-slate-200 bg-slate-100 px-3 py-1 text-slate-600">
                            {statusLabel}
                          </Badge>
                        )}
                        {row.isWpDraft && (
                          <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            Draft on WP
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 align-top">
                      <div className={`flex items-center gap-1.5 text-sm font-medium ${ageToneClass(daysSincePosted)}`}>
                        <Clock className="h-3.5 w-3.5" />
                        {formatDays(daysSincePosted)}
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 align-top">
                      <p className="text-sm font-medium text-slate-700">{row.status === "fulfilled" ? formatDays(timeToFill) : "—"}</p>
                    </TableCell>
                    <TableCell className="px-5 py-4 align-top">
                      {isOpen ? (
                        <Button
                          variant="ghost"
                          onClick={() => markFulfilled.mutate({ id: row.id })}
                          disabled={markFulfilled.isPending}
                          className="h-auto p-0 text-sm font-medium text-slate-900 hover:bg-transparent hover:text-slate-950"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark Fulfilled
                        </Button>
                      ) : (
                        <span className="text-sm text-slate-400">Complete</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
