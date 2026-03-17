import { Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminWines from "@/components/admin/AdminWines";
import AdminPartners from "@/components/admin/AdminPartners";
import AdminSeals from "@/components/admin/AdminSeals";
import AdminMembers from "@/components/admin/AdminMembers";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import AdminTutorials from "@/components/admin/AdminTutorials";
import AdminChat from "@/components/admin/AdminChat";
import AdminBanners from "@/components/admin/AdminBanners";
import AdminCursos from "@/components/admin/AdminCursos";
import AdminTrilhas from "@/components/admin/AdminTrilhas";

export default function AdminPage() {
  return (
    <div className="animate-fade-in px-4 sm:px-6 py-6 sm:py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-sans font-bold text-foreground">Painel Admin</h1>
      </div>

      <Tabs defaultValue="wines" className="space-y-4 sm:space-y-6">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 h-auto p-1 gap-0.5">
            <TabsTrigger value="analytics" className="text-xs sm:text-sm px-3 py-2">Analytics</TabsTrigger>
            <TabsTrigger value="banners" className="text-xs sm:text-sm px-3 py-2">Banners</TabsTrigger>
            <TabsTrigger value="wines" className="text-xs sm:text-sm px-3 py-2">Vinhos</TabsTrigger>
            <TabsTrigger value="members" className="text-xs sm:text-sm px-3 py-2">Membros</TabsTrigger>
            <TabsTrigger value="partners" className="text-xs sm:text-sm px-3 py-2">Parceiros</TabsTrigger>
            <TabsTrigger value="seals" className="text-xs sm:text-sm px-3 py-2">Selos</TabsTrigger>
            <TabsTrigger value="tutorials" className="text-xs sm:text-sm px-3 py-2">Tutoriais</TabsTrigger>
            <TabsTrigger value="chat" className="text-xs sm:text-sm px-3 py-2">Jovem AI</TabsTrigger>
            <TabsTrigger value="cursos" className="text-xs sm:text-sm px-3 py-2">Cursos</TabsTrigger>
            <TabsTrigger value="trilhas" className="text-xs sm:text-sm px-3 py-2">Trilhas</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="analytics"><AdminAnalytics /></TabsContent>
        <TabsContent value="banners"><AdminBanners /></TabsContent>
        <TabsContent value="wines"><AdminWines /></TabsContent>
        <TabsContent value="members"><AdminMembers /></TabsContent>
        <TabsContent value="partners"><AdminPartners /></TabsContent>
        <TabsContent value="seals"><AdminSeals /></TabsContent>
        <TabsContent value="tutorials"><AdminTutorials /></TabsContent>
        <TabsContent value="chat"><AdminChat /></TabsContent>
        <TabsContent value="cursos"><AdminCursos /></TabsContent>
      </Tabs>
    </div>
  );
}
