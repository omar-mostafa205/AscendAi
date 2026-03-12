import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateJob } from "@/features/jobs/hooks/useCreateJob";
import { jobSchema, JobFormValues } from "../components/JobModal";

export function useAddJobModal() {
  const [open, setOpen] = useState(false);
  const { mutate: createJob, isPending } = useCreateJob();

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: { title: "", company: "", jobDescription: "" },
  });

  const handleCancel = () => {
    form.reset();
    setOpen(false);
  };

  const handleSubmit = (values: JobFormValues) => {
    createJob(values, {
      onSuccess: () => {
        form.reset();
        setOpen(false);
      },
      onError: () => {
        toast.error("Failed to create job", {
          description: "Please try again.",
        });
      },
    });
  };

  return {
    open,
    setOpen,
    form,
    isPending,
    handleSubmit,
    handleCancel,
  };
}