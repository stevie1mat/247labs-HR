import { supabase } from "@/lib/supabase";

export type ActivityLogPayload = {
  action: string;
  category?: string;
  entityType: string;
  entityId?: string | null;
  title: string;
  detail?: string | null;
  platform?: string | null;
  sourceName?: string | null;
  statusTone?: "success" | "warning" | "neutral";
  jobPostingId?: string | null;
  templateId?: string | null;
  postingSourceId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logActivity(payload: ActivityLogPayload) {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  const { error } = await supabase.from("activityLogs").insert({
    ...payload,
    actorId: user?.id ?? null,
    actorEmail: user?.email ?? null,
  });

  if (error) {
    throw error;
  }
}
