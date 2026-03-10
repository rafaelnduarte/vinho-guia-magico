import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, Video, RefreshCw, CheckCircle2, Clock, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PandaFolder {
  id: string;
  name: string;
  videos_count?: string | number;
  created_at?: string;
}

interface PandaVideo {
  id: string;
  title?: string;
  length?: number;
  status?: string;
  thumbnail?: string;
  video_player?: string;
  created_at?: string;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "CONVERTED") {
    return (
      <Badge className="text-xs bg-green-600/20 text-green-400 border-green-600/30">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Pronto
      </Badge>
    );
  }
  if (status === "PROCESSING") {
    return (
      <Badge className="text-xs bg-yellow-600/20 text-yellow-400 border-yellow-600/30">
        <Clock className="h-3 w-3 mr-1" /> Processando
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="text-xs">
      {status || "—"}
    </Badge>
  );
}

export default function AdminCursos() {
  const [selectedFolder, setSelectedFolder] = useState<PandaFolder | null>(null);

  const { data: folders, isLoading: foldersLoading, refetch: refetchFolders } = useQuery({
    queryKey: ["panda-folders"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/panda-proxy?resource=folders`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Erro ao buscar pastas");
      return (await res.json()) as PandaFolder[];
    },
  });

  const { data: cursos } = useQuery({
    queryKey: ["admin-cursos-sync"],
    queryFn: async () => {
      const { data } = await supabase.from("cursos").select("id, panda_folder_id");
      return data || [];
    },
  });

  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ["panda-videos", selectedFolder?.id],
    enabled: !!selectedFolder,
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/panda-proxy?resource=videos&folder_id=${selectedFolder!.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Erro ao buscar vídeos");
      return (await res.json()) as PandaVideo[];
    },
  });

  const { data: aulas } = useQuery({
    queryKey: ["admin-aulas-sync"],
    queryFn: async () => {
      const { data } = await supabase.from("aulas").select("id, panda_video_id");
      return data || [];
    },
  });

  const syncedFolderIds = new Set((cursos || []).map((c) => c.panda_folder_id).filter(Boolean));
  const syncedVideoIds = new Set((aulas || []).map((a) => a.panda_video_id).filter(Boolean));
  const folderList = Array.isArray(folders) ? folders : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">
          CURSOS {folderList.length > 0 && `(${folderList.length})`}
        </h2>
        <Button variant="outline" size="sm" onClick={() => refetchFolders()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      {foldersLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : folderList.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhuma pasta encontrada no Panda Video.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {folderList.map((folder) => {
            const isSynced = syncedFolderIds.has(folder.id);
            const count = parseInt(String(folder.videos_count ?? "0"), 10);
            return (
              <Card key={folder.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <FolderOpen className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{folder.name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="secondary" className="text-xs">
                          <Video className="h-3 w-3 mr-1" />
                          {count} vídeos
                        </Badge>
                        {isSynced ? (
                          <Badge className="text-xs bg-green-600/20 text-green-400 border-green-600/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Sincronizado
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-yellow-600/20 text-yellow-400 border-yellow-600/30">
                            <Clock className="h-3 w-3 mr-1" /> Pendente
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedFolder(folder)}
                  >
                    Ver Vídeos
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedFolder} onOpenChange={(open) => !open && setSelectedFolder(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              {selectedFolder?.name}
              {videos && (
                <Badge variant="secondary" className="ml-2">
                  {Array.isArray(videos) ? videos.length : 0} vídeos
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {videosLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !Array.isArray(videos) || videos.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum vídeo nesta pasta.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="w-24">Duração</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-28">Sync</TableHead>
                  <TableHead className="w-28">Upload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.map((video, idx) => {
                  const isSynced = syncedVideoIds.has(video.id);
                  return (
                    <TableRow key={video.id}>
                      <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{video.title || "Sem título"}</TableCell>
                      <TableCell>{video.length ? formatDuration(video.length) : "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={video.status} />
                      </TableCell>
                      <TableCell>
                        {isSynced ? (
                          <Badge className="text-xs bg-green-600/20 text-green-400 border-green-600/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Sim
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-yellow-600/20 text-yellow-400 border-yellow-600/30">
                            <Clock className="h-3 w-3 mr-1" /> Não
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(video.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
