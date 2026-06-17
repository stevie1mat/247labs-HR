import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, FileText, Globe, Loader2, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const q = searchParams.get("q") || "";

  const { data: postings, isLoading: loadingPostings } = useQuery({
    queryKey: ['search-postings-page', q],
    queryFn: async () => {
      if (!q) return [];
      const { data } = await supabase
        .from('jobPostings')
        .select('*')
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .order('createdAt', { ascending: false });
      return data || [];
    },
    enabled: !!q,
  });

  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['search-templates-page', q],
    queryFn: async () => {
      if (!q) return [];
      const { data } = await supabase
        .from('jobTemplates')
        .select('*')
        .ilike('title', `%${q}%`)
        .order('createdAt', { ascending: false });
      return data || [];
    },
    enabled: !!q,
  });

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ['search-sources-page', q],
    queryFn: async () => {
      if (!q) return [];
      const { data } = await supabase
        .from('postingSources')
        .select('*')
        .or(`name.ilike.%${q}%,platform.ilike.%${q}%`)
        .order('createdAt', { ascending: false });
      return data || [];
    },
    enabled: !!q,
  });

  const isLoading = loadingPostings || loadingTemplates || loadingSources;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasResults = (postings && postings.length > 0) || (templates && templates.length > 0) || (sources && sources.length > 0);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Search Results</h1>
        <p className="text-slate-500 mt-2">Showing results for "{q}"</p>
      </div>

      {!hasResults && q ? (
        <Card className="rounded-xl border border-slate-200 bg-white py-0 shadow-sm">
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
              <SearchIcon className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="font-medium text-slate-900">No matching results</p>
              <p className="text-sm text-slate-500 mt-1">Try searching for something else or check your spelling.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
          {postings && postings.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Job Postings ({postings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {postings.map((p) => (
                    <div 
                      key={p.id} 
                      className="p-4 hover:bg-slate-50 cursor-pointer transition-colors group flex justify-between items-center"
                      onClick={() => setLocation('/my-postings')}
                    >
                      <div className="min-w-0 pr-4">
                        <p className="font-medium text-slate-900 truncate">{p.title || "Untitled Job"}</p>
                        <p className="text-sm text-slate-500 truncate mt-0.5 capitalize">{p.status}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary shrink-0 transition-colors" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {templates && templates.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Job Templates ({templates.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {templates.map((t) => (
                    <div 
                      key={t.id} 
                      className="p-4 hover:bg-slate-50 cursor-pointer transition-colors group flex justify-between items-center"
                      onClick={() => setLocation('/templates')}
                    >
                      <div className="min-w-0 pr-4">
                        <p className="font-medium text-slate-900 truncate">{t.title}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary shrink-0 transition-colors" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {sources && sources.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  Posting Sources ({sources.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {sources.map((s) => (
                    <div 
                      key={s.id} 
                      className="p-4 hover:bg-slate-50 cursor-pointer transition-colors group flex justify-between items-center"
                      onClick={() => setLocation('/sources')}
                    >
                      <div className="min-w-0 pr-4">
                        <p className="font-medium text-slate-900 truncate">{s.name}</p>
                        <p className="text-sm text-slate-500 truncate mt-0.5 capitalize">{s.platform?.replace('_', ' ')}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary shrink-0 transition-colors" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
