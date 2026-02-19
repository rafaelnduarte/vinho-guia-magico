import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, DollarSign, Users, MessageSquare, Settings,
  Loader2, Save, Wine, Plus, Trash2, Edit2, Check, X,
  BookOpen, FileText, ToggleLeft, ToggleRight
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function AdminChat() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="metrics" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 h-auto p-1 gap-0.5">
            <TabsTrigger value="metrics" className="text-xs px-3 py-2">Métricas</TabsTrigger>
            <TabsTrigger value="config" className="text-xs px-3 py-2">Configuração</TabsTrigger>
            <TabsTrigger value="prompt" className="text-xs px-3 py-2">System Prompt</TabsTrigger>
            <TabsTrigger value="knowledge" className="text-xs px-3 py-2">Base de Conhecimento</TabsTrigger>
            <TabsTrigger value="thomas" className="text-xs px-3 py-2">Notas Thomas</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="metrics"><ChatMetrics /></TabsContent>
        <TabsContent value="config"><ChatConfig /></TabsContent>
        <TabsContent value="prompt"><SystemPromptEditor /></TabsContent>
        <TabsContent value="knowledge"><KnowledgeBase /></TabsContent>
        <TabsContent value="thomas"><ThomasNotes /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---- METRICS ----
function ChatMetrics() {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data: usageData, isLoading } = useQuery({
    queryKey: ["admin-chat-usage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usage_ledger")
        .select("*")
        .eq("month", currentMonth);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["admin-chat-sessions-count"],
    queryFn: async () => {
      const startOfMonth = `${currentMonth}-01T00:00:00Z`;
      const { count, error } = await supabase
        .from("chat_sessions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfMonth);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: messageCount } = useQuery({
    queryKey: ["admin-chat-messages-count"],
    queryFn: async () => {
      const startOfMonth = `${currentMonth}-01T00:00:00Z`;
      const { count, error } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfMonth);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-chat-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles?.forEach(p => { map[p.user_id] = p.full_name || p.user_id.slice(0, 8); });
    return map;
  }, [profiles]);

  const stats = useMemo(() => {
    if (!usageData) return { totalCost: 0, totalRequests: 0, users: 0, topUsers: [] as any[] };
    const totalCost = usageData.reduce((s, u) => s + Number(u.estimated_cost_brl), 0);
    const totalRequests = usageData.reduce((s, u) => s + Number(u.request_count), 0);
    const topUsers = [...usageData]
      .sort((a, b) => Number(b.estimated_cost_brl) - Number(a.estimated_cost_brl))
      .slice(0, 10)
      .map(u => ({
        name: profileMap[u.user_id] || u.user_id.slice(0, 8),
        cost: Number(u.estimated_cost_brl),
        requests: Number(u.request_count),
      }));
    return { totalCost, totalRequests, users: usageData.length, topUsers };
  }, [usageData, profileMap]);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <BarChart3 className="h-4 w-4" /> Métricas — {currentMonth}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={DollarSign} label="Custo Total" value={`R$ ${stats.totalCost.toFixed(2)}`} />
        <MetricCard icon={MessageSquare} label="Mensagens" value={String(messageCount ?? 0)} />
        <MetricCard icon={Users} label="Usuários" value={String(stats.users)} />
        <MetricCard icon={BarChart3} label="Sessões" value={String(sessions ?? 0)} />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-2 bg-muted/50">
          <h4 className="text-xs font-medium text-foreground">Top Usuários por Custo</h4>
        </div>
        <ScrollArea className="max-h-[200px]">
          <div className="divide-y divide-border">
            {stats.topUsers.map((u, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-foreground truncate">{u.name}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">{u.requests} msgs</span>
                  <Badge variant="secondary" className="text-xs">R$ {u.cost.toFixed(2)}</Badge>
                </div>
              </div>
            ))}
            {stats.topUsers.length === 0 && (
              <p className="px-4 py-4 text-sm text-muted-foreground text-center">Sem dados este mês</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

// ---- CONFIG ----
function ChatConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["admin-chat-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_pricing_config").select("*").limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const [form, setForm] = useState<Record<string, any>>({});

  useMemo(() => {
    if (config && Object.keys(form).length === 0) {
      setForm({
        monthly_cap_brl: config.monthly_cap_brl,
        price_in_per_1k: config.price_in_per_1k,
        price_out_per_1k: config.price_out_per_1k,
        usd_brl_rate: config.usd_brl_rate,
        max_tokens_economico: config.max_tokens_economico,
        max_tokens_detalhado: config.max_tokens_detalhado,
        max_tokens_ultra_economico: config.max_tokens_ultra_economico,
        rate_limit_per_5min: config.rate_limit_per_5min,
        rate_limit_per_day: config.rate_limit_per_day,
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!config) return;
      const { error } = await supabase
        .from("ai_pricing_config")
        .update(form)
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Configuração salva!" });
      queryClient.invalidateQueries({ queryKey: ["admin-chat-config"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const fields = [
    { key: "monthly_cap_brl", label: "Cap Mensal (BRL)", type: "number", step: "0.50" },
    { key: "usd_brl_rate", label: "Taxa USD/BRL", type: "number", step: "0.01" },
    { key: "price_in_per_1k", label: "Preço Input/1k tokens (USD)", type: "number", step: "0.00001" },
    { key: "price_out_per_1k", label: "Preço Output/1k tokens (USD)", type: "number", step: "0.00001" },
    { key: "max_tokens_economico", label: "Max Tokens (Econômico)", type: "number" },
    { key: "max_tokens_detalhado", label: "Max Tokens (Detalhado)", type: "number" },
    { key: "max_tokens_ultra_economico", label: "Max Tokens (Ultra Econômico)", type: "number" },
    { key: "rate_limit_per_5min", label: "Rate Limit / 5min", type: "number" },
    { key: "rate_limit_per_day", label: "Rate Limit / dia", type: "number" },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <Settings className="h-4 w-4" /> Configuração do Sommelier AI
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.key}>
            <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
            <Input
              type={f.type}
              step={f.step}
              value={form[f.key] ?? ""}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
        <Save className="h-4 w-4" /> Salvar
      </Button>
    </div>
  );
}

// ---- SYSTEM PROMPT EDITOR ----
function SystemPromptEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["admin-chat-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_pricing_config").select("*").limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (config?.system_prompt && !prompt) {
      setPrompt(config.system_prompt);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!config) return;
      const { error } = await supabase
        .from("ai_pricing_config")
        .update({ system_prompt: prompt })
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "System prompt salvo!" });
      queryClient.invalidateQueries({ queryKey: ["admin-chat-config"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <FileText className="h-4 w-4" /> System Prompt
      </h3>
      <p className="text-xs text-muted-foreground">
        Este é o prompt base que define a personalidade, regras e comportamento do Sommelier AI. 
        Os vinhos do portal e a base de conhecimento são injetados automaticamente.
      </p>
      <Textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        rows={16}
        className="font-mono text-xs"
        placeholder="Insira o system prompt..."
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{prompt.length} caracteres</span>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          <Save className="h-4 w-4" /> Salvar Prompt
        </Button>
      </div>
    </div>
  );
}

// ---- KNOWLEDGE BASE ----
function KnowledgeBase() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", content: "", category: "geral" });
  const [newEntry, setNewEntry] = useState({ title: "", content: "", category: "geral" });

  const { data: entries, isLoading } = useQuery({
    queryKey: ["admin-knowledge-base"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_knowledge_base")
        .select("*")
        .order("category")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newEntry.title.trim() || !newEntry.content.trim()) throw new Error("Preencha título e conteúdo");
      const { error } = await supabase.from("ai_knowledge_base").insert(newEntry);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Documento adicionado!" });
      setNewEntry({ title: "", content: "", category: "geral" });
      queryClient.invalidateQueries({ queryKey: ["admin-knowledge-base"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_knowledge_base")
        .update({ title: editForm.title, content: editForm.content, category: editForm.category })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Documento atualizado!" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-knowledge-base"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("ai_knowledge_base")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-knowledge-base"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_knowledge_base").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Documento removido" });
      queryClient.invalidateQueries({ queryKey: ["admin-knowledge-base"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const categories = [
    { value: "geral", label: "Geral" },
    { value: "regioes", label: "Regiões" },
    { value: "uvas", label: "Uvas" },
    { value: "harmonizacao", label: "Harmonização" },
    { value: "degustacao", label: "Degustação" },
    { value: "producao", label: "Produção" },
    { value: "cultura", label: "Cultura do Vinho" },
  ];

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <BookOpen className="h-4 w-4" /> Base de Conhecimento
      </h3>
      <p className="text-xs text-muted-foreground">
        Adicione documentos, artigos e textos que o Sommelier AI usará como referência. 
        Esses conteúdos são injetados automaticamente no contexto quando relevantes à pergunta do usuário.
      </p>

      {/* Add new entry */}
      <div className="rounded-lg border border-border p-3 space-y-3 bg-card">
        <p className="text-xs font-medium text-muted-foreground">Novo documento</p>
        <Input
          value={newEntry.title}
          onChange={e => setNewEntry(p => ({ ...p, title: e.target.value }))}
          placeholder="Título do documento (ex: Guia de Harmonização)"
        />
        <Select value={newEntry.category} onValueChange={v => setNewEntry(p => ({ ...p, category: v }))}>
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Textarea
          value={newEntry.content}
          onChange={e => setNewEntry(p => ({ ...p, content: e.target.value }))}
          placeholder="Cole aqui o conteúdo do documento, artigo ou texto de referência..."
          rows={6}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{newEntry.content.length} caracteres</span>
          <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="gap-1">
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>
      </div>

      {/* Entries list */}
      <div className="space-y-2">
        {entries?.map((entry: any) => (
          <div key={entry.id} className={`rounded-lg border border-border p-3 bg-card ${!entry.is_active ? 'opacity-50' : ''}`}>
            {editingId === entry.id ? (
              <div className="space-y-2">
                <Input
                  value={editForm.title}
                  onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                />
                <Select value={editForm.category} onValueChange={v => setEditForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Textarea
                  value={editForm.content}
                  onChange={e => setEditForm(p => ({ ...p, content: e.target.value }))}
                  rows={6}
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate(entry.id)} className="gap-1">
                    <Check className="h-3 w-3" /> Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-3 w-3" /> Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{entry.title}</span>
                    <Badge variant="outline" className="text-xs">{categories.find(c => c.value === entry.category)?.label ?? entry.category}</Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => toggleMutation.mutate({ id: entry.id, is_active: !entry.is_active })}
                      title={entry.is_active ? "Desativar" : "Ativar"}
                    >
                      {entry.is_active ? <ToggleRight className="h-3 w-3 text-green-500" /> : <ToggleLeft className="h-3 w-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      setEditingId(entry.id);
                      setEditForm({ title: entry.title, content: entry.content, category: entry.category });
                    }}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(entry.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{entry.content}</p>
                <span className="text-xs text-muted-foreground mt-1 block">{entry.content.length} caracteres</span>
              </>
            )}
          </div>
        ))}
        {(!entries || entries.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento na base de conhecimento</p>
        )}
      </div>
    </div>
  );
}

// ---- THOMAS NOTES ----
function ThomasNotes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [newNote, setNewNote] = useState({ wine_id: "", note_text: "", note_type: "opinion" });

  const { data: wines } = useQuery({
    queryKey: ["admin-wines-for-notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: notes, isLoading } = useQuery({
    queryKey: ["admin-thomas-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("thomas_notes")
        .select("*, wines(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newNote.wine_id || !newNote.note_text.trim()) throw new Error("Preencha todos os campos");
      const { error } = await supabase.from("thomas_notes").insert(newNote);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Nota adicionada!" });
      setNewNote({ wine_id: "", note_text: "", note_type: "opinion" });
      queryClient.invalidateQueries({ queryKey: ["admin-thomas-notes"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("thomas_notes").update({ note_text: editText }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Nota atualizada!" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-thomas-notes"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("thomas_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Nota removida" });
      queryClient.invalidateQueries({ queryKey: ["admin-thomas-notes"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <Wine className="h-4 w-4" /> Notas do Thomas
      </h3>

      <div className="rounded-lg border border-border p-3 space-y-3 bg-card">
        <p className="text-xs font-medium text-muted-foreground">Nova nota</p>
        <Select value={newNote.wine_id} onValueChange={v => setNewNote(p => ({ ...p, wine_id: v }))}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Selecione um vinho" />
          </SelectTrigger>
          <SelectContent>
            {wines?.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={newNote.note_type} onValueChange={v => setNewNote(p => ({ ...p, note_type: v }))}>
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="opinion">Opinião</SelectItem>
            <SelectItem value="harmonization">Harmonização</SelectItem>
            <SelectItem value="tip">Dica</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          value={newNote.note_text}
          onChange={e => setNewNote(p => ({ ...p, note_text: e.target.value }))}
          placeholder="Escreva a nota do Thomas..."
          rows={2}
        />
        <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="gap-1">
          <Plus className="h-3 w-3" /> Adicionar
        </Button>
      </div>

      <div className="space-y-2">
        {notes?.map((n: any) => (
          <div key={n.id} className="rounded-lg border border-border p-3 bg-card">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <span className="text-sm font-medium text-foreground">{n.wines?.name}</span>
                <Badge variant="outline" className="ml-2 text-xs">{n.note_type}</Badge>
              </div>
              <div className="flex gap-1 shrink-0">
                {editingId === n.id ? (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateMutation.mutate(n.id)}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(n.id); setEditText(n.note_text); }}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(n.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            {editingId === n.id ? (
              <Textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2} />
            ) : (
              <p className="text-sm text-muted-foreground">{n.note_text}</p>
            )}
          </div>
        ))}
        {(!notes || notes.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma nota cadastrada</p>
        )}
      </div>
    </div>
  );
}
