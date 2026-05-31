import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { Send, Bot, User, Loader2, CheckCircle2, Sparkles, Plus, BookmarkCheck } from "lucide-react";
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
  const [requestId, setRequestId] = useState<number | null>(null);
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
    mutationFn: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not logged in");
        const { data, error } = await supabase.from('jobRequests').insert({
            createdById: user.id,
            status: 'draft',
            conversationHistory: []
        }).select().single();
        if (error) throw error;
        return data;
    }
  });

  const sendMessage = useMutation({
    mutationFn: async ({ requestId, message }: { requestId: number, message: string }) => {
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

  const startNewRequest = async () => {
    try {
      const req = await createRequest.mutateAsync();
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
      navigate("/postings");
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
      navigate("/requests");
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
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[#8B5CF6] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#1F2937]">New Hire Request</h1>
        </div>
        <p className="text-sm text-gray-500 ml-11">Chat with Manus AI to create and post a job in minutes</p>
      </div>

      {!requestId ? (
        /* Start Screen */
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center">
              <Bot className="w-8 h-8 text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#1F2937] mb-2">AI-Powered Hiring Assistant</h2>
              <p className="text-gray-500 max-w-md text-sm leading-relaxed">
                Start a conversation to create a job posting. The AI will ask clarifying questions, suggest quick answers, and generate a professional job description ready to post on LinkedIn, Upwork, and Indeed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
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
                  className="px-3 py-1.5 text-xs rounded-full border border-[#8B5CF6]/30 text-[#8B5CF6] hover:bg-[#8B5CF6]/5 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
            <Button
              onClick={startNewRequest}
              disabled={createRequest.isPending}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-8"
            >
              {createRequest.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Start New Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Chat Interface */
        <div className="flex flex-col gap-4">
          <Card className="border-0 shadow-sm bg-white flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}>
            <CardHeader className="pb-3 border-b flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-sm font-medium text-[#1F2937]">Manus AI Assistant</span>
              </div>
              <div className="flex items-center gap-2">
                {isReadyToPost && (
                  <Badge className="bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Ready to Post
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={() => { setRequestId(null); setMessages([]); setIsReadyToPost(false); }} className="text-xs h-7">
                  New Request
                </Button>
              </div>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === "assistant" ? "bg-[#8B5CF6]" : "bg-[#1F2937]"}`}>
                      {msg.role === "assistant" ? <Bot className="w-3.5 h-3.5 text-white" /> : <User className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === "assistant" ? "bg-gray-50 text-[#1F2937] rounded-tl-sm" : "bg-[#8B5CF6] text-white rounded-tr-sm"}`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none prose-headings:text-[#1F2937] prose-p:text-[#1F2937]">
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
                          className="px-3 py-1.5 text-xs rounded-full border border-[#8B5CF6]/40 text-[#8B5CF6] bg-[#8B5CF6]/5 hover:bg-[#8B5CF6]/15 transition-colors font-medium"
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
                  <div className="w-7 h-7 rounded-full bg-[#8B5CF6] flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center h-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input */}
            <div className="p-4 border-t">
              {isReadyToPost ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowFinalizeDialog(true)}
                    className="flex-1 bg-[#10B981] hover:bg-emerald-600 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Review & Post Job
                  </Button>
                  <Button variant="outline" onClick={() => setIsReadyToPost(false)}>
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
                    className="flex-1 border-gray-200 focus-visible:ring-[#8B5CF6]"
                  />
                  <Button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || sendMessage.isPending}
                    className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-4"
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
      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <div className="rounded-lg bg-[#8B5CF6]/5 border border-[#8B5CF6]/20 p-3">
              <p className="text-xs text-[#8B5CF6] font-medium">Posting will be distributed to all active platforms (LinkedIn, Upwork, Indeed) in mock/sandbox mode.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowFinalizeDialog(false)}>Cancel</Button>
            <Button
              variant="outline"
              onClick={handleSaveAsDraft}
              disabled={!finalTitle || !finalDescription || saveAsDraft.isPending}
              className="border-[#8B5CF6]/40 text-[#8B5CF6] hover:bg-[#8B5CF6]/5"
            >
              {saveAsDraft.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BookmarkCheck className="w-4 h-4 mr-2" />}
              Save as Draft
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={!finalTitle || !finalDescription || finalizeRequest.isPending}
              className="bg-[#10B981] hover:bg-emerald-600 text-white"
            >
              {finalizeRequest.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Post Job Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
