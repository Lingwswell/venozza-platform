export default function SiteFooter() {
  return (
    <footer className="bg-neutral-950 border-t border-neutral-800 mt-20">
      <div className="mx-auto max-w-6xl px-6 py-14 grid gap-10 md:grid-cols-3">

        <div>
          <h3 className="text-xl font-black text-orange-500">VenoZza 🍕</h3>
          <p className="mt-3 text-sm text-neutral-500">
            Pizza artesanal feita com ingredientes selecionados e entrega rápida.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold text-white mb-3">Links</h4>
          <ul className="space-y-2 text-sm text-neutral-400">
            <li><a href="#" className="hover:text-white">Home</a></li>
            <li><a href="#cardapio" className="hover:text-white">Cardápio</a></li>
            <li><a href="#" className="hover:text-white">Cupons</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold text-white mb-3">Contato</h4>
          <ul className="space-y-2 text-sm text-neutral-400">
            <li>📍 São Paulo - SP</li>
            <li>📞 (11) 99999-9999</li>
            <li>📧 contato@venozza.com</li>
          </ul>
        </div>

      </div>

      <div className="border-t border-neutral-800 py-4 text-center text-xs text-neutral-600">
        © {new Date().getFullYear()} VenoZza — Todos os direitos reservados
      </div>
    </footer>
  );
}
