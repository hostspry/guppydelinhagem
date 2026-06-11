import Link from "next/link";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumb?: { label: string; href?: string }[];
  action?: ReactNode;
};

export function PageHeader({
  title,
  description,
  breadcrumb,
  action,
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="text-xs text-gray-500 mb-1.5">
          {breadcrumb.map((b, i) => (
            <span key={i}>
              {b.href ? (
                <Link href={b.href} className="hover:text-[#FF035C]">
                  {b.label}
                </Link>
              ) : (
                b.label
              )}
              {i < breadcrumb.length - 1 && " / "}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-[#07366A]">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
