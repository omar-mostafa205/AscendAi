import { UseFormReturn } from "react-hook-form";
import { Briefcase, Building2, FileText } from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { JobFormFooter } from "./JobFormFooter";
import { JobFormValues } from "./JobModal";

interface JobFormProps {
  form: UseFormReturn<JobFormValues>;
  isPending: boolean;
  onSubmit: (values: JobFormValues) => void;
  onCancel: () => void;
}

export function JobForm({ form, isPending, onSubmit, onCancel }: JobFormProps) {
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="px-6 py-5 space-y-5"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-[#1f1f1f] flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#676662]" />
                Job Title
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Senior Software Engineer"
                  className="rounded-xl border-[#b9b1ab] bg-[#faf8f6] placeholder:text-[#b9b1ab] text-[#1f1f1f]
                    focus-visible:ring-1 focus-visible:ring-[#1b1917] focus-visible:border-[#1b1917]
                    hover:border-[#8a837c] transition-colors"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs text-red-500" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="company"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-[#1f1f1f] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#676662]" />
                Company
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Google"
                  className="rounded-xl border-[#b9b1ab] bg-[#faf8f6] placeholder:text-[#b9b1ab] text-[#1f1f1f]
                    focus-visible:ring-1 focus-visible:ring-[#1b1917] focus-visible:border-[#1b1917]
                    hover:border-[#8a837c] transition-colors"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs text-red-500" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="jobDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-[#1f1f1f] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#676662]" />
                Job Description
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Paste the job description here — we'll use it to tailor your interview practice..."
                  rows={5}
                  maxLength={5000}
                  className="rounded-xl border-[#b9b1ab] bg-[#faf8f6] placeholder:text-[#b9b1ab] text-[#1f1f1f] resize-none
                    focus-visible:ring-1 focus-visible:ring-[#1b1917] focus-visible:border-[#1b1917]
                    hover:border-[#8a837c] transition-colors max-h-40"
                  {...field}
                />
              </FormControl>
              <div className="flex justify-between items-center mt-1">
                <FormMessage className="text-xs text-red-500" />
                <span className="text-xs text-[#b9b1ab] ml-auto">
                  {field.value.length} / 5000
                </span>
              </div>
            </FormItem>
          )}
        />

        <JobFormFooter isPending={isPending} onCancel={onCancel} />
      </form>
    </Form>
  );
}