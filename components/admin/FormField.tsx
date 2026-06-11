"use client";

import type { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
};

export function FormField({
  label,
  name,
  error,
  hint,
  required,
  children,
}: FormFieldProps) {
  return (
    <div className="mb-4">
      <label
        htmlFor={name}
        className="block text-xs font-medium text-[#07366A] mb-1"
      >
        {label}
        {required && <span className="text-[#FF035C] ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-[#FF035C] mt-1">{error}</p>}
    </div>
  );
}
