import { useState, useRef, useCallback } from "react";
import AvatarCropDialog from "@/components/AvatarCropDialog";
import confetti from "canvas-confetti";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import {
  Camera,
  Loader2,
  Wine,
  Archive,
  ArrowRight,
  ChevronRight,
  GraduationCap,
  Trophy,
  Star,
} from "lucide-react";

interface OnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
  initialName: string;
  initialBio: string;
  initialAvatar: string | null;
}

const TOTAL_STEPS = 4;

export default function OnboardingDialog({
  open,
  onComplete,
  initialName,
  initialBio,
  initialAvatar,
}: OnboardingDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1 state (Profile)
  const [fullName, setFullName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatar);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo de 5MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCroppedUpload = async (blob: Blob) => {
    if (!user) return;
    setUploading(true);
    const path = `avatars/${user.id}.jpg`;
    const { error } = await supabase.storage.from("wine-images").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("wine-images").getPublicUrl(path);
    const url = data.publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    setAvatarUrl(url);
    setUploading(false);
    setCropOpen(false);
    setCropSrc(null);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    await supabase.from("profiles").update({ full_name: fullName, bio }).eq("user_id", user.id);
    setSavingProfile(false);
    setStep(2);
  };

  const fireConfetti = useCallback(() => {
    const duration = 1500;
    const end = Date.now() + duration;
    const colors = ["#1a5c6b", "#d4a574", "#f5c542", "#e8917a", "#7bc67e"];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
        zIndex: 9999,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
        zIndex: 9999,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, []);

  const handleFinish = async () => {
    if (!user) return;
    fireConfetti();
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true } as any)
      .eq("user_id", user.id);
    setTimeout(() => {
      onComplete();
      navigate("/home", { replace: true });
    }, 1200);
  };

  const initials = fullName
    ? fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md mx-auto p-0 gap-0 overflow-hidden [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pt-6 pb-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <div className="px-6 pb-6">
          {/* STEP 1 — Profile */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-2 pt-2">
                <h2 className="text-xl font-display font-semibold text-foreground">
                  Bem-vindo ao Radar! 🍷
                </h2>
                <p className="text-sm text-muted-foreground">
                  Adicione uma foto e conte um pouco sobre você.
                </p>
              </div>

              {/* Avatar */}
              <div className="flex justify-center">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? (
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    ) : (
                      <Camera className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarSelect}
                  />
                </div>
                <AvatarCropDialog
                  open={cropOpen}
                  imageSrc={cropSrc}
                  onClose={() => { setCropOpen(false); setCropSrc(null); }}
                  onConfirm={handleCroppedUpload}
                />
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="onb-name">Nome</Label>
                <Input
                  id="onb-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={100}
                  placeholder="Seu nome"
                />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="onb-bio">Bio</Label>
                <Textarea
                  id="onb-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 140))}
                  maxLength={140}
                  rows={3}
                  placeholder="Conte um pouco sobre você e sua relação com o vinho..."
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">{bio.length}/140</p>
              </div>

              <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full">
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Próximo <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {/* STEP 2 — Curadoria & Acervo */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-2 pt-2">
                <h2 className="text-xl font-display font-semibold text-foreground">
                  Curadoria & Acervo
                </h2>
                <p className="text-sm text-muted-foreground">
                  Conheça as duas seções principais do Radar.
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Wine className="h-5 w-5 text-primary" />
                    <h3 className="font-medium text-foreground">Curadoria</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Vinhos selecionados que estão <strong>disponíveis para compra no Brasil hoje</strong>. 
                    Aqui você encontra rótulos frescos, com indicação de importador, faixa de preço e 
                    onde comprar. A curadoria é atualizada frequentemente.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Archive className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-medium text-foreground">Acervo</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Vinhos que <strong>já estiveram disponíveis</strong> mas não estão mais, 
                    rótulos provados em viagens, safras antigas e vinhos não vendidos no Brasil. 
                    É o histórico completo de degustações — ótimo para referência e descoberta.
                  </p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-4">
                  Você pode acessar ambas as seções pelo menu <strong>Curadoria</strong>.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Voltar
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1">
                  Próximo <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3 — Cursos */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-2 pt-2">
                <GraduationCap className="h-10 w-10 mx-auto text-primary" />
                <h2 className="text-xl font-display font-semibold text-foreground">
                  Cursos
                </h2>
                <p className="text-sm text-muted-foreground">
                  Aprenda sobre o mundo do vinho com nossos cursos exclusivos.
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <h3 className="font-medium text-foreground">Aulas em vídeo</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Assista às aulas no seu ritmo. Os cursos cobrem desde os fundamentos 
                    até temas avançados como regiões produtoras, uvas e técnicas de degustação.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-accent" />
                    <h3 className="font-medium text-foreground">Progresso e certificação</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Acompanhe seu progresso em cada curso. Ao concluir 100% de um curso, 
                    você ganha pontos no <strong>Ranking</strong>!
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Voltar
                </Button>
                <Button onClick={() => setStep(4)} className="flex-1">
                  Próximo <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4 — Ranking */}
          {step === 4 && (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-2 pt-2">
                <Trophy className="h-10 w-10 mx-auto text-accent" />
                <h2 className="text-xl font-display font-semibold text-foreground">
                  Ranking & Prêmios
                </h2>
                <p className="text-sm text-muted-foreground">
                  Suas atividades no app rendem pontos e prêmios!
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-2">
                  <h3 className="font-medium text-foreground text-sm">Como ganhar pontos:</h3>
                  <ul className="text-xs text-muted-foreground space-y-1.5 pl-1">
                    <li className="flex items-center gap-2">
                      <Wine className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span><strong>Votar</strong> nos vinhos da curadoria</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Wine className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span><strong>Comentar</strong> nos vinhos</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span><strong>Concluir cursos</strong> (100%)</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-accent" />
                    <h3 className="font-medium text-foreground">Prêmios</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Os membros mais ativos no Ranking são reconhecidos e podem ganhar 
                    prêmios exclusivos, como garrafas especiais, acesso VIP a degustações 
                    e muito mais. Quanto mais você participa, mais chances tem!
                  </p>
                </div>
              </div>

              <Button onClick={handleFinish} className="w-full">
                Ir para a Home <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
