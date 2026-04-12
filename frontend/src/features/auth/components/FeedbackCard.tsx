import React from "react";

const FeedbackCard = () => {
  return (
    <div className="relative z-10 translate-x-12">
      <div className="bg-white  rounded-lg border border-border shadow-xl p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-medium text-foreground mb-1">
              Senior Software Engineer
            </h3>
            <p className="text-sm text-muted-foreground">Technical Interview</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs text-muted-foreground mb-4">Meeting notes</p>

          <div className="space-y-5">
            {/* Opening and Introductions */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">
                Opening and Introductions
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Candidate demonstrated strong communication skills during the
                initial greeting. Provided a clear and concise background
                summary, highlighting 5+ years of experience in full-stack
                development with particular expertise in React and Node.js
                ecosystems.
              </p>
            </div>

            {/* Technical Discussion */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">
                Technical Discussion
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Showed comprehensive understanding of system design principles.
                Explained the difference between monolithic and microservices
                architectures with real-world examples. Discussed database
                optimization strategies including indexing, query optimization,
                and caching mechanisms. Demonstrated knowledge of OAuth 2.0 and
                JWT authentication flows.
              </p>
            </div>

            {/* Problem Solving */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">
                Problem Solving Approach
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Approached the coding challenge methodically. Started by
                clarifying requirements and edge cases. Developed an optimal
                solution with O(n log n) time complexity. Explained trade-offs
                between different approaches clearly.
              </p>
            </div>

            {/* Questions and Answers */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">
                Questions & Answers
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Asked insightful questions about team structure, deployment
                processes, and tech stack evolution. Showed genuine interest in
                the company's engineering culture and growth opportunities.
                Questions demonstrated forward-thinking and alignment with the
                role.
              </p>
            </div>

            {/* Closing Remarks */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">
                Closing Remarks
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Strong candidate with solid technical foundation and excellent
                communication skills. Recommended to proceed to next round.
              </p>
            </div>
          </div>
        </div>

        {/* AI Badge */}
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            <span>AI-Powered Analysis Complete</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackCard;
