"use client";

import { Plus, Briefcase } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import * as z from "zod";
import { JobForm } from "./JobForm";
import { useAddJobModal } from "../hooks/useAddJobModal";

export const jobSchema = z.object({
  title: z
    .string()
    .min(2, "Job title must be at least 2 characters")
    .max(100, "Job title must be under 100 characters"),
  company: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name must be under 100 characters"),
  jobDescription: z
    .string()
    .min(50, "Please provide at least 50 characters")
    .max(5000, "Job description must be under 5000 characters"),
});

export type JobFormValues = z.infer<typeof jobSchema>;

interface AddJobModalProps {
  trigger?: React.ReactNode;
}

export function AddJobModal({ trigger }: AddJobModalProps) {
  const { open, setOpen, form, isPending, handleSubmit, handleCancel } =
    useAddJobModal();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            size="lg"
            className="gap-2 bg-[#1b1917] hover:bg-neutral-800 text-white rounded-xl"
          >
            <Plus size={18} />
            Add New Job
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[520px] p-0 overflow-hidden rounded-2xl bg-white"
        style={{ border: "1px solid #b9b1ab" }}
>
        <DialogHeader
          className="px-6 pt-6 pb-4"
          style={{ borderBottom: "1px solid #e8e3de" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#f0ebe6] rounded-xl flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-[#1b1917]" />
            </div>
            <div>
              <DialogTitle className="text-xl font-serif text-[#1f1f1f]">
                Add New Job
              </DialogTitle>
              <p className="text-sm text-[#676662] mt-0.5">
                Set up a position to start practicing
              </p>
            </div>
          </div>
        </DialogHeader>

        <JobForm
          form={form}
          isPending={isPending}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
