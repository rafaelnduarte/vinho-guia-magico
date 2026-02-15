import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, Users } from "lucide-react";
import CsvImportDialog, { type CsvColumn, type CsvImportResult } from "./CsvImportDialog";

const memberColumns: CsvColumn[] = [
  { key: "email", label: "Email", required: true, validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Email inválido" },
  { key: "full_name", label: "Nome Completo", required: true },
  { key: "status", label: "Status", validate: (v) => ["active", "inactive"].includes(v.toLowerCase()) ? null : "Use 'active' ou 'inactive'" },
  { key: "source", label: "Origem" },
  { key: "external_id", label: "ID Externo" },
];

export default function AdminMembers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [csvOpen, setCsvOpen] = useState(false);

  const { data: members, isLoading } = useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("*, profiles!memberships_user_id_fkey(full_name, avatar_url)")
        .order("created_at", { ascending: false });
      // If join fails, fall back to just memberships
      if (error) {
        const { data: fallback, error: e2 } = await supabase.from("memberships").select("*").order("created_at", { ascending: false });
        if (e2) throw e2;
        return fallback;
      }
      return data;
    },
  });

  const handleImport = async (rows: Record<string, any>[]): Promise<CsvImportResult> => {
    let success = 0;
    let skipped = 0;
    const errors: CsvImportResult["errors"] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const email = row.email?.toLowerCase();
      const fullName = row.full_name;
      const status = row.status?.toLowerCase() || "active";
      const source = row.source || "csv_import";
      const externalId = row.external_id || null;

      try {
        // Check if user exists in auth
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u: any) => u.email?.toLowerCase() === email
        );

        let userId: string;
        if (existingUser) {
          userId = existingUser.id;
        } else {
          // Create user
          const tempPassword = crypto.randomUUID() + "Aa1!";
          const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: fullName },
          });
          if (createErr) {
            errors.push({ row: i + 2, field: "email", message: createErr.message });
            continue;
          }
          userId = newUser.user.id;
        }

        // Upsert membership
        const { data: existingMembership } = await supabase
          .from("memberships")
          .select("id")
          .eq("user_id", userId)
          .eq("source", source)
          .maybeSingle();

        if (existingMembership) {
          await supabase
            .from("memberships")
            .update({ status, external_id: externalId })
            .eq("id", existingMembership.id);
          skipped++;
        } else {
          await supabase.from("memberships").insert({
            user_id: userId,
            status,
            source,
            external_id: externalId,
          });
          success++;
        }

        // Ensure role exists
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (!existingRole) {
          await supabase.from("user_roles").insert({ user_id: userId, role: "member" });
        }
      } catch (err: any) {
        errors.push({ row: i + 2, field: "geral", message: err.message });
      }
    }

    queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    return { success, errors, skipped };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Membros ({members?.length ?? 0})</h2>
        <Button onClick={() => setCsvOpen(true)} variant="outline" className="gap-2">
          <Upload className="h-4 w-4" /> Importar CSV
        </Button>
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
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Origem</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members?.map((m: any) => (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {m.profiles?.full_name || m.user_id.slice(0, 8)}
                          </p>
                          <p className="text-xs text-muted-foreground">{m.external_id ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{m.source}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.status === "active" ? "default" : "secondary"}>
                        {m.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {new Date(m.started_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
                {members?.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Nenhum membro cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
