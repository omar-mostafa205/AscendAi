import FeedbackCard from "@/features/auth/components/FeedbackCard";
import AuthForm from "@/features/auth/components/AuthForm";



export default function SignupPage() {
  return (
    <div className="flex min-h-screen bg-[#f5f2ef]">
      <AuthForm signType="signup"/>
      <div className="hidden lg:flex flex-1 items-center justify-center p-10">
        <div 
          className="w-full max-w-2xl h-[700px] bg-cover bg-center rounded-2xl p-12 relative overflow-hidden"
          style={{ backgroundImage: "url('/bg-1.avif')" }}
        >
          <div className="absolute inset-0 bg-black/20 rounded-2xl"></div>
          <FeedbackCard />
        </div>
      </div>
    </div>
  );
}