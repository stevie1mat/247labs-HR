import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLogs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type SourcePlatformOption = "zoho_recruit" | "wordpress";

const platformIcons: Record<string, string> = {
  zoho_recruit: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS3qR8B1EEQQMWJuzLYaPP6_85DoJQsMra9ZQ&s",
  wordpress: "https://s.w.org/style/images/about/WordPress-logotype-wmark.png",
};

const platformLabels: Record<SourcePlatformOption, string> = {
  zoho_recruit: "Zoho Recruit",
  wordpress: "WordPress",
};

const platformDescriptions: Record<SourcePlatformOption, string> = {
  zoho_recruit: "Sync job openings and candidates with Zoho Recruit.",
  wordpress: "Publish jobs natively to your WordPress career site.",
};

const platformCatalog: SourcePlatformOption[] = [
  "zoho_recruit",
  "wordpress",
];

function displaySourceName(name?: string | null) {
  return (name || "").replace(/\s+Source$/, "").trim();
}

export default function SourcesPage() {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [configSourceId, setConfigSourceId] = useState<string | null>(null);
  const [wpUrl, setWpUrl] = useState("");
  const [wpUser, setWpUser] = useState("");
  const [wpPass, setWpPass] = useState("");

  const { data: sources, isLoading, refetch } = useQuery({
    queryKey: ["postingSources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("postingSources").select("*").order("id", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createSource = useMutation({
    mutationFn: async (platform: SourcePlatformOption) => {
      const { data, error } = await supabase.from("postingSources").insert([{
        name: platformLabels[platform],
        platform,
        isActive: true,
        isMockMode: true,
        credentials: {},
      }]).select().single();
      if (error) throw error;
      await logActivity({
        action: "source_enabled",
        category: "settings",
        entityType: "posting_source",
        entityId: data.id,
        title: `${platformLabels[platform]} enabled`,
        detail: `${platformLabels[platform]} was turned on for future job distribution.`,
        platform,
        sourceName: data.name,
        statusTone: "success",
        postingSourceId: data.id,
        metadata: {
          isMockMode: data.isMockMode,
          isActive: data.isActive,
        },
      });
    },
    onSuccess: () => {
      refetch();
      toast.success("Source activated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleSource = useMutation({
    mutationFn: async ({ id, isActive, platform, sourceName }: { id: string; isActive: boolean; platform: SourcePlatformOption; sourceName: string }) => {
      const { error } = await supabase.from("postingSources").update({ isActive }).eq("id", id);
      if (error) throw error;
      await logActivity({
        action: isActive ? "source_enabled" : "source_disabled",
        category: "settings",
        entityType: "posting_source",
        entityId: id,
        title: `${platformLabels[platform]} ${isActive ? "enabled" : "disabled"}`,
        detail: `${sourceName} was ${isActive ? "made available" : "removed"} from the posting platform picker.`,
        platform,
        sourceName,
        statusTone: isActive ? "success" : "neutral",
        postingSourceId: id,
        metadata: {
          isActive,
        },
      });
    },
    onSuccess: (_, variables) => {
      refetch();
      toast.success(variables.isActive ? "Source activated." : "Source disabled.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateCredentials = useMutation({
    mutationFn: async ({ id, credentials }: { id: string; credentials: any }) => {
      const { error } = await supabase.from("postingSources").update({ credentials, isMockMode: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      setConfigSourceId(null);
      toast.success("Credentials updated successfully. Live mode is now active.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const linkedByPlatform = new Map<string, any>((sources ?? []).map((source: any) => [source.platform, source]));

  const filteredPlatforms = platformCatalog.filter((platform) => {
    const query = search.trim().toLowerCase();
    const linkedSource = linkedByPlatform.get(platform);

    const matchesSearch =
      !query ||
      [platformLabels[platform], platformDescriptions[platform], platform, linkedSource?.name]
        .some(value => typeof value === "string" && value.toLowerCase().includes(query));

    const matchesPlatform = platformFilter === "all" || platform === platformFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? linkedSource?.isActive === true : linkedSource?.isActive !== true);

    return matchesSearch && matchesPlatform && matchesStatus;
  });

  const setPlatformActive = (platform: SourcePlatformOption, isActive: boolean) => {
    const linkedSource = linkedByPlatform.get(platform);

    if (linkedSource) {
      toggleSource.mutate({ id: linkedSource.id, isActive, platform, sourceName: linkedSource.name });
      return;
    }

    if (isActive) {
      createSource.mutate(platform);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search sources by name or platform..."
            className="h-12 rounded-xl border-slate-200 bg-white pl-11 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="!h-12 min-w-[190px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <SelectValue placeholder="All platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {platformCatalog.map(platform => (
                <SelectItem key={platform} value={platform}>
                  {platformLabels[platform]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="!h-12 min-w-[170px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredPlatforms.length === 0 ? (
        <Card className="rounded-xl border border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <CardContent className="flex flex-col items-center gap-4 pb-12 pt-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <p className="font-medium text-[#1F2937]">No matching sources</p>
            <p className="text-sm text-gray-500">Try a different search or filter combination.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredPlatforms.map((platform) => {
            const linkedSource = linkedByPlatform.get(platform);
            const isActive = linkedSource?.isActive === true;
            const isPending = createSource.isPending || toggleSource.isPending;

            return (
              <Card key={platform} className="rounded-xl border border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_20px_48px_rgba(15,23,42,0.10)]">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden">
                      <img
                        src={platformIcons[platform]}
                        alt={`${platformLabels[platform]} logo`}
                        className="h-12 w-12 object-contain"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-950">{platformLabels[platform]}</h3>
                          <p className="mt-3 text-sm leading-6 text-slate-500">
                            {platformDescriptions[platform]}
                          </p>
                        </div>
                        {isActive ? (
                          <Badge className="rounded-lg border-emerald-200 bg-emerald-50 text-xs text-emerald-700">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50 text-xs text-slate-500">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      {linkedSource && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50 text-xs">
                            {displaySourceName(linkedSource.name)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex-1" />

                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Include in posting</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Turn on to show this source when posting jobs.
                      </p>
                    </div>
                    <Switch
                      checked={isActive}
                      disabled={isPending}
                      onCheckedChange={value => setPlatformActive(platform, value)}
                    />
                  </div>

                  {isActive && platform === "wordpress" && linkedSource && (
                    <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Live Configuration</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Configure your WordPress site details.
                        </p>
                      </div>
                      <Dialog open={configSourceId === linkedSource.id} onOpenChange={(open) => {
                        if (open) {
                          setConfigSourceId(linkedSource.id);
                          const creds = linkedSource.credentials || {};
                          setWpUrl(creds.siteUrl || "");
                          setWpUser(creds.username || "");
                          setWpPass(creds.applicationPassword || "");
                        } else {
                          setConfigSourceId(null);
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 gap-1">
                            <Settings className="h-3.5 w-3.5" />
                            Settings
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>WordPress Configuration</DialogTitle>
                            <DialogDescription>
                              Enter your WordPress site URL and application password to enable live publishing.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="wp-url">Site URL</Label>
                              <Input
                                id="wp-url"
                                value={wpUrl}
                                onChange={(e) => setWpUrl(e.target.value)}
                                placeholder="https://your-wordpress-site.com"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="wp-user">Username</Label>
                              <Input
                                id="wp-user"
                                value={wpUser}
                                onChange={(e) => setWpUser(e.target.value)}
                                placeholder="Admin username"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="wp-pass">Application Password</Label>
                              <Input
                                id="wp-pass"
                                value={wpPass}
                                onChange={(e) => setWpPass(e.target.value)}
                                placeholder="xxxx xxxx xxxx xxxx"
                                type="password"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={() => {
                                updateCredentials.mutate({
                                  id: linkedSource.id,
                                  credentials: {
                                    siteUrl: wpUrl,
                                    username: wpUser,
                                    applicationPassword: wpPass,
                                    postType: "careers"
                                  }
                                });
                              }}
                              disabled={updateCredentials.isPending}
                            >
                              {updateCredentials.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {isActive ? "Available in the post job platform picker." : "Hidden from the post job platform picker until enabled."}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
