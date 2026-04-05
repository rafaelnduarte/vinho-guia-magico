import { useState, useRef, useEffect, useCallback } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import MemberBadge from "@/components/MemberBadge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  Wine, Send, Loader2, Sparkles, AlertTriangle,
  MessageSquare, Plus, ChevronLeft, Search, X,
  ThumbsUp, ThumbsDown, FlaskConical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const EDGE_FUNCTION_NAME = "sommelier-chat-v2";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  recommended_wine_ids?: string[];
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  user_id: string;
  owner_name?: string;
  owner_membership?: "radar" | "comunidade" | "admin";
}


const normalizeChatMessages = (allMsgs: Array<any>): ChatMessage[] =>
  (allMsgs ?? [])
    .filter((m: any) => m.role !== "system")
    .map((m: any) => ({
      id: m.id,
      role: m.role,
      content: typeof m.content === "string" ? m.content : "",
      created_at: m.created_at,
    }))
    .filter((m: ChatMessage) => m.role !== "assistant" || m.content.trim().length > 0);

const hasRenderableAssistantReply = (allMsgs: ChatMessage[]) =>
  allMsgs.some((m) => m.role === "assistant" && m.content.trim().length > 0);

const getMessageContentKey = (message: Pick<ChatMessage, "role" | "content">) =>
  `${message.role}:${message.content.trim().slice(0, 200)}`;

const mergeHydratedMessages = (previousMessages: ChatMessage[], hydratedMessages: ChatMessage[]) => {
  const assistantWineIdQueues = new Map<string, string[][]>();

  previousMessages.forEach((message) => {
    if (message.role !== "assistant" || !message.recommended_wine_ids?.length) return;

    const key = getMessageContentKey(message);
    const queue = assistantWineIdQueues.get(key) ?? [];
    queue.push(message.recommended_wine_ids);
    assistantWineIdQueues.set(key, queue);
  });

  const mergedMessages = hydratedMessages.map((message) => {
    if (message.role !== "assistant") return message;

    const queue = assistantWineIdQueues.get(getMessageContentKey(message));
    const recommended_wine_ids = queue?.shift();

    return recommended_wine_ids ? { ...message, recommended_wine_ids } : message;
  });

  const hydratedUserCounts = new Map<string, number>();

  hydratedMessages.forEach((message) => {
    if (message.role !== "user") return;

    const key = getMessageContentKey(message);
    hydratedUserCounts.set(key, (hydratedUserCounts.get(key) ?? 0) + 1);
  });

  const seenUserCounts = new Map<string, number>();
  const localOnlyUsers = previousMessages.filter((message) => {
    if (message.role !== "user") return false;

    const key = getMessageContentKey(message);
    const seenCount = seenUserCounts.get(key) ?? 0;
    seenUserCounts.set(key, seenCount + 1);

    return seenCount >= (hydratedUserCounts.get(key) ?? 0);
  });

  return [...mergedMessages, ...localOnlyUsers];
};

const hasAssistantReplyAfterPendingMessage = (allMsgs: ChatMessage[], pendingText?: string | null) => {
  const normalizedPendingText = pendingText?.trim().toLowerCase();

  if (!normalizedPendingText) {
    return hasRenderableAssistantReply(allMsgs);
  }

  let matchedUserIndex = -1;

  for (let index = allMsgs.length - 1; index >= 0; index -= 1) {
    const message = allMsgs[index];
    if (message.role === "user" && message.content.trim().toLowerCase() === normalizedPendingText) {
      matchedUserIndex = index;
      break;
    }
  }

  if (matchedUserIndex === -1) {
    return false;
  }

  return allMsgs.slice(matchedUserIndex + 1).some(
    (message) => message.role === "assistant" && message.content.trim().length > 0,
  );
};

const QUICK_SUGGESTIONS = [
  { label: "🍷 Harmonização", prompt: "Me ajuda com harmonização! Qual vinho do portal combina com um jantar de massas?" },
  { label: "✈️ Flight de 4", prompt: "Monte um flight de 4 vinhos do portal por um tema interessante." },
  { label: "🏷️ Explica selos", prompt: "Explica o que significam os selos do portal (perfis de bebedor e de vinho)." },
  { label: "⭐ Top vinhos", prompt: "Quais são os vinhos mais bem avaliados do portal?" },
];

export default function SommelierTestPage() {
  const { user, role } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [usageBrl, setUsageBrl] = useState(0);
  const [capBrl, setCapBrl] = useState(10);
  const [warning, setWarning] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [feedbackSent, setFeedbackSent] = useState<Record<number, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const latestPendingMessageRef = useRef<string | null>(null);
  const recoveryAttemptedRef = useRef(false);

  const isAdmin = role === "admin";

  const fetchRecentSessionMessages = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", sid)
      .order("created_at", { ascending: false })
      .limit(10);

    return normalizeChatMessages([...(data ?? [])].reverse());
  }, []);

  const sendFeedback = async (wineIds: string[], feedback: "liked" | "disliked", msgIndex: number) => {
    if (!user || feedbackSent[msgIndex] !== undefined) return;
    setFeedbackSent(prev => ({ ...prev, [msgIndex]: feedback }));
    for (const wineId of wineIds) {
      await supabase.from("user_preference_log").upsert(
        { user_id: user.id, wine_id: wineId, feedback },
        { onConflict: "user_id,wine_id" }
      );
    }
  };

  const hydrateSessionMessages = useCallback(async (sid: string) => {
    const { data: allMsgs } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", sid)
      .order("created_at", { ascending: true });

    const normalized = normalizeChatMessages(allMsgs ?? []);
    setMessages((prev) => mergeHydratedMessages(prev, normalized));
    return normalized;
  }, []);

  const tryHydratePendingReply = useCallback(async (sid: string) => {
    const pendingText = latestPendingMessageRef.current;
    if (!pendingText) return false;

    const recentMessages = await fetchRecentSessionMessages(sid);
    if (!hasAssistantReplyAfterPendingMessage(recentMessages, pendingText)) {
      return false;
    }

    await hydrateSessionMessages(sid);
    setIsLoading(false);
    latestPendingMessageRef.current = null;
    return true;
  }, [fetchRecentSessionMessages, hydrateSessionMessages]);

  const recoverPendingConversation = useCallback(async () => {
    if (!user || !isLoading || recoveryAttemptedRef.current) return false;

    recoveryAttemptedRef.current = true;

    const pendingText = latestPendingMessageRef.current?.trim().toLowerCase();
    const recentWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: recentSessions } = await supabase
      .from("chat_sessions")
      .select("id, created_at")
      .eq("user_id", user.id)
      .gte("created_at", recentWindow)
      .order("created_at", { ascending: false })
      .limit(5);

    for (const session of recentSessions ?? []) {
      const { data: sessionMessages } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      const normalized = normalizeChatMessages(sessionMessages ?? []);

      const hasMatchingUserMessage = pendingText
        ? normalized.some((m) => m.role === "user" && m.content.trim().toLowerCase() === pendingText)
        : normalized.some((m) => m.role === "user");

      const hasAssistantReply = hasAssistantReplyAfterPendingMessage(normalized, pendingText);

      if (hasMatchingUserMessage) {
        setSessionId(session.id);
        setMessages((prev) => mergeHydratedMessages(prev, normalized));

        if (hasAssistantReply) {
          setIsLoading(false);
          latestPendingMessageRef.current = null;
          return true;
        }
      }
    }

    return false;
  }, [user, isLoading]);

  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ["chat-sessions-test", user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("chat_sessions")
        .select("id, title, created_at, user_id")
        .order("updated_at", { ascending: false })
        .limit(100);

      if (!isAdmin) {
        query = query.eq("user_id", user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const sessionsRaw = data ?? [];

      if (!isAdmin) {
        return sessionsRaw.map(s => ({ ...s, owner_name: undefined })) as ChatSession[];
      }

      const allOtherUserIds = [...new Set(sessionsRaw.filter(s => s.user_id !== user!.id).map(s => s.user_id))];
      let profileMap: Record<string, string> = {};
      let membershipMap: Record<string, string> = {};

      if (allOtherUserIds.length > 0) {
        const [{ data: profiles }, { data: memberships }, { data: roles }] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name").in("user_id", allOtherUserIds),
          supabase.from("memberships").select("user_id, membership_type").eq("status", "active").in("user_id", allOtherUserIds),
          supabase.from("user_roles").select("user_id, role").in("user_id", allOtherUserIds),
        ]);
        profileMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.full_name ?? "Usuário"]));
        const roleMap = Object.fromEntries((roles ?? []).map(r => [r.user_id, r.role]));
        (memberships ?? []).forEach(m => { membershipMap[m.user_id] = m.membership_type; });
        Object.entries(roleMap).forEach(([uid, role]) => { if (role === "admin") membershipMap[uid] = "admin"; });
      }

      return sessionsRaw.map(s => ({
        ...s,
        owner_name: s.user_id !== user!.id ? (profileMap[s.user_id] || "Usuário") : undefined,
        owner_membership: s.user_id !== user!.id ? (membershipMap[s.user_id] as any || "comunidade") : undefined,
      })) as ChatSession[];
    },
    enabled: !!user,
  });

  const { data: currentUsage, refetch: refetchUsage } = useQuery({
    queryKey: ["chat-usage-test", user?.id],
    queryFn: async () => {
      const month = new Date().toISOString().slice(0, 7);
      const { data } = await supabase
        .from("usage_ledger")
        .select("estimated_cost_brl")
        .eq("user_id", user!.id)
        .eq("month", month)
        .maybeSingle();
      return Number(data?.estimated_cost_brl ?? 0);
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (currentUsage !== undefined) setUsageBrl(currentUsage);
  }, [currentUsage]);

  useQuery({
    queryKey: ["chat-pricing-test"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_member_ai_limits");
      if (data?.[0]) setCapBrl(Number(data[0].monthly_cap_brl));
      return data;
    },
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const loadSession = async (sid: string) => {
    setSessionId(sid);
    setShowSidebar(false);
    recoveryAttemptedRef.current = false;
    latestPendingMessageRef.current = null;
    setFeedbackSent({});
    await hydrateSessionMessages(sid);
  };

  const startNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setShowSidebar(false);
    setWarning(null);
    setFeedbackSent({});
    latestPendingMessageRef.current = null;
    recoveryAttemptedRef.current = false;
    inputRef.current?.focus();
  };

  const sendMessage = async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || isLoading) return;

    setInput("");
    latestPendingMessageRef.current = msgText;
    recoveryAttemptedRef.current = false;

    const userMsg: ChatMessage = { role: "user", content: msgText };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let keepRecoveryAlive = false;

    try {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: { message: msgText, session_id: sessionId },
      });

      if (error) throw error;

      if (data.error === "budget_exceeded") {
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ Seus créditos mensais acabaram!\n\nVocê pode:\n- 📖 **Ver fichas dos vinhos** na curadoria\n- 💬 Voltar no próximo mês com créditos renovados`,
          },
        ]);
        latestPendingMessageRef.current = null;
        return;
      }

      if (data.error === "rate_limited") {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: `⏳ ${data.message}` },
        ]);
        latestPendingMessageRef.current = null;
        return;
      }

      if (data.error) throw new Error(data.message);

      if (data.session_id) {
        setSessionId(data.session_id);
        refetchSessions();
        setTimeout(() => refetchSessions(), 4000);
      }


      const assistantText = typeof data?.message === "string" ? data.message : "";

      if (!assistantText.trim()) {
        const hydrated = data?.session_id ? await hydrateSessionMessages(data.session_id) : [];

        if (hasRenderableAssistantReply(hydrated)) {
          latestPendingMessageRef.current = null;
          recoveryAttemptedRef.current = false;
          if (data.usage) {
            setUsageBrl(data.usage.cost_brl);
            setCapBrl(data.usage.cap_brl);
          }
          if (data.warning) setWarning(data.warning);
          refetchUsage();
          return;
        }

        setMessages(prev => [
          ...prev,
          { role: "assistant", content: "⚠️ A IA retornou uma resposta vazia. Tente novamente." },
        ]);
        latestPendingMessageRef.current = null;
        return;
      }

      const wasRecoveredByPolling = latestPendingMessageRef.current === null;
      recoveryAttemptedRef.current = false;

      if (!wasRecoveredByPolling) {
        latestPendingMessageRef.current = null;
        setMessages(prev => [...prev, {
          role: "assistant",
          content: assistantText,
          recommended_wine_ids: data.recommended_wine_ids ?? [],
        }]);
      }

      if (data.usage) {
        setUsageBrl(data.usage.cost_brl);
        setCapBrl(data.usage.cap_brl);
      }
      if (data.warning) setWarning(data.warning);
      refetchUsage();
    } catch (e: any) {
      console.error(e);

      let backendMessage: string | null = null;

      if (e instanceof FunctionsHttpError) {
        const errorPayload = await e.context.json().catch(() => null) as { error?: string; message?: string } | null;

        if (errorPayload?.error === "payment_required") {
          setMessages(prev => [
            ...prev,
            {
              role: "assistant",
              content: `⚠️ ${errorPayload.message || "A IA está temporariamente indisponível por limite de crédito do provedor."}`,
            },
          ]);
          latestPendingMessageRef.current = null;
          return;
        }

        if (errorPayload?.error === "rate_limited") {
          setMessages(prev => [
            ...prev,
            { role: "assistant", content: `⏳ ${errorPayload.message || "Muitas mensagens no momento."}` },
          ]);
          latestPendingMessageRef.current = null;
          return;
        }

        if (errorPayload?.error === "ai_gateway_error") {
          setMessages(prev => [
            ...prev,
            { role: "assistant", content: `⚠️ ${errorPayload.message || "Erro ao consultar IA. Tente novamente em instantes."}` },
          ]);
          latestPendingMessageRef.current = null;
          return;
        }

        backendMessage = errorPayload?.message ?? null;
      }

      if (sessionId) {
        const recoveredFromSession = await tryHydratePendingReply(sessionId);
        if (recoveredFromSession) {
          refetchUsage();
          return;
        }
      }

      const recovered = await recoverPendingConversation();
      if (recovered) {
        refetchSessions();
        refetchUsage();
        return;
      }

      if (!(e instanceof FunctionsHttpError)) {
        keepRecoveryAlive = true;
        return;
      }

      const errorMsg = backendMessage || e.message || "Falha ao enviar mensagem";
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `⚠️ ${errorMsg}\n\nTente enviar sua mensagem novamente.` },
      ]);
      latestPendingMessageRef.current = null;
    } finally {
      if (!keepRecoveryAlive) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const hasPendingRecovery = !!latestPendingMessageRef.current;
    if (!isLoading && !hasPendingRecovery) return;

    const pollInterval = setInterval(async () => {
      const pendingText = latestPendingMessageRef.current;
      if (!pendingText) {
        return;
      }

      if (sessionId) {
        const recoveredFromSession = await tryHydratePendingReply(sessionId);
        if (recoveredFromSession) {
          refetchUsage();
          return;
        }
      }

      const recovered = await recoverPendingConversation();
      if (recovered) {
        refetchSessions();
        refetchUsage();
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [isLoading, sessionId, recoverPendingConversation, refetchSessions, tryHydratePendingReply, refetchUsage]);

  useEffect(() => {
    const hasPendingRecovery = !!latestPendingMessageRef.current;
    if (!isLoading && !hasPendingRecovery) return;

    const handleVisibilityRecovery = async () => {
      if (document.visibilityState !== "visible") return;

      const pendingText = latestPendingMessageRef.current;
      if (!pendingText) return;

      if (sessionId) {
        const recoveredFromSession = await tryHydratePendingReply(sessionId);
        if (recoveredFromSession) {
          refetchUsage();
          return;
        }
      }

      const recovered = await recoverPendingConversation();
      if (recovered) {
        refetchSessions();
        refetchUsage();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityRecovery);
    window.addEventListener("focus", handleVisibilityRecovery);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityRecovery);
      window.removeEventListener("focus", handleVisibilityRecovery);
    };
  }, [isLoading, sessionId, recoverPendingConversation, refetchSessions, tryHydratePendingReply, refetchUsage]);

  const usageCredits = Math.round(usageBrl * 10);
  const capCredits = Math.round(capBrl * 10);
  const usagePercent = capCredits > 0 ? Math.min((usageCredits / capCredits) * 100, 100) : 0;
  const budgetExceeded = usageCredits >= capCredits;

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] md:h-[100dvh] animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowSidebar(!showSidebar)}>
          <MessageSquare className="h-4 w-4" />
        </Button>
        <Wine className="h-5 w-5 text-primary" />
        <h1 className="font-display text-lg flex-1">Jovem AI</h1>

        {/* Test badge */}
        <Badge className="bg-orange-500/10 border-orange-500/30 text-orange-500 hover:bg-orange-500/10 gap-1">
          <FlaskConical className="h-3 w-3" />
          TESTE v2
        </Badge>


        <Button variant="outline" size="sm" onClick={startNewChat} className="text-xs gap-1">
          <Plus className="h-3 w-3" /> Nova
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar - sessions */}
        <div className={cn(
          "absolute inset-y-0 left-0 z-30 w-72 bg-card/95 backdrop-blur-sm border-r border-border transition-transform md:relative md:translate-x-0 flex flex-col",
          showSidebar ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Histórico</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden" onClick={() => setShowSidebar(false)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          {/* Search */}
          <div className="px-3 py-2 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={sessionSearch}
                onChange={e => setSessionSearch(e.target.value)}
                placeholder="Buscar conversas..."
                className="w-full rounded-md border border-input bg-background pl-8 pr-8 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {sessionSearch && (
                <button
                  onClick={() => setSessionSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {(sessions ?? [])
                .filter(s => {
                  if (!sessionSearch.trim()) return true;
                  const q = sessionSearch.toLowerCase();
                  return (s.title || "").toLowerCase().includes(q) || (s.owner_name || "").toLowerCase().includes(q);
                })
                .map(s => {
                const isActive = sessionId === s.id;
                const isOwn = !s.owner_name;
                return (
                  <button
                    key={s.id}
                    onClick={() => loadSession(s.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all group",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-foreground/80 hover:bg-muted/40"
                    )}
                  >
                    <span className="block truncate text-[13px] leading-snug font-medium">
                      {s.title || "Nova conversa"}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] text-muted-foreground/60">
                        {new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                      {!isOwn && (
                        <>
                          <span className="text-[11px] text-muted-foreground/40">·</span>
                          <span className="truncate max-w-[80px] text-[11px] text-muted-foreground/70">{s.owner_name}</span>
                          <MemberBadge type={s.owner_membership || "comunidade"} className="scale-[0.8] origin-left" />
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
              {sessions && sessions.length > 0 && sessionSearch.trim() && (sessions ?? []).filter(s => (s.title || "").toLowerCase().includes(sessionSearch.toLowerCase()) || (s.owner_name || "").toLowerCase().includes(sessionSearch.toLowerCase())).length === 0 && (
                <div className="text-center py-6 px-4">
                  <Search className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/60">Nenhuma conversa encontrada</p>
                </div>
              )}
              {(!sessions || sessions.length === 0) && (
                <div className="text-center py-8 px-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/60">Nenhuma conversa ainda</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Usage bar */}
          <div className="px-4 py-2 bg-muted/30 border-b border-border flex items-center gap-3 shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Créditos mensais</span>
                <span className={cn(
                  "font-medium",
                  usagePercent >= 80 ? "text-destructive" : "text-foreground"
                )}>
                  {usageCredits} / {capCredits} créditos
                </span>
              </div>
              <Progress
                value={usagePercent}
                className="h-1.5"
              />
            </div>
            {usagePercent >= 80 && (
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            )}
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-4">
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8 space-y-6">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <div>
                    <h2 className="font-display text-xl text-foreground mb-2">Jovem AI v2 — Ambiente de Teste</h2>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Esta versão inclui memória personalizada, jornada do paladar e anti-repetição de recomendações.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {QUICK_SUGGESTIONS.map(s => (
                      <button
                        key={s.label}
                        onClick={() => sendMessage(s.prompt)}
                        disabled={budgetExceeded}
                        className="px-3 py-2 rounded-lg border border-border bg-card text-xs text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i}>
                  <div className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] rounded-xl px-4 py-3 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-foreground"
                    )}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                  {/* Feedback buttons for assistant messages with recommendations */}
                  {msg.role === "assistant" && msg.recommended_wine_ids && msg.recommended_wine_ids.length > 0 && (
                    <div className="flex justify-start mt-2 ml-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Gostou das recomendações?</span>
                        <button
                          onClick={() => sendFeedback(msg.recommended_wine_ids!, "liked", i)}
                          disabled={feedbackSent[i] !== undefined}
                          className={cn(
                            "p-1 rounded transition-colors",
                            feedbackSent[i] === "liked" ? "text-emerald-500" : "hover:text-emerald-500 text-muted-foreground",
                            feedbackSent[i] !== undefined && "opacity-70"
                          )}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => sendFeedback(msg.recommended_wine_ids!, "disliked", i)}
                          disabled={feedbackSent[i] !== undefined}
                          className={cn(
                            "p-1 rounded transition-colors",
                            feedbackSent[i] === "disliked" ? "text-destructive" : "hover:text-destructive text-muted-foreground",
                            feedbackSent[i] !== undefined && "opacity-70"
                          )}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Pensando...</span>
                  </div>
                </div>
              )}

              {warning && !budgetExceeded && (
                <div className="flex justify-center">
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" />
                    Seus créditos estão acabando.
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="px-4 py-3 border-t border-border bg-card shrink-0">
            <div className="max-w-2xl mx-auto">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={budgetExceeded ? "Créditos esgotados este mês" : "Pergunte sobre vinhos..."}
                  disabled={budgetExceeded || isLoading}
                  rows={1}
                  className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                />
                <Button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading || budgetExceeded}
                  size="icon"
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
