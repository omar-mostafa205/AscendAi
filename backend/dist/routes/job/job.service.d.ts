interface CreateJobInput {
    userId: string;
    title: string;
    company: string;
    jobDescription: string;
}
declare const _default: {
    getJobs: (userId: string) => Promise<{
        id: string;
        createdAt: Date;
        title: string;
        company: string;
        jobDescription: string;
    }[]>;
    getJobById: (jobId: string, userId: string) => Promise<{
        id: string;
        createdAt: Date;
        title: string;
        company: string;
        jobDescription: string;
    }>;
    createJob: ({ userId, title, company, jobDescription }: CreateJobInput) => Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        company: string;
        jobDescription: string;
    }>;
};
export default _default;
