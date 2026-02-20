import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSealIcon } from "@/lib/sealIcons";

interface Seal {
  id: string;
  name: string;
  category: string;
  description: string | null;
  icon: string | null;
}

export default function SelosPage() {
  const { data: seals, isLoading } = useQuery({
    queryKey: ["seals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seals")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Seal[];
    },
  });

  const clienteSeals = seals?.filter((s) => s.category === "perfil_cliente") ?? [];
  const vinhoSeals = seals?.filter((s) => s.category === "perfil_vinho") ?? [];

  return (
    <div className="animate-fade-in px-4 sm:px-6 py-6 sm:py-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-display text-foreground mb-4">
          Entenda nossos selos!
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Os selos são a nossa forma de personalizar o Radar do Jovem para você!
        </p>
      </div>

      {/* Intro text */}
      <div className="bg-card border border-border rounded-xl p-6 md:p-8 mb-12 space-y-4 text-sm md:text-base text-muted-foreground leading-relaxed">
        <p>
          Para deixar nossas sugestões ainda mais precisas, criamos alguns selos que categorizam visualmente o seu estilo nas compras e o perfil de cada vinho! Assim, nosso Radar fica mais completo e você, mais seguro na hora da escolha.
        </p>
        <p>
          Na aba <strong className="text-foreground">Curadoria Completa</strong>, é possível aplicar um filtro para cada um dos selos.
        </p>
        <p>
          Essa evolução é resultado do nosso compromisso contínuo em ouvir com atenção e oferecer sempre o melhor para a sua jornada.
        </p>
        <p className="font-medium text-foreground">
          Confira abaixo a legenda de cada um deles:
        </p>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando selos...</div>
      ) : (
        <div className="space-y-14">
          {/* Perfil do Cliente */}
          <section>
            <h2 className="font-display text-2xl text-foreground mb-6 pb-2 border-b border-border">
              Perfil do Cliente
            </h2>
            <div className="space-y-6">
              {clienteSeals.map((seal) => (
                <SealRow key={seal.id} seal={seal} />
              ))}
            </div>
          </section>

          {/* Perfil do Vinho */}
          <section>
            <h2 className="font-display text-2xl text-foreground mb-6 pb-2 border-b border-border">
              Perfil do Vinho
            </h2>
            <div className="space-y-6">
              {vinhoSeals.map((seal) => (
                <SealRow key={seal.id} seal={seal} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SealRow({ seal }: { seal: Seal }) {
  const iconSrc = getSealIcon(seal.icon);

  return (
    <div className="flex items-start gap-4 md:gap-6 p-4 rounded-xl bg-card border border-border/50 hover:border-border transition-colors">
      {iconSrc ? (
        <img
          src={iconSrc}
          alt={seal.name}
          className="h-16 w-16 md:h-20 md:w-20 flex-shrink-0 object-contain"
        />
      ) : (
        <div className="h-16 w-16 md:h-20 md:w-20 flex-shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs">
          {seal.name[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-display text-lg text-foreground mb-1">{seal.name}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{seal.description}</p>
      </div>
    </div>
  );
}
