import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  Briefcase,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const platformIcons: Record<string, string> = { linkedin: "🔵", upwork: "🟢", indeed: "🔴", other: "⚫" };
const platformLabels: Record<string, string> = { linkedin: "LinkedIn", upwork: "Upwork", indeed: "Indeed", other: "Other" };
const chartColors = ["#7c3aed", "#14b8a6", "#f97316", "#0f172a"];

function formatDays(value: number | null) {
  return value != null ? `${value}d` : "—";
}

function getPostingAgeDays(postedAt?: string | null, fulfilledAt?: string | null) {
  if (!postedAt) return null;
  const end = fulfilledAt ? new Date(fulfilledAt).getTime() : Date.now();
  return Math.max(0, Math.round((end - new Date(postedAt).getTime()) / (1000 * 60 * 60 * 24)));
}

export default function DashboardPage() {
  const queryClient = useQueryClient();

  const { data: board, isLoading: boardLoading, refetch: refetchBoard } = useQuery({
    queryKey: ["hrBoard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobPostings").select(`
        id, title, status, salaryRange, createdAt, fulfilledAt,
        jobPostingLogs ( platform, status )
      `).order("createdAt", { ascending: false });

      if (error) throw error;

      return (data || []).map((posting: any) => ({
        ...posting,
        postedAt: posting.createdAt,
        platforms: Array.from(
          new Set((posting.jobPostingLogs || []).filter((log: any) => log.status === "success").map((log: any) => log.platform))
        ),
      }));
    },
  });

  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useQuery({
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
      const { error } = await supabase.from("jobPostings").update({
        status: "fulfilled",
        fulfilledAt: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hrBoard"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
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
  const activePlatforms = new Set(rows.flatMap((row: any) => row.platforms ?? [])).size;

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
      title: "Open roles",
      value: totalOpen.toString(),
      caption: "Positions currently in market",
      iconWrap: "bg-sky-500/15 text-sky-700",
      valueClass: "text-slate-950",
      icon: Circle,
    },
    {
      title: "Roles filled",
      value: totalFulfilled.toString(),
      caption: "Closed successfully",
      iconWrap: "bg-emerald-500/15 text-emerald-700",
      valueClass: "text-slate-950",
      icon: CheckCircle2,
    },
    {
      title: "Average time to fill",
      value: formatDays(avgTimeToFill),
      caption: "Measured across fulfilled postings",
      iconWrap: "bg-amber-500/15 text-amber-700",
      valueClass: "text-slate-950",
      icon: Clock,
    },
    {
      title: "Distribution reach",
      value: activePlatforms.toString(),
      caption: "Channels posting successfully",
      iconWrap: "bg-violet-500/15 text-violet-700",
      valueClass: "text-slate-950",
      icon: TrendingUp,
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
                  <Badge variant="outline" className="rounded-lg border-slate-200/80 bg-white/70 px-2.5 py-1 text-[11px] text-slate-500">
                    Live
                  </Badge>
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
                <CardTitle className="text-lg font-semibold text-slate-950">Posting cadence</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Open and fulfilled job volume by month</p>
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
                  <Bar dataKey="open" name="Open" fill="url(#dashboardOpenBar)" radius={[12, 12, 4, 4]} />
                  <Bar dataKey="fulfilled" name="Fulfilled" fill="url(#dashboardFulfilledBar)" radius={[12, 12, 4, 4]} />
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
                <CardTitle className="text-lg font-semibold text-slate-950">Channel mix</CardTitle>
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/12 text-violet-700">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">HR board</h2>
                <p className="mt-1 text-sm text-slate-500">Every posting, status signal, and fulfillment action in one sleek view</p>
              </div>
            </div>
            <Badge variant="outline" className="w-fit rounded-lg border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
              {rows.length} tracked posting{rows.length === 1 ? "" : "s"}
            </Badge>
          </div>
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
          <div className="grid gap-4 p-4 md:p-6">
            {rows.map((row: any) => {
              const timeToFill = getPostingAgeDays(row.postedAt, row.fulfilledAt);
              const isOpen = row.status === "open";
              const isFulfilled = row.status === "fulfilled";

              return (
                <div
                  key={row.id}
                  className="group rounded-xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] p-5 transition-all duration-300 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold tracking-[-0.02em] text-slate-950">{row.title}</h3>
                        {isFulfilled ? (
                          <Badge className="rounded-lg border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Fulfilled
                          </Badge>
                        ) : isOpen ? (
                          <Badge className="rounded-lg border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">
                            <Circle className="mr-1 h-3.5 w-3.5" />
                            Open
                          </Badge>
                        ) : (
                          <Badge className="rounded-lg border-slate-200 bg-slate-100 px-3 py-1 text-slate-600">
                            {row.status}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                          Posted {row.postedAt ? format(new Date(row.postedAt), "MMM d, yyyy") : "—"}
                        </div>
                        {row.salaryRange && (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                            {row.salaryRange}
                          </div>
                        )}
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                          {timeToFill != null ? `${timeToFill} day${timeToFill === 1 ? "" : "s"}` : "No time data"}
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <Button
                        variant="outline"
                        onClick={() => markFulfilled.mutate({ id: row.id })}
                        disabled={markFulfilled.isPending}
                        className="h-11 rounded-xl border-emerald-200 bg-emerald-50 px-5 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark fulfilled
                      </Button>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px]">
                    <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Distribution footprint</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {(row.platforms ?? []).length > 0 ? (
                          (row.platforms ?? []).map((platform: string) => (
                            <div
                              key={platform}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
                            >
                              <span>{platformIcons[platform] ?? "⚫"}</span>
                              <span>{platformLabels[platform] ?? platform}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400">No successful platform posts recorded yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200/70 bg-slate-950 p-4 text-white">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Status insight</p>
                      <p className="mt-3 text-base font-semibold">
                        {isFulfilled
                          ? `Filled in ${timeToFill ?? 0} day${timeToFill === 1 ? "" : "s"}`
                          : isOpen
                            ? `${timeToFill ?? 0} day${timeToFill === 1 ? "" : "s"} live`
                            : "Awaiting update"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {isFulfilled
                          ? "This role has completed the hiring cycle and contributes to fulfillment performance."
                          : "This role is still active. Use this board to spot which openings may need renewed distribution."}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
