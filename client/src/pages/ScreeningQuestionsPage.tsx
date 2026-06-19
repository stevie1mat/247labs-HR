import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Inbox, Briefcase, Search, Settings2, Trash2, Plus, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Reorder, useDragControls } from "framer-motion";

function JobPostingItem({ posting, isSelected, onClick }: any) {
  return (
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
          {posting.status || 'Active'}
        </p>
      </div>
    </button>
  );
}

function QuestionItem({ question, onUpdate, onDelete }: any) {
  const controls = useDragControls();

  return (
    <Reorder.Item value={question} dragListener={false} dragControls={controls} className="relative group bg-white rounded-xl border border-slate-200 p-4 mb-3 shadow-sm">
      <div className="flex gap-4">
        <div 
          className="pt-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"
          onPointerDown={(e) => controls.start(e)}
        >
          <GripVertical className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-3">
          <Input 
            value={question.title} 
            onChange={(e) => onUpdate({ ...question, title: e.target.value })}
            placeholder="Category / Short Title"
            className="font-semibold text-sm border-slate-200 h-9"
          />
          <Textarea 
            value={question.prompt} 
            onChange={(e) => onUpdate({ ...question, prompt: e.target.value })}
            placeholder="The full question prompt..."
            className="text-sm border-slate-200 min-h-[80px]"
          />
        </div>
        <div>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Reorder.Item>
  );
}

export default function ScreeningQuestionsPage() {
  const queryClient = useQueryClient();
  const [selectedPostingId, setSelectedPostingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch postings
  const { data: postings, isLoading: isLoadingPostings } = useQuery({
    queryKey: ['jobPostings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobPostings')
        .select('id, title, status, description, createdAt')
        .order('createdAt', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  const selectedPosting = postings?.find(p => p.id === selectedPostingId);

  // Fetch questions for the selected posting
  const { data: screeningQuestionsData, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ['jobScreeningQuestions', selectedPostingId],
    queryFn: async () => {
      if (!selectedPostingId) return null;
      const { data, error } = await supabase
        .from('jobScreeningQuestions')
        .select('questions')
        .eq('jobPostingId', selectedPostingId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows
      return data;
    },
    enabled: !!selectedPostingId
  });

  // Load questions when data is fetched
  useEffect(() => {
    if (screeningQuestionsData?.questions) {
      setQuestions(screeningQuestionsData.questions);
    } else {
      setQuestions([]);
    }
  }, [screeningQuestionsData]);

  // Select first posting by default
  useEffect(() => {
    if (postings && postings.length > 0 && !selectedPostingId) {
      setSelectedPostingId(postings[0].id);
    }
  }, [postings, selectedPostingId]);

  const handleGenerateAI = async () => {
    if (!selectedPosting) return;
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-screening-questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ 
          title: selectedPosting.title,
          description: selectedPosting.description
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to generate questions.");

      if (data.questions && Array.isArray(data.questions)) {
        // give them random IDs for drag and drop
        const newQs = data.questions.map((q: any) => ({ ...q, id: crypto.randomUUID() }));
        setQuestions(newQs);
        toast.success("Questions generated successfully! Please review and save.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate questions.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPosting) return;
    setIsSaving(true);
    try {
      const formattedQuestions = questions.map(q => ({ title: q.title, prompt: q.prompt }));

      const { error } = await supabase
        .from('jobScreeningQuestions')
        .upsert({ 
          jobPostingId: selectedPosting.id, 
          questions: formattedQuestions 
        }, { onConflict: 'jobPostingId' });

      if (error) throw error;

      toast.success("Screening questions saved successfully!");
      queryClient.invalidateQueries({ queryKey: ['jobScreeningQuestions', selectedPosting.id] });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save questions.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, { id: crypto.randomUUID(), title: "", prompt: "" }]);
  };

  const handleUpdateQuestion = (updatedQ: any) => {
    setQuestions(questions.map(q => q.id === updatedQ.id ? updatedQ : q));
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  if (isLoadingPostings) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const safePostings = postings || [];
  const filteredPostings = safePostings.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-[calc(100vh-5rem)] w-full gap-6 pb-4">
      {/* Sidebar */}
      <div className="w-80 shrink-0 flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl border border-white/70 bg-white/88 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl p-5 flex flex-col h-full">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/70">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950">Postings</h2>
              <p className="text-sm font-medium text-slate-500 mt-0.5">Select a job posting</p>
            </div>
          </div>

          <div className="mt-4 mb-2 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search postings..."
              className="h-10 rounded-lg border-slate-200 pl-9 text-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-1 mt-2">
            {filteredPostings.length === 0 ? (
               <div className="text-center py-8 text-slate-500 text-sm">No postings found.</div>
            ) : (
              filteredPostings.map((posting: any) => (
                <JobPostingItem 
                  key={posting.id} 
                  posting={posting} 
                  isSelected={selectedPostingId === posting.id} 
                  onClick={() => setSelectedPostingId(posting.id)} 
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="overflow-hidden rounded-xl border border-white/70 bg-white/88 px-8 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl shrink-0 flex flex-col h-full">
          
          {selectedPosting ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Settings2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-950">Screening Questions</h2>
                    <p className="mt-1 text-sm text-slate-500">Configure questions for <span className="font-semibold text-slate-700">{selectedPosting.title}</span></p>
                  </div>
                </div>

                {questions.length > 0 && (
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      onClick={handleGenerateAI} 
                      disabled={isGenerating}
                      className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm"
                    >
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {isGenerating ? "Generating..." : "Generate AI Questions"}
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2 shadow-sm">
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Save Questions
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pt-6 pb-2 pr-2">
                {questions.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4 border border-slate-100">
                      <Inbox className="h-8 w-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No Screening Questions</h3>
                    <p className="text-slate-500 mt-1 max-w-sm mx-auto">
                      Generate questions automatically using AI based on the job description, or add them manually.
                    </p>
                    <div className="mt-6 flex justify-center gap-3">
                      <Button onClick={handleGenerateAI} disabled={isGenerating} className="gap-2">
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Generate with AI
                      </Button>
                      <Button variant="outline" onClick={handleAddQuestion} className="gap-2">
                        <Plus className="h-4 w-4" /> Add Manual
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Reorder.Group axis="y" values={questions} onReorder={setQuestions} className="space-y-3">
                      {questions.map((q) => (
                        <QuestionItem 
                          key={q.id} 
                          question={q} 
                          onUpdate={handleUpdateQuestion} 
                          onDelete={() => handleDeleteQuestion(q.id)} 
                        />
                      ))}
                    </Reorder.Group>
                    
                    <div className="mt-4 flex justify-center">
                      <Button variant="ghost" onClick={handleAddQuestion} className="gap-2 text-slate-500 hover:text-slate-700">
                        <Plus className="h-4 w-4" /> Add Another Question
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-slate-500">
                <Briefcase className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p>Select a job posting from the left to manage its screening questions.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
