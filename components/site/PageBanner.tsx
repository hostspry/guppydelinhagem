import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
};

export default function PageBanner({ title, subtitle }: Props) {
  return (
    <div className="relative h-[220px] bg-secondary overflow-hidden flex flex-col items-center justify-center text-center px-6">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-10 space-y-2">
        <h2 className="text-white font-bold">{title}</h2>
        {subtitle && (
          <p className="text-white/90 font-light text-base max-w-xl">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
