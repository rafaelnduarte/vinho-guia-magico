import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, Users, Plus, Search, ArrowLeft, BarChart3, KeyRound, Pencil, Clock, ThumbsUp, MessageSquare, Eye, Download, RotateCcw } from "lucide-react";
import CsvImportDialog, { type CsvColumn, type CsvImportResult } from "./CsvImportDialog";
import MemberBadge from "@/components/MemberBadge";
import { exportToCsv } from "@/lib/exportCsv";

const memberColumns: CsvColumn[] = [
  { key: "email", label: "Email", required: true, validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Email inválido" },
  { key: "full_name", label: "Nome Completo", required: true },
  { key: "status", label: "Status", validate: (v) => ["active", "inactive"].includes(v.toLowerCase()) ? null : "Use 'active' ou 'inactive'" },
  { key: "membership_type", label: "Tipo", validate: (v) => ["radar", "comunidade"].includes(v.toLowerCase()) ? null : "Use 'radar' ou 'comunidade'" },
  { key: "role", label: "Role", validate: (v) => ["admin", "member"].includes(v.toLowerCase()) ? null : "Use 'admin' ou 'member'" },
  { key: "source", label: "Origem" },
  { key: "external_id", label: "ID Externo" },
];

async function callAdminMembers(action: string, params: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await supabase.functions.invoke("admin-members", {
    body: { action, ...params },
  });
  if (resp.error) throw new Error(resp.error.message);
  if (resp.data?.error) throw new Error(resp.data.error);
  return resp.data;
}

export default function AdminMembers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [csvOpen, setCsvOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [createForm, setCreateForm] = useState({ email: "", full_name: "", status: "active", membership_type: "radar", role: "member" as "member" | "admin" });

  const { data: members, isLoading } = useQuery({
    queryKey: ["admin-members-enriched"],
    queryFn: () => callAdminMembers("list_members"),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!createForm.email.trim() || !createForm.full_name.trim()) throw new Error("Email e nome são obrigatórios");
      return callAdminMembers("create_member", {
        email: createForm.email.trim(),
        full_name: createForm.full_name.trim(),
        status: createForm.status,
        membership_type: createForm.membership_type,
        role: createForm.role,
        source: "manual",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-members-enriched"] });
      setCreateOpen(false);
      setCreateForm({ email: "", full_name: "", status: "active", membership_type: "radar", role: "member" });
      toast({ title: "Membro criado com sucesso" });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleImport = async (rows: Record<string, any>[]): Promise<CsvImportResult> => {
    const allMembers = rows.map((row) => ({
      email: row.email?.toLowerCase(),
      full_name: row.full_name,
      status: row.status?.toLowerCase() || "active",
      membership_type: row.membership_type?.toLowerCase() || "radar",
      role: row.role?.toLowerCase() || "member",
      source: row.source || "csv_import",
    }));

    const BATCH_SIZE = 50;
    let totalSuccess = 0;
    let totalSkipped = 0;
    const allErrors: CsvImportResult["errors"] = [];

    for (let i = 0; i < allMembers.length; i += BATCH_SIZE) {
      const batch = allMembers.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allMembers.length / BATCH_SIZE);
      
      toast({ title: `Importando lote ${batchNum}/${totalBatches}...`, description: `${i + 1}-${Math.min(i + BATCH_SIZE, allMembers.length)} de ${allMembers.length}` });

      const result = await callAdminMembers("bulk_create_members", { members: batch });

      totalSuccess += result.success ?? 0;
      totalSkipped += result.skipped ?? 0;
      (result.errors ?? []).forEach((e: any) => {
        allErrors.push({ row: (e.row ?? 0) + i, field: "geral", message: `${e.email}: ${e.message}` });
      });
    }

    queryClient.invalidateQueries({ queryKey: ["admin-members-enriched"] });
    return { success: totalSuccess, errors: allErrors, skipped: totalSkipped };
  };

  const filteredMembers = (members ?? []).filter((m: any) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (typeFilter !== "all" && m.membership_type !== typeFilter) return false;
    if (roleFilter !== "all" && m.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!m.email?.toLowerCase().includes(q) && !m.profiles?.full_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleExport = () => {
    const headers = ["Nome", "Email", "Status", "Tipo", "Role", "Origem", "Membro desde"];
    const rows = filteredMembers.map((m: any) => [
      m.profiles?.full_name || "",
      m.email || "",
      m.status === "active" ? "Ativo" : "Inativo",
      m.membership_type || "comunidade",
      m.role || "member",
      m.source || "",
      m.started_at ? new Date(m.started_at).toLocaleDateString("pt-BR") : "",
    ]);
    exportToCsv(`membros-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  // If a member is selected, show detail view
  if (selectedUserId) {
    return <MemberDetail userId={selectedUserId} onBack={() => setSelectedUserId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-foreground">Membros ({members?.length ?? 0})</h2>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button onClick={() => setCsvOpen(true)} variant="outline" className="gap-2">
            <Upload className="h-4 w-4" /> Importar CSV
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Membro
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="radar">Radar</SelectItem>
            <SelectItem value="comunidade">Comunidade</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Membro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Membro</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Origem</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Desde</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMembers.map((m: any) => (
                  <tr key={m.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedUserId(m.user_id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="font-medium text-foreground">
                          {m.profiles?.full_name || "Sem nome"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{m.source}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MemberBadge type={m.role === "admin" ? "admin" : (m.membership_type || "comunidade")} />
                        <Badge variant={m.status === "active" ? "default" : "secondary"}>
                          {m.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {new Date(m.started_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedUserId(m.user_id); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredMembers.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum membro encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Member Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Membro</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={createForm.email} onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Nome Completo *</Label>
              <Input value={createForm.full_name} onChange={(e) => setCreateForm(f => ({ ...f, full_name: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={createForm.status} onValueChange={(v) => setCreateForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={createForm.membership_type} onValueChange={(v) => setCreateForm(f => ({ ...f, membership_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="radar">Radar</SelectItem>
                  <SelectItem value="comunidade">Comunidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm(f => ({ ...f, role: v as "member" | "admin" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar Membro
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CsvImportDialog
        open={csvOpen}
        onOpenChange={setCsvOpen}
        title="Importar Membros via CSV"
        columns={memberColumns}
        onImport={handleImport}
        templateFileName="membros-template.csv"
      />
    </div>
  );
}

// ─── Member Detail View ───
function MemberDetail({ userId, onBack }: { userId: string; onBack: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", status: "", membership_type: "comunidade" });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-member-detail", userId],
    queryFn: () => callAdminMembers("get_member_detail", { userId }),
  });

  const updateMutation = useMutation({
    mutationFn: () => callAdminMembers("update_member", {
      userId,
      full_name: editForm.full_name.trim(),
      status: editForm.status,
      membership_type: editForm.membership_type,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-members-enriched"] });
      setEditOpen(false);
      toast({ title: "Membro atualizado" });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: () => callAdminMembers("reset_password", { email: data?.email }),
    onSuccess: (resp) => {
      toast({ title: "Link de recuperação gerado", description: "O link foi gerado. Copie e envie ao membro." });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const resetOnboardingMutation = useMutation({
    mutationFn: () => callAdminMembers("reset_onboarding", { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", userId] });
      toast({ title: "Senha redefinida", description: "A senha foi resetada para o email do usuário. No próximo login ele será obrigado a criar uma nova senha." });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <p className="text-muted-foreground text-center py-12">Membro não encontrado.</p>
      </div>
    );
  }

  const openEdit = () => {
    setEditForm({
      full_name: data.profile?.full_name ?? "",
      status: data.membership?.status ?? "active",
      membership_type: data.membership?.membership_type ?? "comunidade",
    });
    setEditOpen(true);
  };

  // Group activity by type
  const pageViewCount = data.stats?.pageViews ?? 0;
  const voteCount = data.stats?.voteCount ?? 0;
  const commentCount = data.stats?.commentCount ?? 0;

  // Recent activity
  const recentActivity = (data.recentActivity ?? []).slice(0, 20);

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar aos membros</Button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <Users className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-semibold text-foreground">{data.profile?.full_name || "Sem nome"}</h2>
              <MemberBadge type={data.role === "admin" ? "admin" : (data.membership?.membership_type || "comunidade")} />
            </div>
            <p className="text-sm text-muted-foreground">{data.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEdit} className="gap-2">
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button
            variant="outline"
            onClick={() => { if (confirm("Enviar link de redefinição de senha?")) resetMutation.mutate(); }}
            disabled={resetMutation.isPending}
            className="gap-2"
          >
           <KeyRound className="h-4 w-4" /> Redefinir Senha
          </Button>
          <Button
            variant="outline"
            onClick={() => { if (confirm("Resetar senha para o email do usuário? Ele será obrigado a criar uma nova senha no próximo login.")) resetOnboardingMutation.mutate(); }}
            disabled={resetOnboardingMutation.isPending}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" /> Resetar Acesso
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Membro desde</p>
          <p className="font-medium text-foreground">
            {data.membership?.started_at ? new Date(data.membership.started_at).toLocaleDateString("pt-BR") : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Status</p>
          <Badge variant={data.membership?.status === "active" ? "default" : "secondary"}>
            {data.membership?.status === "active" ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Último acesso</p>
          <p className="font-medium text-foreground">
            {data.profile?.last_seen_at ? new Date(data.profile.last_seen_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Nunca"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Origem</p>
          <p className="font-medium text-foreground">{data.membership?.source ?? "—"}</p>
        </div>
      </div>

      {/* Stats */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Engajamento
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <Eye className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold text-foreground">{pageViewCount}</p>
            <p className="text-xs text-muted-foreground">Páginas vistas</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <ThumbsUp className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold text-foreground">{voteCount}</p>
            <p className="text-xs text-muted-foreground">Votos</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <MessageSquare className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold text-foreground">{commentCount}</p>
            <p className="text-xs text-muted-foreground">Comentários</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" /> Atividade Recente
        </h3>
        {recentActivity.length > 0 ? (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Evento</th>
                    <th className="px-4 py-2 font-medium">Página</th>
                    <th className="px-4 py-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentActivity.map((e: any) => (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="text-xs">{e.event_type}</Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{e.page || "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(e.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Membro</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1">
              <Label>Nome Completo</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={editForm.membership_type} onValueChange={(v) => setEditForm(f => ({ ...f, membership_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="radar">Radar</SelectItem>
                  <SelectItem value="comunidade">Comunidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
