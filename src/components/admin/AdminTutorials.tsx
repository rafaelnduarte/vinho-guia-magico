import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, Wine, Users, Handshake, Award, Upload, Plus } from "lucide-react";

export default function AdminTutorials() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="h-6 w-6 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Tutoriais & Documentação</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Guia completo de como usar o painel administrativo do Radar do Jovem.
      </p>

      <Accordion type="multiple" className="space-y-2">
        {/* VINHOS */}
        <AccordionItem value="wines" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-foreground font-medium">
            <span className="flex items-center gap-2"><Wine className="h-4 w-4 text-primary" /> Gerenciando Vinhos</span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-4 pb-4">
            <div>
              <h4 className="font-medium text-foreground mb-1">Adicionar vinho individual</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Acesse a aba <strong>Vinhos</strong> no painel admin.</li>
                <li>Clique em <strong>"Novo Vinho"</strong>.</li>
                <li>Preencha os campos obrigatórios (Nome é obrigatório). Os demais campos são opcionais mas recomendados.</li>
                <li>No campo <strong>"URL da Imagem"</strong>, cole o link direto da imagem do vinho.</li>
                <li>Em <strong>"Comentário do Thomas"</strong>, insira a avaliação pessoal sobre o vinho.</li>
                <li>Selecione o <strong>Status</strong>:
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    <li><strong>Curadoria</strong> — vinhos disponíveis atualmente para os membros.</li>
                    <li><strong>Acervo</strong> — vinhos históricos, safras antigas, vinhos provados em viagem ou que não estão mais disponíveis no Brasil. Ficam visíveis na aba "Acervo" da curadoria.</li>
                    <li><strong>Rascunho</strong> — não visível para os membros.</li>
                  </ul>
                </li>
                <li>Clique em <strong>"Criar"</strong>.</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-1">Importar vinhos via CSV</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Clique em <strong>"Importar CSV"</strong>.</li>
                <li>Baixe o template CSV para ver o formato esperado.</li>
                <li>Preencha a planilha com os dados dos vinhos. O campo <strong>name</strong> é obrigatório.</li>
                <li>Para definir o status no CSV, use a coluna <strong>status</strong> com valores: <code>curadoria</code>, <code>acervo</code> ou <code>rascunho</code>. Se omitido, o padrão é <strong>curadoria</strong>.</li>
                <li>Selecione o arquivo e visualize a prévia dos dados.</li>
                <li>Linhas com erros serão destacadas em vermelho.</li>
                <li>Clique em <strong>"Importar"</strong> para processar apenas as linhas válidas.</li>
                <li>Se um vinho com o mesmo nome já existir, ele será <strong>atualizado</strong> (upsert).</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-1">Vincular selos a um vinho</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Na lista de vinhos, clique no ícone de <strong>link</strong> (🔗) ao lado do vinho.</li>
                <li>Marque/desmarque os selos que se aplicam ao vinho.</li>
                <li>Os selos aparecem automaticamente na curadoria sobre a imagem do vinho.</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-1">Editar, mover e remover vinhos</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Use o ícone de <strong>lápis</strong> para editar qualquer campo.</li>
                <li>Use o ícone de <strong>lixeira</strong> para remover. <strong>Atenção:</strong> essa ação é irreversível.</li>
                <li>Para mover um vinho entre <strong>Curadoria</strong>, <strong>Acervo</strong> e <strong>Rascunho</strong>, edite o vinho e altere o campo <strong>Status</strong>. Reviews, comentários e votos são preservados.</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* MEMBROS */}
        <AccordionItem value="members" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-foreground font-medium">
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Gerenciando Membros</span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-4 pb-4">
            <div>
              <h4 className="font-medium text-foreground mb-1">Adicionar membro manualmente</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Acesse a aba <strong>Membros</strong>.</li>
                <li>Clique em <strong>"Novo Membro"</strong>.</li>
                <li>Preencha email e nome completo.</li>
                <li>Selecione o status (Ativo ou Inativo).</li>
                <li>Clique em <strong>"Criar Membro"</strong>. O sistema cria automaticamente a conta de acesso.</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-1">Importar membros via CSV</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Clique em <strong>"Importar CSV"</strong>.</li>
                <li>O CSV deve conter as colunas: <strong>email</strong> (obrigatório), <strong>full_name</strong> (obrigatório), status, source, external_id.</li>
                <li>Se o email já existir, o membro será atualizado em vez de duplicado.</li>
                <li>Uma senha temporária é gerada automaticamente para novos membros.</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-1">Visualizar detalhes de um membro</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Clique em qualquer membro na lista.</li>
                <li>Você verá: dados pessoais, data de cadastro, último acesso, status.</li>
                <li>Na seção <strong>Engajamento</strong>: quantidade de páginas vistas, votos e comentários.</li>
                <li>Na seção <strong>Atividade Recente</strong>: log das últimas ações do membro.</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-1">Editar e redefinir senha</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Na tela de detalhes, clique em <strong>"Editar"</strong> para alterar nome ou status.</li>
                <li>Clique em <strong>"Redefinir Senha"</strong> para gerar um link de recuperação.</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* PARCEIROS */}
        <AccordionItem value="partners" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-foreground font-medium">
            <span className="flex items-center gap-2"><Handshake className="h-4 w-4 text-primary" /> Gerenciando Parceiros</span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-4 pb-4">
            <div>
              <h4 className="font-medium text-foreground mb-1">Adicionar parceiro</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Acesse a aba <strong>Parceiros</strong>.</li>
                <li>Clique em <strong>"Novo Parceiro"</strong>.</li>
                <li>Preencha: Nome (obrigatório), Categoria, Desconto, Cupom, Condições, Website e Contato.</li>
                <li>O campo <strong>"Logo URL"</strong> define a imagem do parceiro. Os logos cadastrados no sistema são mapeados automaticamente pelo nome.</li>
                <li>Marque <strong>"Ativo"</strong> para exibir na página de parceiros.</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-1">Categorias de parceiro</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Importadoras</strong> — empresas que importam vinhos</li>
                <li><strong>Bares & Restaurantes</strong> — estabelecimentos físicos</li>
                <li><strong>Lojas</strong> — e-commerces e lojas físicas de vinho</li>
                <li><strong>Acessórios</strong> — produtos complementares (taças, decanters, etc.)</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SELOS */}
        <AccordionItem value="seals" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-foreground font-medium">
            <span className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Gerenciando Selos</span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-4 pb-4">
            <div>
              <h4 className="font-medium text-foreground mb-1">Sobre os selos</h4>
              <p>Os selos classificam vinhos e bebedores em perfis. Existem duas categorias:</p>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li><strong>Perfil de Vinho</strong> — ex: Batalha, Contemplativo, Pedigree, Refrescante</li>
                <li><strong>Perfil de Bebedor</strong> — ex: Clássico, Curioso, Natureba, Nerd</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-1">Criar ou editar selo</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Clique em <strong>"Novo Selo"</strong>.</li>
                <li>Preencha: Nome, Categoria (Perfil de Vinho ou Perfil de Bebedor), e Descrição.</li>
                <li>No campo <strong>"Ícone"</strong>, use a chave do ícone (ex: <code>batalha</code>, <code>curioso</code>). O sistema mapeia automaticamente para a imagem correspondente.</li>
                <li>Clique em <strong>"Criar"</strong> ou <strong>"Salvar"</strong>.</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-1">Chaves de ícone disponíveis</h4>
              <p>Use exatamente estas chaves no campo "Ícone":</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {["natureba", "curioso", "nerd", "classico", "contemplativo", "batalha", "refrescante", "pedigree"].map(k => (
                  <code key={k} className="px-2 py-0.5 bg-muted rounded text-xs">{k}</code>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ANALYTICS */}
        <AccordionItem value="analytics" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-foreground font-medium">
            <span className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Usando o Analytics</span>
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-4 pb-4">
            <div>
              <h4 className="font-medium text-foreground mb-1">Dashboard de Analytics</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>A aba <strong>Analytics</strong> mostra métricas de engajamento dos membros.</li>
                <li>Filtre por período: 7 dias, 30 dias, 90 dias, mês atual ou todos.</li>
                <li>Métricas disponíveis: total de membros, membros ativos, page views, vinhos mais curtidos, mais comentados e usuários mais ativos.</li>
                <li><strong>Nota:</strong> Ações de administradores NÃO são contabilizadas nos analytics para não poluir os dados.</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
