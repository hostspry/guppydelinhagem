import { exigirPermissaoNaPagina } from "@/lib/permissoes-server";

export default async function AuditoriaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirPermissaoNaPagina("auditoria.ver");
  return <>{children}</>;
}
