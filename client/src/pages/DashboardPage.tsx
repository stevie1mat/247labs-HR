import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, Briefcase, CheckCircle2, Clock, TrendingUp, RefreshCw, Circle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const platformIcons: Record<string, string> = { linkedin: "🔵", upwork: "🟢", indeed: "🔴", other: "⚫" };
const COLORS = ["#8B5CF6", "#10B981", "#EF4444", "#F59E0B"];

export default function DashboardPage() {
  const queryClient = useQueryClient();

  const { data: board, isLoading: boardLoading, refetch: refetchBoard } = useQuery({
    queryKey: ['hrBoard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobPostings').select(`
        id, title, status, salaryRange, createdAt, fulfilledAt,
        jobPostingLogs ( platform, status )
      `).order('createdAt', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(p => ({
        ...p,
        postedAt: p.createdAt,
        platforms: Array.from(new Set((p.jobPostingLogs || []).filter((l: any) => l.status === 'success').map((l: any) => l.platform)))
      }));
    }
  });

  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useQuery({
    queryKey: ['kpis'],
    queryFn: async () => {
      const { data: postings, error } = await supabase.from('jobPostings').select('*');
      if (error) throw error;
      if (!postings) return { totalPostings: 0, totalOpen: 0, totalFulfilled: 0, avgTimeToFill: null };

      const fulfilled = postings.filter(p => p.status === 'fulfilled');
      let totalDays = 0;
      fulfilled.forEach(p => {
        if (p.fulfilledAt && p.createdAt) {
          totalDays += (new Date(p.fulfilledAt).getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        }
      });

      return {
        totalPostings: postings.length,
        totalOpen: postings.filter(p => p.status === 'active' || p.status === 'open').length,
        totalFulfilled: fulfilled.length,
        avgTimeToFill: fulfilled.length > 0 ? Math.round(totalDays / fulfilled.length) : null
      };
    }
  });

  const markFulfilled = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const { error } = await supabase.from('jobPostings').update({
        status: 'fulfilled',
        fulfilledAt: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrBoard'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      toast.success("Job marked as fulfilled!");
    }
  });

  const isLoading = kpisLoading || boardLoading;

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" /></div>;

  // Build chart data from board
  const platformData = board?.reduce((acc: Record<string, number>, row: any) => {
    (row.platforms ?? []).forEach((p: string) => { acc[p] = (acc[p] ?? 0) + 1; });
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(platformData ?? {}).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  const monthlyData = board?.reduce((acc: Record<string, { open: number; fulfilled: number }>, row: any) => {
    const month = row.postedAt ? format(new Date(row.postedAt), "MMM") : "Unknown";
    if (!acc[month]) acc[month] = { open: 0, fulfilled: 0 };
    if (row.status === "fulfilled") acc[month].fulfilled++;
    else acc[month].open++;
    return acc;
  }, {} as Record<string, { open: number; fulfilled: number }>);

  const barData = Object.entries(monthlyData ?? {}).map(([month, counts]) => ({ month, ...counts }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#8B5CF6] flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1F2937]">HR Dashboard</h1>
            <p className="text-sm text-gray-500">Metrics, KPIs, and job board overview</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchKpis(); refetchBoard(); }} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-[#8B5CF6]" />
              </div>
              <TrendingUp className="w-4 h-4 text-gray-300" />
            </div>
            <p className="text-3xl font-bold text-[#1F2937]">{kpis?.totalPostings ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Total Jobs Posted</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Circle className="w-4 h-4 text-blue-500" />
              </div>
              <TrendingUp className="w-4 h-4 text-gray-300" />
            </div>
            <p className="text-3xl font-bold text-[#1F2937]">{kpis?.totalOpen ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Open Positions</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              </div>
              <TrendingUp className="w-4 h-4 text-gray-300" />
            </div>
            <p className="text-3xl font-bold text-[#10B981]">{kpis?.totalFulfilled ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Fulfilled</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <TrendingUp className="w-4 h-4 text-gray-300" />
            </div>
            <p className="text-3xl font-bold text-[#1F2937]">{kpis?.avgTimeToFill != null ? `${kpis.avgTimeToFill}d` : "—"}</p>
            <p className="text-xs text-gray-500 mt-1">Avg. Time to Fill</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {(barData.length > 0 || pieData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {barData.length > 0 && (
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#1F2937]">Monthly Job Postings</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="open" name="Open" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fulfilled" name="Fulfilled" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {pieData.length > 0 && (
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#1F2937]">Distribution by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* HR Board Table */}
      <Card className="border-0 shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm font-semibold text-[#1F2937]">HR Board — All Job Postings</CardTitle>
        </CardHeader>
        {!board || board.length === 0 ? (
          <CardContent className="pt-10 pb-10 flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-[#1F2937]">No job postings yet</p>
            <p className="text-xs text-gray-500">Use "New Hire Request" to create your first posting, or seed demo data above.</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Job Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Posted</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Platforms</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time to Fill</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {board.map((row: any) => {
                  const timeToFill = row.fulfilledAt && row.postedAt
                    ? Math.round((new Date(row.fulfilledAt).getTime() - new Date(row.postedAt).getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1F2937]">{row.title}</p>
                        {row.salaryRange && <p className="text-xs text-gray-400 mt-0.5">{row.salaryRange}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {row.postedAt ? format(new Date(row.postedAt), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {(row.platforms ?? []).length > 0 ? (
                            (row.platforms ?? []).map((p: string) => (
                              <span key={p} title={p} className="text-base">{platformIcons[p] ?? "⚫"}</span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.status === "fulfilled" ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />Fulfilled
                          </Badge>
                        ) : row.status === "open" ? (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                            <Circle className="w-3 h-3 mr-1" />Open
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">{row.status}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {timeToFill != null ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeToFill} day{timeToFill !== 1 ? "s" : ""}
                          </span>
                        ) : row.status === "open" && row.postedAt ? (
                          <span className="text-amber-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.round((Date.now() - new Date(row.postedAt).getTime()) / (1000 * 60 * 60 * 24))}d open
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.status === "open" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markFulfilled.mutate({ id: row.id })}
                            disabled={markFulfilled.isPending}
                            className="h-7 text-xs gap-1 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Mark Fulfilled
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
