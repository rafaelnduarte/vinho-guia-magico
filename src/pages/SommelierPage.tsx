import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  Wine, Send, Loader2, Sparkles, AlertTriangle,
  MessageSquare, Plus, ChevronLeft, Zap, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

const QUICK_SUGGESTIONS = [
  { label: "🍷 Harmonização", prompt: "Me ajuda com harmonização! Qual vinho do portal combina com um jantar de massas?" },
  { label: "✈️ Flight de 4", prompt: "Monte um flight de 4 vinhos do portal por um tema interessante." },
  { label: "🏷️ Explica selos", prompt: "Explica o que significam os selos do portal (perfis de bebedor e de vinho)." },
  { label: "⭐ Top vinhos", prompt: "Quais são os vinhos mais bem avaliados do portal?" },
];

export default function SommelierPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<"economico" | "detalhado">("economico");
  const [usageBrl, setUsageBrl] = useState(0);
  const [capBrl, setCapBrl] = useState(10);
  const [warning, setWarning] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch user sessions
  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ["chat-sessions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ChatSession[];
    },
    enabled: !!user,
  });

  // Fetch current month usage
  const { data: currentUsage, refetch: refetchUsage } = useQuery({
    queryKey: ["chat-usage", user?.id],
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

  // Fetch pricing config for cap
  useQuery({
    queryKey: ["chat-pricing"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_pricing_config")
        .select("monthly_cap_brl")
        .limit(1);
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
    const { data } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", sid)
      .order("created_at", { ascending: true });
    setMessages(
      (data ?? [])
        .filter((m: any) => m.role !== "system")
        .map((m: any) => ({ id: m.id, role: m.role, content: m.content, created_at: m.created_at }))
    );
  };

  const startNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setShowSidebar(false);
    inputRef.current?.focus();
  };

  const sendMessage = async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || isLoading) return;

    const usagePercent = (usageBrl / capBrl) * 100;
    const effectiveMode = usagePercent >= 90 ? "ultra_economico" : mode;

    setInput("");
    const userMsg: ChatMessage = { role: "user", content: msgText };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("sommelier-chat", {
        body: { message: msgText, session_id: sessionId, mode: effectiveMode },
      });

      if (error) throw error;

      if (data.error === "budget_exceeded") {
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ ${data.message}\n\nVocê pode:\n- 📖 **Ver fichas dos vinhos** na curadoria\n- 💬 Voltar no próximo mês com cota renovada`,
          },
        ]);
        return;
      }

      if (data.error === "rate_limited") {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: `⏳ ${data.message}` },
        ]);
        return;
      }

      if (data.error) throw new Error(data.message);

      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
        refetchSessions();
      }

      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);

      if (data.usage) {
        setUsageBrl(data.usage.cost_brl);
        setCapBrl(data.usage.cap_brl);
      }
      if (data.warning) setWarning(data.warning);
      refetchUsage();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro", description: e.message || "Falha ao enviar mensagem", variant: "destructive" });
      setMessages(prev => prev.slice(0, -1)); // remove optimistic user msg
    } finally {
      setIsLoading(false);
    }
  };

  const usagePercent = capBrl > 0 ? Math.min((usageBrl / capBrl) * 100, 100) : 0;
  const budgetExceeded = usageBrl >= capBrl;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] md:h-screen animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowSidebar(!showSidebar)}>
          <MessageSquare className="h-4 w-4" />
        </Button>
        <Wine className="h-5 w-5 text-primary" />
        <h1 className="font-display text-lg flex-1">Sommelier AI</h1>
        <Button variant="outline" size="sm" onClick={startNewChat} className="text-xs gap-1">
          <Plus className="h-3 w-3" /> Nova
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar - sessions */}
        <div className={cn(
          "absolute inset-y-0 left-0 z-30 w-64 bg-card border-r border-border transition-transform md:relative md:translate-x-0",
          showSidebar ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Conversas</span>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowSidebar(false)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {sessions?.map(s => (
                <button
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm truncate transition-colors",
                    sessionId === s.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {s.title}
                </button>
              ))}
              {(!sessions || sessions.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conversa ainda</p>
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
                <span className="text-muted-foreground">Uso mensal</span>
                <span className={cn(
                  "font-medium",
                  usagePercent >= 80 ? "text-destructive" : "text-foreground"
                )}>
                  R$ {usageBrl.toFixed(2)} / R$ {capBrl.toFixed(2)}
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
                    <h2 className="font-display text-xl text-foreground mb-2">Olá! Sou o Sommelier AI</h2>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Especialista em vinhos do portal Radar do Jovem. Posso ajudar com harmonizações,
                      sugestões de flights e tudo sobre os vinhos do nosso catálogo.
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
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
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
                    {warning}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="px-4 py-3 border-t border-border bg-card shrink-0">
            <div className="max-w-2xl mx-auto">
              {/* Mode toggle */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setMode("economico")}
                  className={cn(
                    "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors",
                    mode === "economico" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Zap className="h-3 w-3" /> Curto
                </button>
                <button
                  onClick={() => setMode("detalhado")}
                  className={cn(
                    "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors",
                    mode === "detalhado" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <BookOpen className="h-3 w-3" /> Detalhado
                </button>
              </div>

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
                  placeholder={budgetExceeded ? "Limite mensal atingido" : "Pergunte sobre vinhos..."}
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
