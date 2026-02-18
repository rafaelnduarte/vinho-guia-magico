import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPartnerLogo } from "@/lib/partnerLogos";
import { ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Partner {
  id: string;
  name: string;
  category: string;
  discount: string | null;
  coupon_code: string | null;
  conditions: string | null;
  website_url: string | null;
  logo_url: string | null;
  contact_info: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  importadoras: "Importadoras",
  lojas: "Lojas de Vinho",
  produtores: "Produtores",
  restaurantes: "Restaurantes",
  acessorios: "Acessórios",
};

const CATEGORY_ORDER = ["importadoras", "lojas", "produtores", "restaurantes", "acessorios"];

export default function ParceirosPage() {
  const { data: partners, isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Partner[];
    },
  });

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = partners?.filter((p) => p.category === cat) ?? [];
    return acc;
  }, {} as Record<string, Partner[]>);

  return (
    <div className="animate-fade-in px-6 py-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-display text-foreground mb-4">
          Códigos Exclusivos Radar do Jovem
        </h1>
      </div>

      {/* Disclaimer */}
      <div className="bg-card border border-border rounded-xl p-6 md:p-8 mb-12 text-sm text-muted-foreground leading-relaxed space-y-3">
        <p>Prezado(a) assinante do Radar do Jovem,</p>
        <p>
          Gostaríamos de reforçar que os cupons de desconto disponibilizados são <strong className="text-foreground">pessoais e intransferíveis</strong>, válidos apenas para você como assinante. Todas as compras são conferidas individualmente.
        </p>
        <p>
          Lembramos também que o conteúdo criado pelo <strong className="text-foreground">@jovemdovinho</strong> é exclusivo, e seu compartilhamento é proibido conforme nossos Termos e Condições.
        </p>
        <p>Agradecemos sua compreensão em ajudar a manter este espaço exclusivo e especial.</p>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando parceiros...</div>
      ) : (
        <div className="space-y-12">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="font-display text-2xl text-foreground mb-6 pb-2 border-b border-border">
                  {CATEGORY_LABELS[cat]}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {items.map((partner) => (
                    <PartnerCard key={partner.id} partner={partner} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PartnerCard({ partner }: { partner: Partner }) {
  const [copied, setCopied] = useState(false);
  const logo = getPartnerLogo(partner.logo_url);

  const handleCopy = () => {
    if (partner.coupon_code) {
      navigator.clipboard.writeText(partner.coupon_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex gap-4 items-start">
      {/* Logo */}
      <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
        {logo ? (
          <img src={logo} alt={partner.name} className="h-full w-full object-contain p-1" />
        ) : (
          <span className="text-xs font-medium text-muted-foreground text-center leading-tight px-1">
            {partner.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <h3 className="font-sans font-semibold text-foreground text-sm">{partner.name}</h3>

        {partner.discount && (
          <p className="text-sm font-medium text-highlight">{partner.discount}</p>
        )}

        {partner.coupon_code && (
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-xs bg-muted/50 rounded-md px-2.5 py-1 font-mono text-foreground hover:bg-muted transition-colors"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {partner.coupon_code}
          </button>
        )}

        {partner.conditions && (
          <p className="text-xs text-muted-foreground">{partner.conditions}</p>
        )}

        {partner.website_url && (
          <a
            href={partner.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Acessar site
          </a>
        )}
      </div>
    </div>
  );
}
