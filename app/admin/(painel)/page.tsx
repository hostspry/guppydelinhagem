import { auth } from "@/lib/auth";

export default async function AdminDashboard() {
  const session = await auth();

  return (
    <div>
      <h2 className="text-2xl font-semibold text-[#07366A] mb-4">
        Bem-vindo, {session?.user.name}
      </h2>
      <p className="text-gray-600 mb-8">
        Painel administrativo do Guppy de Linhagem.
      </p>
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500">
          Em desenvolvimento. Próximas fases trarão:
        </p>
        <ul className="mt-3 space-y-1 text-sm list-disc list-inside text-gray-700">
          <li>Layout completo com sidebar (Fase 1)</li>
          <li>Gestão de categorias (Fase 2)</li>
          <li>Gestão de produtos (Fase 3)</li>
          <li>Migração do site pra ler do banco (Fase 4)</li>
          <li>Hero, pedidos, clientes, configurações (Fases 5-8)</li>
        </ul>
      </div>
    </div>
  );
}
