import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, Users, Plus, Search, ArrowLeft, BarChart3, KeyRound, Pencil, Clock, ThumbsUp, MessageSquare, Eye, Download, RotateCcw, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import CsvImportDialog, { type CsvColumn, type CsvImportResult } from "./CsvImportDialog";
import MemberBadge from "@/components/MemberBadge";
import { exportToCsv } from "@/lib/exportCsv";

const PAGE_SIZE = 50;

const memberColumns: CsvColumn[] = [
  { key: "email", label: "Email", required: true, validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Email inválido" },
  { key: "full_name", label: "Nome Completo", required: true },
  { key: "status", label: "Status", validate: (v) => ["active", "inactive"].includes(v.toLowerCase()) ? null : "Use 'active' ou 'inactive'" },
  { key: "membership_type", label: "Tipo", validate: (v) => ["radar", "comunidade"].includes(v.toLowerCase()) ? null : "Use 'radar' ou 'comunidade'" },
  { key: "gdb", label: "GDB", validate: (v) => ["tem acesso", "sem acesso"].includes(v.toLowerCase()) ? null : "Use 'Tem acesso' ou 'Sem acesso'" },
  { key: "role", label: "Role", validate: (v) => ["admin", "member"].includes(v.toLowerCase()) ? null : "Use 'admin' ou 'member'" },
  { key: "source", label: "Origem" },
  { key: "external_id", label: "ID Externo" },
];

async function callAdminMembers(action: string, params: Record<string, any> = {}) {
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

  // Server-side pagination & filters
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [createForm, setCreateForm] = useState({ email: "", full_name: "", status: "active", membership_type: "radar", role: "member" as "member" | "admin" });

  const queryKey = ["admin-members-paginated", page, searchQuery, statusFilter, typeFilter, roleFilter];

  const { data: membersResult, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_members_paginated", {
        _page: page,
        _page_size: PAGE_SIZE,
        _search: searchQuery,
        _status: statusFilter === "all" ? "" : statusFilter,
        _membership_type: typeFilter === "all" ? "" : typeFilter,
        _role: roleFilter === "all" ? "" : roleFilter,
      });
      if (error) throw error;
      return data as { data: any[]; total: number; page: number; page_size: number } | null;
    },
    placeholderData: (prev) => prev,
  });

  const members = Array.isArray(membersResult?.data) ? membersResult.data : [];
  const totalMembers = membersResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalMembers / PAGE_SIZE));

  const handleFilterChange = useCallback((setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    setSearchQuery(searchInput);
    setPage(1);
  }, [searchInput]);

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
      queryClient.invalidateQueries({ queryKey: ["admin-members-paginated"] });
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
      gdb: row.gdb ? row.gdb.toLowerCase() === "tem acesso" : false,
      role: row.role?.toLowerCase() || "member",
      source: row.source || "csv",
      external_id: row.external_id || null,
    }));

    const BATCH_SIZE = 10;
    let totalSuccess = 0;
    let totalSkipped = 0;
    const allErrors: CsvImportResult["errors"] = [];
    const totalBatches = Math.ceil(allMembers.length / BATCH_SIZE);

    for (let i = 0; i < allMembers.length; i += BATCH_SIZE) {
      const batch = allMembers.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      toast({ title: `Importando lote ${batchNum}/${totalBatches}...`, description: `${i + 1}-${Math.min(i + BATCH_SIZE, allMembers.length)} de ${allMembers.length}` });

      try {
        const result = await callAdminMembers("bulk_create_members", { members: batch });
        totalSuccess += result.success ?? 0;
        totalSkipped += result.skipped ?? 0;
        (result.errors ?? []).forEach((e: any) => {
          allErrors.push({ row: (e.row ?? 0) + i, field: "geral", message: `${e.email}: ${e.message}` });
        });
      } catch (batchErr: any) {
        console.error(`Batch ${batchNum} failed:`, batchErr.message);
        batch.forEach((m, j) => {
          allErrors.push({ row: i + j + 2, field: "geral", message: `${m.email}: Erro no lote - ${batchErr.message}` });
        });
      }

      if (i + BATCH_SIZE < allMembers.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    queryClient.invalidateQueries({ queryKey: ["admin-members-paginated"] });
    return { success: totalSuccess, errors: allErrors, skipped: totalSkipped };
  };

  const handleExport = async () => {
    // Export all matching members (not just current page)
    try {
      const allData = await callAdminMembers("list_members", {
        page: 1,
        pageSize: 10000,
        search: searchQuery,
        status: statusFilter === "all" ? "" : statusFilter,
        membership_type: typeFilter === "all" ? "" : typeFilter,
        role: roleFilter === "all" ? "" : roleFilter,
      });
      const rows = (allData?.data ?? []).map((m: any) => [
        m.full_name || "",
        m.email || "",
        m.status === "active" ? "Ativo" : "Inativo",
        m.membership_type || "comunidade",
        m.gdb ? "Tem acesso" : "Sem acesso",
        m.role || "member",
        m.source || "",
        m.started_at ? new Date(m.started_at).toLocaleDateString("pt-BR") : "",
      ]);
      exportToCsv(`membros-${new Date().toISOString().slice(0, 10)}.csv`, ["Nome", "Email", "Status", "Tipo", "GDB", "Role", "Origem", "Membro desde"], rows);
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
    }
  };

  if (selectedUserId) {
    return <MemberDetail userId={selectedUserId} onBack={() => setSelectedUserId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-foreground">Membros ({totalMembers})</h2>
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
        <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); handleSearchSubmit(); }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome... (Enter para buscar)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </form>
        <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="radar">Radar</SelectItem>
            <SelectItem value="comunidade">Comunidade</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={handleFilterChange(setRoleFilter)}>
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
      ) : isError ? (
        <div className="text-center py-12 text-destructive">
          <p className="font-medium">Erro ao carregar membros</p>
          <p className="text-sm text-muted-foreground mt-1">{(error as any)?.message || "Tente novamente"}</p>
          <Button variant="outline" className="mt-4" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-members-paginated"] })}>
            <RotateCcw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Membro</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Origem</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">GDB</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Desde</th>
                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((m: any) => (
                    <tr key={m.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedUserId(m.user_id)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="font-medium text-foreground">
                            {m.full_name || "Sem nome"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{m.source}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MemberBadge type={m.role === "admin" ? "admin" : (m.membership_type || "comunidade")} />
                          <Badge variant={m.status === "active" ? "default" : "secondary"}>
                            {m.status === "active" ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant={m.gdb ? "default" : "secondary"}>
                          {m.gdb ? "Tem acesso" : "Sem acesso"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                        {m.started_at ? new Date(m.started_at).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedUserId(m.user_id); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum membro encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalMembers)} de {totalMembers}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
                <span className="text-sm text-foreground font-medium">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="gap-1">
                  Próximo <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
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
  const [editForm, setEditForm] = useState({ full_name: "", status: "", membership_type: "comunidade", gdb: "false" });

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
      gdb: editForm.gdb === "true",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-members-paginated"] });
      setEditOpen(false);
      toast({ title: "Membro atualizado" });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: () => callAdminMembers("reset_password", { email: data?.email }),
    onSuccess: () => {
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

  const deleteMutation = useMutation({
    mutationFn: () => callAdminMembers("delete_user", { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-members-paginated"] });
      toast({ title: "Membro excluído com sucesso" });
      onBack();
    },
    onError: (e) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
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
      gdb: data.membership?.gdb ? "true" : "false",
    });
    setEditOpen(true);
  };

  const pageViewCount = data.stats?.pageViews ?? 0;
  const voteCount = data.stats?.voteCount ?? 0;
  const commentCount = data.stats?.commentCount ?? 0;
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
            onClick={() => { if (confirm("Resetar senha para o email do usuário?")) resetOnboardingMutation.mutate(); }}
            disabled={resetOnboardingMutation.isPending}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" /> Resetar Acesso
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(`Tem certeza que deseja EXCLUIR este membro permanentemente?\n\nEssa ação não pode ser desfeita. Todos os dados do membro serão removidos.`))
                deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
            className="gap-2"
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
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
          <p className="text-xs text-muted-foreground mb-1">GDB</p>
          <Badge variant={data.membership?.gdb ? "default" : "secondary"}>
            {data.membership?.gdb ? "Tem acesso" : "Sem acesso"}
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
            <div className="space-y-1">
              <Label>GDB</Label>
              <Select value={editForm.gdb} onValueChange={(v) => setEditForm(f => ({ ...f, gdb: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Com acesso</SelectItem>
                  <SelectItem value="false">Sem acesso</SelectItem>
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
