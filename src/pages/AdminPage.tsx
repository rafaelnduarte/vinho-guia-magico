import { Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminWines from "@/components/admin/AdminWines";
import AdminPartners from "@/components/admin/AdminPartners";
import AdminSeals from "@/components/admin/AdminSeals";
import AdminMembers from "@/components/admin/AdminMembers";

export default function AdminPage() {
  return (
    <div className="animate-fade-in px-6 py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-sans font-bold text-foreground">Painel Admin</h1>
      </div>

      <Tabs defaultValue="wines" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="wines">Vinhos</TabsTrigger>
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="partners">Parceiros</TabsTrigger>
          <TabsTrigger value="seals">Selos</TabsTrigger>
        </TabsList>

        <TabsContent value="wines">
          <AdminWines />
        </TabsContent>
        <TabsContent value="members">
          <AdminMembers />
        </TabsContent>
        <TabsContent value="partners">
          <AdminPartners />
        </TabsContent>
        <TabsContent value="seals">
          <AdminSeals />
        </TabsContent>
      </Tabs>
    </div>
  );
}
