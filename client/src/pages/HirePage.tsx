import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { Send, Bot, User, Loader2, CheckCircle2, Plus, BookmarkCheck, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  suggestions?: string[];
};

export default function HirePage() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [requestId, setRequestId] = useState<string | number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isReadyToPost, setIsReadyToPost] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [finalTitle, setFinalTitle] = useState("");
  const [finalDescription, setFinalDescription] = useState("");
  const [finalRequirements, setFinalRequirements] = useState("");
  const [finalSalary, setFinalSalary] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createRequest = useMutation({
    mutationFn: async (seed?: {
      title?: string;
      description?: string;
      requirements?: string;
      salaryRange?: string;
      conversationHistory?: Array<{ role: string; content: string; timestamp: number }>;
    }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not logged in");
        const { data, error } = await supabase.from('jobRequests').insert({
            createdById: user.id,
            status: 'draft',
            title: seed?.title,
            finalDescription: seed?.description,
            finalRequirements: seed?.requirements,
            salaryRange: seed?.salaryRange,
            conversationHistory: seed?.conversationHistory ?? []
        }).select().single();
        if (error) throw error;
        return data;
    }
  });

  const sendMessage = useMutation({
    mutationFn: async ({ requestId, message }: { requestId: string | number, message: string }) => {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ requestId, message })
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }
  });

  const finalizeRequest = useMutation({
    mutationFn: async ({ requestId, title, description, requirements, salaryRange }: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: posting, error: postingError } = await supabase.from('jobPostings').insert({
            requestId,
            title,
            description,
            requirements,
            salaryRange,
            status: 'active',
            postedById: user?.id
        }).select().single();
        if (postingError) throw postingError;

        await supabase.from('jobRequests').update({ status: 'finalized' }).eq('id', requestId);

        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/distribute-job`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ postingId: posting.id })
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }
  });

  const saveAsDraft = useMutation({
    mutationFn: async ({ requestId, title, description, requirements, salaryRange }: any) => {
        const { error } = await supabase.from('jobRequests').update({
            title,
            finalDescription: description,
            finalRequirements: requirements,
            salaryRange,
            status: 'draft'
        }).eq('id', requestId);
        if (error) throw error;
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get("templateId");
    const mode = params.get("mode");

    if (requestId || createRequest.isPending || messages.length > 0) return;

    if (templateId) {
      void (async () => {
        try {
          const { data: template, error } = await supabase
            .from("jobTemplates")
            .select("*")
            .eq("id", templateId)
            .single();

          if (error) throw error;
          if (!template) throw new Error("Template not found");

          const seededAssistantMessage = {
            role: "assistant" as const,
            content: `I've loaded **${template.title}** as a starting point. We can remix this role, adjust the requirements, update the salary range, and turn it into a new hiring request.\n\nWhat would you like to change first?`,
            timestamp: Date.now(),
            suggestions: [
              "Make it more senior",
              "Adjust the salary range",
              "Rewrite the responsibilities",
              "Add remote work option",
            ],
          };

          const seededHistory = [
            {
              role: "assistant",
              content: `Template loaded for remix: ${template.title}`,
              timestamp: Date.now(),
            },
          ];

          const req = await createRequest.mutateAsync({
            title: template.title,
            description: template.description ?? "",
            requirements: template.requirements ?? "",
            salaryRange: template.salaryRange ?? "",
            conversationHistory: seededHistory,
          });

          setRequestId(req.id);
          setMessages([seededAssistantMessage]);
          setFinalTitle(template.title ?? "");
          setFinalDescription(template.description ?? "");
          setFinalRequirements(template.requirements ?? "");
          setFinalSalary(template.salaryRange ?? "");
        } catch {
          toast.error("Failed to load template for remix.");
        }
      })();
      return;
    }

    if (mode === "generate") {
      void startNewRequest();
    }
  }, [requestId, createRequest.isPending, messages.length]);

  const startNewRequest = async () => {
    try {
      const req = await createRequest.mutateAsync(undefined);
      if (req) {
        setRequestId(req.id);
        setMessages([{
          role: "assistant",
          content: "Hello! I'm your AI hiring assistant for 247 Labs. I'm here to help you create a professional job posting.\n\nTo get started, just tell me who you'd like to hire — for example: *\"I need to hire a senior frontend developer\"* or *\"We're looking for a UI/UX designer\"*.\n\nWhat role are you looking to fill?",
          timestamp: Date.now(),
          suggestions: [
            "Senior Full Stack Developer",
            "React Native Developer",
            "UI/UX Designer",
            "DevOps Engineer",
            "QA Engineer",
            "Technical Project Manager",
          ],
        }]);
        setIsReadyToPost(false);
        const params = new URLSearchParams(window.location.search);
        if (params.has("templateId") || params.has("mode")) {
          window.history.replaceState({}, "", "/hire");
        }
      }
    } catch {
      toast.error("Failed to start a new request. Please try again.");
    }
  };

  const handleSend = async (messageText?: string) => {
    const userMessage = (messageText ?? input).trim();
    if (!userMessage || !requestId) return;
    setInput("");

    setMessages(prev => [...prev, { role: "user", content: userMessage, timestamp: Date.now() }]);

    try {
      const result = await sendMessage.mutateAsync({ requestId, message: userMessage });
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: result.message,
          timestamp: Date.now(),
          suggestions: result.suggestions?.length ? result.suggestions : undefined,
        },
      ]);
      if (result.isReadyToPost) {
        setIsReadyToPost(true);
        setFinalTitle(result.extractedTitle ?? "");
        setFinalRequirements(result.extractedRequirements ?? "");
        setFinalSalary(result.extractedSalaryRange ?? "");
        setFinalDescription(result.message);
      }
    } catch {
      toast.error("Failed to send message. Please try again.");
      setMessages(prev => prev.slice(0, -1));
      setInput(userMessage);
    }
  };

  const handleFinalize = async () => {
    if (!requestId || !finalTitle || !finalDescription) return;
    try {
      await finalizeRequest.mutateAsync({
        requestId,
        title: finalTitle,
        description: finalDescription,
        requirements: finalRequirements || undefined,
        salaryRange: finalSalary || undefined,
      });
      toast.success("Job posted successfully to all active platforms!");
      setShowFinalizeDialog(false);
      setRequestId(null);
      setMessages([]);
      setIsReadyToPost(false);
      queryClient.invalidateQueries({ queryKey: ['jobPostings'] });
      queryClient.invalidateQueries({ queryKey: ['jobRequests'] });
      navigate("/my-postings");
    } catch {
      toast.error("Failed to post job. Please try again.");
    }
  };

  const handleSaveAsDraft = async () => {
    if (!requestId || !finalTitle || !finalDescription) return;
    try {
      await saveAsDraft.mutateAsync({
        requestId,
        title: finalTitle,
        description: finalDescription,
        requirements: finalRequirements || undefined,
        salaryRange: finalSalary || undefined,
      });
      toast.success("Job saved as draft! You can post it later from My Requests.");
      setShowFinalizeDialog(false);
      setRequestId(null);
      setMessages([]);
      setIsReadyToPost(false);
      queryClient.invalidateQueries({ queryKey: ['jobRequests'] });
      navigate("/my-requests");
    } catch {
      toast.error("Failed to save draft. Please try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Determine if the last message is from the assistant (to show chips only on latest)
  const lastAssistantIdx = messages.map((m, i) => m.role === "assistant" ? i : -1).filter(i => i !== -1).at(-1) ?? -1;

  return (
    <div className="w-full h-full flex flex-col">
      {!requestId ? (
        /* Start Screen */
        <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <CardContent className="flex flex-col items-center gap-6 px-6 py-12 text-center sm:px-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="h-8 w-8" />
            </div>
            <div>
              <h2 className="mb-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">AI-Powered Hiring Assistant</h2>
              <p className="max-w-md text-sm leading-7 text-slate-500">
                Start a conversation to create a job posting. The AI will ask clarifying questions, suggest quick answers, and generate a professional job description ready to post on LinkedIn, Upwork, and Indeed.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "Hire a Full Stack Developer",
                "Need a React Native Developer",
                "Looking for a UI/UX Designer",
                "Hire a DevOps Engineer",
                "Need a QA Engineer",
                "Hire a Technical Project Manager",
              ].map(example => (
                <button
                  key={example}
                  onClick={() => startNewRequest().then(() => setInput(example))}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  {example}
                </button>
              ))}
            </div>
            <Button
              onClick={startNewRequest}
              disabled={createRequest.isPending}
              className="h-11 rounded-xl bg-primary px-8 text-white hover:bg-primary/90"
            >
              {createRequest.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Start New Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Chat Interface */
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white py-0 shadow-[0_16px_40px_rgba(15,23,42,0.08)]" style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}>
            <CardHeader className="flex-row items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-sm font-medium text-slate-950">Manus AI Assistant</span>
              </div>
              <div className="flex items-center gap-2">
                {isReadyToPost && (
                  <Badge className="rounded-lg border-[#10B981]/20 bg-[#10B981]/10 text-xs text-[#10B981]">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Ready to Post
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={() => { setRequestId(null); setMessages([]); setIsReadyToPost(false); }} className="h-8 rounded-lg border-slate-200 text-xs text-slate-700">
                  New Request
                </Button>
              </div>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-4">
              {messages.map((msg, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${msg.role === "assistant" ? "bg-primary" : "bg-slate-950"}`}>
                      {msg.role === "assistant" ? <Bot className="w-3.5 h-3.5 text-white" /> : <User className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className={`max-w-[80%] rounded-xl border px-4 py-3 text-sm shadow-sm ${msg.role === "assistant" ? "border-slate-200 bg-white text-slate-900" : "border-primary bg-primary text-white"}`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-900">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                  </div>
                  {/* Suggestion chips — only show on the latest assistant message and when not ready to post */}
                  {msg.role === "assistant" && i === lastAssistantIdx && !isReadyToPost && msg.suggestions && msg.suggestions.length > 0 && !sendMessage.isPending && (
                    <div className="ml-10 flex flex-wrap gap-2">
                      {msg.suggestions.map((suggestion, si) => (
                        <button
                          key={si}
                          onClick={() => handleSend(suggestion)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {sendMessage.isPending && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex gap-1 items-center h-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input */}
            <div className="border-t border-slate-200 bg-white p-4">
              {isReadyToPost ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowFinalizeDialog(true)}
                    className="flex-1 rounded-xl bg-[#10B981] text-white hover:bg-emerald-600"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Review & Post Job
                  </Button>
                  <Button variant="outline" onClick={() => setIsReadyToPost(false)} className="rounded-xl border-slate-200">
                    Continue Editing
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message or pick a suggestion above..."
                    disabled={sendMessage.isPending}
                    className="flex-1 rounded-xl border-slate-200 bg-slate-50 focus-visible:bg-white focus-visible:ring-primary"
                  />
                  <Button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || sendMessage.isPending}
                    className="rounded-xl bg-primary px-4 text-white hover:bg-primary/90"
                  >
                    {sendMessage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Review & Post / Save as Draft Dialog */}
      <Dialog open={showFinalizeDialog} onOpenChange={(open) => !open && !finalizeRequest.isPending && setShowFinalizeDialog(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white">
          {finalizeRequest.isPending ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#10B981]/10 mb-6">
                <Loader2 className="h-8 w-8 text-[#10B981] animate-spin" />
              </div>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-slate-900">Distributing Job...</h2>
              <p className="text-sm text-slate-500 mt-2 text-center max-w-[280px]">
                Please wait while we automatically post your job to all active platforms.
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                  Review & Post Job
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="title" className="text-sm font-medium">Job Title *</Label>
                  <Input id="title" value={finalTitle} onChange={e => setFinalTitle(e.target.value)} className="mt-1" placeholder="e.g. Senior Frontend Developer" />
                </div>
                <div>
                  <Label htmlFor="description" className="text-sm font-medium">Job Description *</Label>
                  <Textarea id="description" value={finalDescription} onChange={e => setFinalDescription(e.target.value)} className="mt-1 min-h-[150px]" placeholder="Full job description..." />
                </div>
                <div>
                  <Label htmlFor="requirements" className="text-sm font-medium">Requirements</Label>
                  <Textarea id="requirements" value={finalRequirements} onChange={e => setFinalRequirements(e.target.value)} className="mt-1 min-h-[100px]" placeholder="Required skills and qualifications..." />
                </div>
                <div>
                  <Label htmlFor="salary" className="text-sm font-medium">Salary Range</Label>
                  <Input id="salary" value={finalSalary} onChange={e => setFinalSalary(e.target.value)} className="mt-1" placeholder="e.g. $80,000 - $120,000" />
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs text-primary font-medium">Posting will be distributed to all active platforms (LinkedIn, Upwork, Indeed, etc.).</p>
                </div>
              </div>
              <DialogFooter className="gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setShowFinalizeDialog(false)} className="rounded-xl border-slate-200">Cancel</Button>
                <Button
                  variant="outline"
                  onClick={handleSaveAsDraft}
                  disabled={!finalTitle || !finalDescription || saveAsDraft.isPending}
                  className="rounded-xl border-primary/40 text-primary hover:bg-primary/5"
                >
                  {saveAsDraft.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BookmarkCheck className="w-4 h-4 mr-2" />}
                  Save as Draft
                </Button>
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    handleFinalize();
                  }}
                  disabled={!finalTitle || !finalDescription || finalizeRequest.isPending}
                  className="rounded-xl bg-[#10B981] text-white hover:bg-emerald-600"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Post Job Now
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
