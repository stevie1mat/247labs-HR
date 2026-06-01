import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Briefcase, Sparkles, CheckCircle2, Clock, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ApplicantsPage() {
  const [selectedPostingId, setSelectedPostingId] = useState<number | 'unsorted' | null>(null);

  // Fetch job postings
  const { data: postings, isLoading: isLoadingPostings } = useQuery({
    queryKey: ['jobPostings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobPostings').select('*').order('createdAt', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch applicants
  const { data: applicants, isLoading: isLoadingApplicants } = useQuery({
    queryKey: ['applicants'],
    queryFn: async () => {
      // Return empty array for now until table is created
      try {
        const { data, error } = await supabase.from('applicants').select('*').order('createdAt', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err) {
        return [];
      }
    }
  });

  const isLoading = isLoadingPostings || isLoadingApplicants;

  // Group applicants by posting ID
  const groupedApplicants = (applicants || []).reduce((acc: any, applicant: any) => {
    const key = applicant.jobPostingId || 'unsorted';
    if (!acc[key]) acc[key] = [];
    acc[key].push(applicant);
    return acc;
  }, {});

  const getUnsortedCount = () => groupedApplicants['unsorted']?.length || 0;
  
  const getSelectedApplicants = () => {
    if (!selectedPostingId) return [];
    return groupedApplicants[selectedPostingId] || [];
  };

  const getSelectedPostingTitle = () => {
    if (selectedPostingId === 'unsorted') return 'Unsorted / Unmatched';
    const posting = postings?.find((p: any) => p.id === selectedPostingId);
    return posting ? posting.title : 'Select a Job Posting';
  };

  // Select first posting by default once loaded
  if (!isLoading && !selectedPostingId && postings?.length > 0) {
    setSelectedPostingId(postings[0].id);
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const selectedList = getSelectedApplicants();

  return (
    <div className="flex h-[calc(100vh-5rem)] w-full gap-6 pb-4">
      {/* Sidebar */}
      <div className="w-80 shrink-0 flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl border border-white/70 bg-white/88 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl p-5 flex flex-col h-full">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/70">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950">Applicants</h2>
              <p className="text-sm font-medium text-slate-500 mt-0.5">Filter by posting</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-1 pr-2">
          {postings?.map((posting: any) => {
            const isSelected = selectedPostingId === posting.id;
            const count = groupedApplicants[posting.id]?.length || 0;
            const newCount = groupedApplicants[posting.id]?.filter((a: any) => a.status === 'new')?.length || 0;
            
            return (
              <button
                key={posting.id}
                onClick={() => setSelectedPostingId(posting.id)}
                className={cn(
                  "w-full text-left px-3 py-3 flex items-start gap-3 rounded-xl transition-all duration-200 border",
                  isSelected 
                    ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] border-slate-200/80 shadow-sm" 
                    : "border-transparent hover:bg-slate-50 hover:border-slate-200/50"
                )}
              >
                <div className={cn(
                  "mt-0.5 p-2 rounded-lg shrink-0 flex items-center justify-center", 
                  isSelected ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
                )}>
                  <Briefcase className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0 pr-1">
                  <h3 className={cn("text-sm font-semibold truncate", isSelected ? "text-slate-950" : "text-slate-700")}>
                    {posting.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate uppercase tracking-wider font-medium">
                    {posting.salaryRange || 'Open Salary'}
                  </p>
                </div>
                {count > 0 && (
                  <Badge className={cn("rounded-lg border h-6 px-2 text-xs", isSelected ? "bg-primary text-white border-primary" : "bg-slate-100 text-slate-600 border-slate-200")}>
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}

          <div className="mt-4 pt-4 border-t border-slate-200/70">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2 pl-2">Unmatched</p>
            <button
              onClick={() => setSelectedPostingId('unsorted')}
              className={cn(
                "w-full text-left px-3 py-3 flex items-center justify-between rounded-xl transition-all duration-200 border",
                selectedPostingId === 'unsorted' 
                  ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] border-slate-200/80 shadow-sm" 
                  : "border-transparent hover:bg-slate-50 hover:border-slate-200/50"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "p-2 rounded-lg shrink-0 flex items-center justify-center",
                  selectedPostingId === 'unsorted' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                )}>
                  <Inbox className="h-4 w-4" />
                </div>
                <div className="truncate">
                  <h3 className={cn("text-sm font-semibold truncate", selectedPostingId === 'unsorted' ? "text-slate-950" : "text-slate-700")}>Unsorted</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate uppercase tracking-wider font-medium">No match</p>
                </div>
              </div>
              <Badge className={cn("rounded-lg border h-6 px-2 text-xs", selectedPostingId === 'unsorted' ? "bg-amber-500 text-white border-amber-600" : "bg-slate-100 text-slate-600 border-slate-200")}>
                {getUnsortedCount()}
              </Badge>
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 space-y-4">
        <div className="overflow-hidden rounded-xl border border-white/70 bg-white/88 py-5 px-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner border border-primary/20">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-950">{getSelectedPostingTitle()}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                  {selectedList.length} applicant{selectedList.length === 1 ? "" : "s"}
                </Badge>
                {selectedList.filter((a: any) => a.status === 'new').length > 0 && (
                  <Badge variant="outline" className="rounded-lg border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                    {selectedList.filter((a: any) => a.status === 'new').length} new
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.1em]">Sort</span>
            <Button variant="outline" size="sm" className="h-10 rounded-lg border-slate-200 text-slate-700 font-semibold shadow-sm hover:bg-slate-50">
              <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
              AI Match Score
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-4">
          <div className="grid gap-4">
            {selectedList.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4 border border-gray-100">
                  <Inbox className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">No applicants yet</h3>
                <p className="text-gray-500 mt-1">When candidates apply, they will appear here.</p>
              </div>
            ) : (
              selectedList.map((applicant: any) => (
                <div 
                  key={applicant.id} 
                  className="group rounded-xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] p-5 transition-all duration-300 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex flex-col xl:flex-row xl:items-start gap-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-950 font-bold text-white text-2xl shadow-lg shadow-slate-950/10">
                      {applicant.name?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
                              {applicant.name || applicant.id.substring(0, 8)}
                            </h3>
                            {applicant.status === 'reviewed' ? (
                              <Badge className="rounded-lg border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700 text-xs font-semibold">
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Reviewed
                              </Badge>
                            ) : (
                              <Badge className="rounded-lg border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700 text-xs font-semibold">
                                <Clock className="mr-1 h-3.5 w-3.5" /> New
                              </Badge>
                            )}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600 max-w-3xl">
                            {applicant.aiSummary || "This applicant has not been fully evaluated yet. Pending AI analysis."}
                          </p>
                        </div>

                        <div className="shrink-0 flex flex-col items-end">
                          <div className="flex items-center gap-2 bg-amber-500/10 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-500/20">
                            <Sparkles className="h-4 w-4" />
                            <span className="font-bold">{applicant.aiScore || 0}/100</span>
                          </div>
                          {/* Mock Star Rating */}
                          <div className="flex items-center gap-1 mt-2">
                            {[1,2,3,4,5].map(star => (
                              <svg key={star} className={cn("w-4 h-4", star <= Math.round((applicant.aiScore || 0) / 20) ? "text-amber-400 fill-current" : "text-slate-200")} viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-slate-200/70 bg-white/80 p-3 flex justify-between items-center">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Education</span>
                          <span className="text-sm font-bold text-slate-950">{applicant.educationScore || 0}</span>
                        </div>
                        <div className="rounded-xl border border-slate-200/70 bg-white/80 p-3 flex justify-between items-center">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Experience</span>
                          <span className="text-sm font-bold text-slate-950">{applicant.experienceScore || 0}</span>
                        </div>
                        <div className="rounded-xl border border-slate-200/70 bg-white/80 p-3 flex justify-between items-center">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Location</span>
                          <span className="text-sm font-bold text-slate-950">{applicant.locationScore || 0}</span>
                        </div>
                        <div className="rounded-xl border border-slate-200/70 bg-white/80 p-3 flex justify-between items-center">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Skills</span>
                          <span className="text-sm font-bold text-slate-950">{applicant.skillsScore || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
