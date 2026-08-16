import { exigirPermissaoNaPagina } from "@/lib/permissoes-server";

export default async function VisitantesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirPermissaoNaPagina("auditoria.ver");
  return <>{children}</>;
}
