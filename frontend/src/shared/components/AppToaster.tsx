"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group flex items-start gap-3 rounded-2xl px-4 py-3.5 shadow-md text-sm font-medium",

          success:
            "bg-[#f2f7f4] text-[#1f1f1f] border border-[#a8c9b5]",

          error:
            "bg-[#fdf3f2] text-[#1f1f1f] border border-[#e2a89f]",

          info:
            "bg-white text-[#1f1f1f] border border-[#b9b1ab]",

          default:
            "bg-white text-[#1f1f1f] border border-[#b9b1ab]",

          warning:
            "bg-[#fdf8ee] text-[#1f1f1f] border border-[#d9c38a]",

          title: "text-[#1f1f1f] font-semibold text-sm",
          description: "text-[#676662] text-xs mt-0.5",
          closeButton:
            "text-[#676662] hover:text-[#1f1f1f] transition-colors",
          icon: "mt-0.5",
          actionButton:
            "bg-[#1b1917] text-white text-xs rounded-lg px-3 py-1.5 hover:bg-neutral-800 transition-colors",
          cancelButton:
            "bg-[#f0ebe6] text-[#676662] text-xs rounded-lg px-3 py-1.5 hover:bg-[#e8e1da] transition-colors",
        },
        style: {
          fontFamily: "inherit",
        },
      }}
    />
  );
}