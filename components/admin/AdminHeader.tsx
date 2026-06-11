"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { AdminSidebar } from "./AdminSidebar";

type AdminHeaderProps = {
  userName: string;
  userRole: string;
  breadcrumb: string;
};

export function AdminHeader({
  userName,
  userRole,
  breadcrumb,
}: AdminHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 md:px-5 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-[#07366A]"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
          <div className="text-xs text-gray-500">{breadcrumb}</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#07366A] text-white flex items-center justify-center text-[11px] font-medium">
              {initials}
            </div>
            <div className="leading-tight">
              <div className="text-xs font-medium text-[#07366A]">
                {userName}
              </div>
              <div className="text-[10px] text-[#FAB82A] font-medium">
                {userRole}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="text-[#FF035C] text-xs hover:underline font-medium"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative h-full w-64 flex flex-col bg-[#07366A]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 text-white/70 hover:text-white z-10"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
            <AdminSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
