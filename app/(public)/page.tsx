export default function HomePage() {
  return (
    <main className="container-site py-16 space-y-12">
      {/* Tipografia */}
      <section className="space-y-4">
        <h1>Guppy de Linhagem</h1>
        <h2>Teste de Tipografia</h2>
        <h3>Subtítulo em Signika 500</h3>
        <p className="max-w-xl">
          Peixes selecionados, saudáveis e com genética apurada para aquaristas
          exigentes. Transforme seu aquário com beleza, qualidade e vitalidade.
          Envio seguro para todo o Brasil.
        </p>
      </section>

      {/* Botões */}
      <section className="space-y-4">
        <h3>Botões</h3>
        <div className="flex flex-wrap gap-4">
          <a href="#" className="btn-primary">
            Ver Loja
          </a>
          <a href="#" className="btn-outline">
            Saiba Mais
          </a>
        </div>
      </section>

      {/* Paleta de cores */}
      <section className="space-y-4">
        <h3>Paleta de Cores</h3>
        <div className="flex flex-wrap gap-3">
          <div className="w-24 h-24 rounded-lg bg-primary flex items-end p-2">
            <span className="text-xs text-white font-medium">Primary</span>
          </div>
          <div className="w-24 h-24 rounded-lg bg-secondary flex items-end p-2">
            <span className="text-xs text-white font-medium">Secondary</span>
          </div>
          <div className="w-24 h-24 rounded-lg bg-accent flex items-end p-2">
            <span className="text-xs text-[#302f2f] font-medium">Accent</span>
          </div>
          <div className="w-24 h-24 rounded-lg bg-bg-alt border border-border flex items-end p-2">
            <span className="text-xs text-text font-medium">BG Alt</span>
          </div>
          <div className="w-24 h-24 rounded-lg bg-muted flex items-end p-2">
            <span className="text-xs text-muted-foreground font-medium">Muted</span>
          </div>
        </div>
      </section>

      {/* Card */}
      <section className="space-y-4">
        <h3>Card Padrão</h3>
        <div className="card max-w-sm p-6 space-y-3">
          <h4 className="text-primary">Guppy Full Black</h4>
          <p>
            Campeão mundial World Guppy Contest 2023 e 2024. Linhagem
            exclusiva Marchezi Guppy Farm.
          </p>
          <div className="flex items-center justify-between pt-2">
            <span className="text-2xl font-semibold text-primary">R$ 250,00</span>
            <a href="#" className="btn-primary" style={{ padding: "10px 20px", fontSize: "0.875rem" }}>
              Comprar
            </a>
          </div>
        </div>
      </section>

      {/* Fontes por peso */}
      <section className="space-y-2">
        <h3>Pesos da Signika</h3>
        <p className="font-light text-lg">300 — Light: Guppy de Linhagem</p>
        <p className="font-normal text-lg">400 — Regular: Guppy de Linhagem</p>
        <p className="font-medium text-lg">500 — Medium: Guppy de Linhagem</p>
        <p className="font-semibold text-lg">600 — SemiBold: Guppy de Linhagem</p>
        <p className="font-bold text-lg">700 — Bold: Guppy de Linhagem</p>
      </section>
    </main>
  );
}
