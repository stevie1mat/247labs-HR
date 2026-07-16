import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Reorder, useDragControls } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Briefcase, Sparkles, CheckCircle2, Clock, Inbox, Mail, FileText, ExternalLink, MapPin, Search, Filter, UserRound, CircleHelp, GripVertical, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const sourceBadgeMap: Record<string, string> = {
  elementor: "WordPress",
  wordpress: "WordPress",
  indeed: "Indeed",
  linkedin: "LinkedIn",
  wellfound: "Wellfound",
  remotive: "Remotive",
  upwork: "Upwork",
};

function JobPostingItem({ posting, isSelected, count, onClick }: any) {
  const controls = useDragControls();

  return (
    <Reorder.Item value={posting} dragListener={false} dragControls={controls} as="div" className="relative group/item">
      <div 
        className="absolute left-[-8px] top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 z-10"
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <button
        onClick={onClick}
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
    </Reorder.Item>
  );
}

export default function ApplicantsPage() {
  const [location] = useLocation();
  const [selectedPostingId, setSelectedPostingId] = useState<string | 'unsorted' | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [resumeFilter, setResumeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [evaluating, setEvaluating] = useState<Record<string, boolean>>({});
  const [scoreDialogApplicant, setScoreDialogApplicant] = useState<any | null>(null);
  const [localPostings, setLocalPostings] = useState<any[]>([]);
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<Set<string>>(new Set());
  const [isSendingQuestions, setIsSendingQuestions] = useState(false);
  
  const queryClient = useQueryClient();

  const updateOrderMutation = useMutation({
    mutationFn: async (updates: { id: string; orderIndex: number }[]) => {
      await Promise.all(
        updates.map(u => supabase.from('jobPostings').update({ orderIndex: u.orderIndex }).eq('id', u.id))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobPostings'] });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase
        .from('applicants')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicants'] });
      toast.success("Applicant status updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update status");
    }
  });

  const handleReorder = (newOrder: any[]) => {
    setLocalPostings(newOrder);
    const updates = newOrder.map((p, index) => ({ id: p.id, orderIndex: index }));
    updateOrderMutation.mutate(updates);
  };

  // Fetch local job postings. WordPress/Elementor applicants are stored locally.
  const { data: postings, isLoading: isLoadingPostings } = useQuery({
    queryKey: ['jobPostings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobPostings')
        .select('id, title, salaryRange, createdAt, postedAt, status, orderIndex')
        .order('orderIndex', { ascending: true })
        .order('createdAt', { ascending: false });

      if (error) throw error;

      return (data || []).map((job: any) => ({
        id: String(job.id),
        title: job.title || "Untitled Job",
        salaryRange: job.salaryRange || "",
        createdAt: job.postedAt || job.createdAt,
        status: job.status || "",
      }));
    }
  });

  // Fetch local applicants received from WordPress/Elementor and other local sources.
  const { data: applicants, isLoading: isLoadingApplicants } = useQuery({
    queryKey: ['applicants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applicants')
        .select('id, name, email, phone, location, portfolio, coverLetter, resumeUrl, resumeFileName, formName, source, status, aiScore, aiSummary, educationScore, experienceScore, locationScore, skillsScore, metadata, jobPostingId, createdAt')
        .order('createdAt', { ascending: false });

      if (error) throw error;

      return (data || []).map((applicant: any) => ({
        id: applicant.id,
        name: applicant.name || "Unknown Candidate",
        email: applicant.email || "",
        phone: applicant.phone || "",
        location: applicant.location || "",
        portfolio: applicant.portfolio || "",
        coverLetter: applicant.coverLetter || "",
        resumeUrl: applicant.resumeUrl || "",
        resumeFileName: applicant.resumeFileName || "",
        status: applicant.status || "new",
        createdAt: applicant.createdAt,
        jobPostingId: applicant.jobPostingId ? String(applicant.jobPostingId) : null,
        aiScore: applicant.aiScore,
        aiSummary: applicant.aiSummary || "",
        educationScore: applicant.educationScore,
        experienceScore: applicant.experienceScore,
        locationScore: applicant.locationScore,
        skillsScore: applicant.skillsScore,
        evaluationDetails: applicant.metadata?.evaluationDetails || null,
        source: applicant.source || applicant.formName || "elementor",
      }));
    }
  });

  const isLoading = isLoadingPostings || isLoadingApplicants;
  const safePostings = postings || [];

  useEffect(() => {
    if (postings) {
      setLocalPostings(postings);
    }
  }, [postings]);

  // Clear selections when filters change
  useEffect(() => {
    setSelectedApplicantIds(new Set());
  }, [selectedPostingId, search, statusFilter, resumeFilter]);
  const selectedPostingFromQuery = (() => {
    try {
      const url = new URL(location, "http://localhost");
      return url.searchParams.get("posting");
    } catch {
      return null;
    }
  })();

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
    const posting = safePostings.find((p: any) => p.id === selectedPostingId);
    return posting ? posting.title : 'Select a Job Posting';
  };

  // Select first posting by default once loaded
  if (!isLoading && !selectedPostingId && safePostings.length > 0) {
    const matchedPosting = selectedPostingFromQuery
      ? safePostings.find((posting: any) => String(posting.id) === selectedPostingFromQuery)
      : null;

    setSelectedPostingId(matchedPosting?.id ?? safePostings[0].id);
  }

  const handleEvaluateApplicant = async (applicantId: string) => {
    setEvaluating((prev) => ({ ...prev, [applicantId]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/evaluate-applicant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ applicantId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to evaluate applicant.");
      if (data?.error) throw new Error(data.error);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['applicants'] }),
        queryClient.invalidateQueries({ queryKey: ['activityLogs'] }),
      ]);
      toast.success(`Resume scanned successfully (${data.resumeTextLength || 0} characters read).`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to evaluate the applicant.");
    } finally {
      setEvaluating((prev) => ({ ...prev, [applicantId]: false }));
    }
  };

  const handleToggleApplicant = (id: string) => {
    const newSelected = new Set(selectedApplicantIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedApplicantIds(newSelected);
  };

  const handleSelectAll = (filteredApplicantsList: any[]) => {
    if (selectedApplicantIds.size === filteredApplicantsList.length && filteredApplicantsList.length > 0) {
      setSelectedApplicantIds(new Set());
    } else {
      setSelectedApplicantIds(new Set(filteredApplicantsList.map(a => a.id)));
    }
  };

  const handleSendQuestions = async () => {
    if (selectedApplicantIds.size === 0) return;
    
    // Get all selected applicant objects
    const selectedList = applicants?.filter(a => selectedApplicantIds.has(a.id)) || [];
    
    // Check if they all belong to the same job posting
    const jobPostingIds = new Set(selectedList.map(a => a.jobPostingId));
    if (jobPostingIds.size > 1) {
      toast.error("Please select applicants from only one job posting at a time.");
      return;
    }

    const targetPostingId = Array.from(jobPostingIds)[0];
    if (!targetPostingId || targetPostingId === 'unsorted') {
      toast.error("Cannot send questions to unsorted applicants.");
      return;
    }

    setIsSendingQuestions(true);
    try {
      // Fetch screening questions
      const { data, error } = await supabase
        .from('jobScreeningQuestions')
        .select('questions')
        .eq('jobPostingId', targetPostingId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data?.questions || data.questions.length === 0) {
        toast.error("No screening questions found for this job posting.");
        return;
      }

      // Format questions into text body
      const questionText = data.questions.map((q: any, i: number) => `${i + 1}. ${q.title}\n${q.prompt}\n`).join('\n');
      const body = `Hello,\n\nThank you for applying. As a next step, please reply to this email with answers to the following screening questions:\n\n${questionText}\nBest regards,\n`;
      
      const bccEmails = selectedList.map(a => a.email).filter(Boolean).join(',');
      if (!bccEmails) {
        toast.error("None of the selected applicants have an email address.");
        return;
      }

      const subject = `Next Steps: Screening Questions for ${getSelectedPostingTitle()}`;
      
      // Outlook Web deep links DO NOT support the 'bcc' parameter. 
      // It will just drop it. We must use 'to' or ask the user to paste them.
      // Since 'to' exposes emails, we will copy the emails to the clipboard!
      const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      // Copy emails to clipboard
      try {
        await navigator.clipboard.writeText(bccEmails);
        toast.success("Emails copied to clipboard! Please PASTE them into the BCC field in Outlook.", { duration: 10000 });
      } catch (err) {
        toast.success("Opening Outlook...");
      }

      // Open Outlook Web in a new tab
      window.open(outlookUrl, '_blank');
      
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch screening questions.");
    } finally {
      setIsSendingQuestions(false);
    }
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const selectedList = getSelectedApplicants();
  const filteredApplicants = selectedList
    .filter((applicant: any) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        [
          applicant.name,
          applicant.email,
          applicant.location,
          applicant.resumeFileName,
          applicant.aiSummary,
        ].some((value) => typeof value === "string" && value.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "new" && (!applicant.status || applicant.status === "new")) ||
        (statusFilter === "reviewed" && applicant.status === "reviewed") ||
        (statusFilter === "unselected" && applicant.status === "unselected");

      const matchesResume =
        resumeFilter === "all" ||
        (resumeFilter === "with_resume" && Boolean(applicant.resumeUrl)) ||
        (resumeFilter === "without_resume" && !applicant.resumeUrl);

      return matchesSearch && matchesStatus && matchesResume;
    })
    .sort((a: any, b: any) => {
      if (sortBy === "score") {
        return (b.aiScore || 0) - (a.aiScore || 0);
      }

      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "");
      }

      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

  const newApplicantsCount = selectedList.filter((a: any) => a.status === 'new').length;
  const withResumeCount = selectedList.filter((a: any) => Boolean(a.resumeUrl)).length;
  const scoreRows = scoreDialogApplicant ? [
    {
      label: "Education",
      score: scoreDialogApplicant.educationScore || 0,
      rationale: scoreDialogApplicant.evaluationDetails?.scoreRationale?.education || "Based on education signals found in the resume and submission.",
    },
    {
      label: "Experience",
      score: scoreDialogApplicant.experienceScore || 0,
      rationale: scoreDialogApplicant.evaluationDetails?.scoreRationale?.experience || "Based on relevant work history, project scope, and role alignment.",
    },
    {
      label: "Location",
      score: scoreDialogApplicant.locationScore || 0,
      rationale: scoreDialogApplicant.evaluationDetails?.scoreRationale?.location || "Based on the applicant location evidence and the job location requirement.",
    },
    {
      label: "Skills",
      score: scoreDialogApplicant.skillsScore || 0,
      rationale: scoreDialogApplicant.evaluationDetails?.scoreRationale?.skills || "Based on technical skills and keywords found in the resume against the job requirements.",
    },
  ] : [];

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

          <div className="flex-1 overflow-y-auto py-4 pr-2">
            <Reorder.Group axis="y" values={localPostings} onReorder={handleReorder} className="space-y-1">
              {localPostings.map((posting: any) => {
                const isSelected = selectedPostingId === posting.id;
                const count = groupedApplicants[posting.id]?.length || 0;
                
                return (
                  <JobPostingItem 
                    key={posting.id} 
                    posting={posting} 
                    isSelected={isSelected} 
                    count={count} 
                    onClick={() => setSelectedPostingId(posting.id)} 
                  />
                );
              })}
            </Reorder.Group>

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
        <div className="overflow-hidden rounded-xl border border-white/70 bg-white/88 px-6 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-950/10">
              <Filter className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Applicants</h2>
              <p className="mt-1 text-sm text-slate-500">{getSelectedPostingTitle()}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search applicants by name, email, location, or resume..."
                className="h-12 rounded-xl border-slate-200 bg-white pl-11 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="!h-12 min-w-[170px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="unselected">Not Selected</SelectItem>
                </SelectContent>
              </Select>

              <Select value={resumeFilter} onValueChange={setResumeFilter}>
                <SelectTrigger className="!h-12 min-w-[180px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                  <SelectValue placeholder="Resume status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resumes</SelectItem>
                  <SelectItem value="with_resume">With resume</SelectItem>
                  <SelectItem value="without_resume">Without resume</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="!h-12 min-w-[200px] rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                  <SelectValue placeholder="Sort order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">AI Match Score</SelectItem>
                  <SelectItem value="recent">Most recent</SelectItem>
                  <SelectItem value="name">Candidate name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-4">
          <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/88 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="border-b border-slate-200/70 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
                  <Checkbox 
                    id="select-all" 
                    checked={filteredApplicants.length > 0 && selectedApplicantIds.size === filteredApplicants.length}
                    onCheckedChange={() => handleSelectAll(filteredApplicants)}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Select All
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                    {filteredApplicants.length} result{filteredApplicants.length === 1 ? "" : "s"}
                  </Badge>
                  {search.trim() ? (
                    <Badge variant="outline" className="rounded-lg border-primary/20 bg-primary/5 px-2.5 py-1 text-xs text-primary">
                      Search active
                    </Badge>
                  ) : null}
                  {selectedApplicantIds.size > 0 && (
                    <Badge variant="outline" className="rounded-lg border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                      {selectedApplicantIds.size} selected
                    </Badge>
                  )}
                </div>
              </div>
              
              {selectedApplicantIds.size > 0 && (
                <Button 
                  onClick={handleSendQuestions}
                  disabled={isSendingQuestions}
                  className="gap-2 shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isSendingQuestions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Send Questions via Outlook
                </Button>
              )}
            </div>

            <div className="grid gap-4 p-4 sm:p-5">
            {filteredApplicants.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4 border border-gray-100">
                  <Inbox className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">No applicants match these filters</h3>
                <p className="text-gray-500 mt-1">Try changing the search, status, resume, or sort settings.</p>
              </div>
            ) : (
              filteredApplicants.map((applicant: any) => (
                <div
                  key={`${applicant.id}-${applicant.jobPostingId || 'unsorted'}`} 
                  className="group rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                >
                  {(() => {
                    const sourceKey = (applicant.source || "wordpress").toLowerCase();
                    const sourceLabel = sourceBadgeMap[sourceKey] || applicant.source || "Source";

                    return (
                  <div className="flex flex-col gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="pt-1">
                            <Checkbox 
                              checked={selectedApplicantIds.has(applicant.id)}
                              onCheckedChange={() => handleToggleApplicant(applicant.id)}
                            />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
                              {applicant.name || applicant.id.substring(0, 8)}
                            </h3>
                            <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                              <UserRound className="mr-1 h-3.5 w-3.5" />
                              Applicant
                            </Badge>
                            <Badge variant="outline" className="rounded-lg border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                              {sourceLabel}
                            </Badge>
                            {(() => {
                              const status = applicant.status || 'new';
                              const statusClasses = 
                                status === 'reviewed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                                status === 'unselected' ? 'border-rose-200 bg-rose-50 text-rose-700' :
                                'border-sky-200 bg-sky-50 text-sky-700';

                              return (
                                <Select 
                                  value={status} 
                                  onValueChange={(val) => updateStatusMutation.mutate({ id: applicant.id, status: val })}
                                >
                                  <SelectTrigger className={cn("h-6 rounded-lg px-2 py-0 text-xs font-semibold focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 w-[145px] shadow-none [&>span]:flex [&>span]:items-center [&>span]:gap-1.5 border", statusClasses)}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="new"><div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />New</div></SelectItem>
                                    <SelectItem value="reviewed"><div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Reviewed</div></SelectItem>
                                    <SelectItem value="unselected"><div className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-rose-500" />Not Selected</div></SelectItem>
                                  </SelectContent>
                                </Select>
                              );
                            })()}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600 max-w-3xl">
                            {applicant.aiSummary || "This applicant has not been fully evaluated yet. Pending AI analysis."}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            {applicant.email ? (
                              <a
                                href={`mailto:${applicant.email}`}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                              >
                                <Mail className="h-4 w-4 text-slate-500" />
                                {applicant.email}
                              </a>
                            ) : null}

                            {applicant.location ? (
                              <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600">
                                <MapPin className="h-4 w-4 text-slate-500" />
                                {applicant.location}
                              </span>
                            ) : null}

                            {applicant.resumeUrl ? (
                              <a
                                href={applicant.resumeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                              >
                                <FileText className="h-4 w-4" />
                                {applicant.resumeFileName || "View resume"}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                          </div>
                        </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end">
                          {applicant.aiScore ? (
                            <>
                              <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-700">
                                <Sparkles className="h-4 w-4" />
                                <span className="font-bold">{applicant.aiScore || 0}/100</span>
                              </div>
                              <div className="flex items-center gap-1 mt-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <svg
                                    key={star}
                                    className={cn(
                                      "w-4 h-4",
                                      star <= Math.round((applicant.aiScore || 0) / 20)
                                        ? "text-amber-400 fill-current"
                                        : "text-slate-200"
                                    )}
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setScoreDialogApplicant(applicant)}
                                className="mt-3 h-8 gap-2 rounded-md px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                              >
                                <CircleHelp className="h-4 w-4" />
                                Why this score?
                              </Button>
                            </>
                          ) : (
                            <Button
                              onClick={() => handleEvaluateApplicant(applicant.id)}
                              disabled={evaluating[applicant.id]}
                              variant="outline"
                              size="sm"
                              className="gap-2 bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200 shadow-sm transition-all"
                            >
                              {evaluating[applicant.id] ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Sparkles className="w-4 h-4" />
                              )}
                              {evaluating[applicant.id] ? "Evaluating..." : "Evaluate with AI"}
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                    );
                  })()}
                </div>
              ))
            )}
            </div>
          </div>
        </div>
      </div>
      <Dialog open={Boolean(scoreDialogApplicant)} onOpenChange={(open) => !open && setScoreDialogApplicant(null)}>
        <DialogContent className="max-h-[90vh] w-[90vw] max-w-[90vw] sm:max-w-3xl lg:max-w-4xl overflow-y-auto rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,1))] p-0 shadow-2xl">
          <div className="border-b border-slate-200/60 bg-white/50 px-6 py-5 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0f172a,#1e293b)] text-white shadow-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-950">AI Scrutiny Report</DialogTitle>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Deep Template Analysis</p>
              </div>
            </div>
          </div>

          {scoreDialogApplicant ? (
            <div className="p-6 space-y-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 rounded-2xl border border-indigo-200/60 bg-[linear-gradient(180deg,rgba(238,242,255,0.6),rgba(224,231,255,0.4))] p-6 shadow-sm">
                <div className="flex-1">
                  <h3 className="text-lg font-bold tracking-tight text-slate-950">{scoreDialogApplicant.name || "Applicant"}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-indigo-900/80">
                    {scoreDialogApplicant.evaluationDetails?.scoreRationale?.overall || scoreDialogApplicant.aiSummary || "No rationale has been saved yet."}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-center justify-center rounded-xl border border-indigo-200 bg-white px-8 py-5 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">Match Score</span>
                  <span className="mt-1 text-4xl font-black text-indigo-950">{scoreDialogApplicant.aiScore || 0}<span className="text-2xl text-indigo-300">/100</span></span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {scoreRows.map((row) => (
                  <div key={row.label} className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                    <div className="absolute right-0 top-0 h-full w-1 bg-slate-100 group-hover:bg-indigo-500 transition-colors" />
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{row.label}</p>
                      <div className="flex items-center justify-center rounded-lg bg-slate-50 px-3 py-1 font-bold text-slate-700 border border-slate-100">
                        {row.score}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">{row.rationale}</p>
                  </div>
                ))}
              </div>

              {(scoreDialogApplicant.evaluationDetails?.strengths?.length || scoreDialogApplicant.evaluationDetails?.concerns?.length) && (
                <div className="grid gap-6 md:grid-cols-2 items-start">
                  {scoreDialogApplicant.evaluationDetails?.strengths?.length ? (
                    <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        <h4 className="font-bold text-emerald-900">Template Matches</h4>
                      </div>
                      <ul className="space-y-3">
                        {scoreDialogApplicant.evaluationDetails.strengths.map((item: string, index: number) => (
                          <li key={`strength-${index}`} className="flex items-start gap-3 text-sm leading-relaxed text-emerald-800">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : <div />}

                  {scoreDialogApplicant.evaluationDetails?.concerns?.length ? (
                    <div className="rounded-2xl border border-rose-200/60 bg-rose-50/50 p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="h-5 w-5 text-rose-500" />
                        <h4 className="font-bold text-rose-900">Missing / Concerns</h4>
                      </div>
                      <ul className="space-y-3">
                        {scoreDialogApplicant.evaluationDetails.concerns.map((item: string, index: number) => (
                          <li key={`concern-${index}`} className="flex items-start gap-3 text-sm leading-relaxed text-rose-800">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : <div />}
                </div>
              )}

              {typeof scoreDialogApplicant.evaluationDetails?.resumeTextLength === "number" ? (
                <div className="text-center pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Engine processed {scoreDialogApplicant.evaluationDetails.resumeTextLength.toLocaleString()} characters of resume text
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
