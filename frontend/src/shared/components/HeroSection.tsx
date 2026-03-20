"use client"
import { ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";

export default function HeroSection() {
  return (
    <div className="min-h-screen bg-[#f5f2ef] text-[#1f1f1f]">
      
      <nav className="w-full flex justify-center pt-6">
      <div className="w-[92%] max-w-6xl flex items-center justify-between px-6 py-4 bg-[#fdfaf9] rounded-2xl border border-[#e5e0db]">

          <div className="flex items-center gap-2 font-medium">
            <span className="text-2xl font-medium font-serif ">AscendAI</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-md text-[#676662]">
            <a className="hover:text-black cursor-pointer">How It Works            </a>
            <a className="hover:text-black cursor-pointer">Stories</a>
            <a className="hover:text-black cursor-pointer">We're Hiring</a>
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <button onClick={()=> redirect("/login")}
            className="px-4 py-1.5 text-md rounded-md border border-[#e5e1dc] bg-[#fdfdfd] hover:bg-gray-50 cursor-pointer">
              Login
            </button>

            <button className="px-4 py-1.5 text-md rounded-md bg-[#1b1917] text-white hover:bg-neutral-800">
              Sign Up
            </button>
          </div>
        </div>
      </nav>

      <section className="flex flex-col items-center text-center mt-32 px-4">

        {/* Headline */}
        <h1 className="text-6xl md:text-7xl font-serif leading-[1.1] max-w-4xl">
          Practice Interviews.
          <br />
          <span className="text-[#1a1a18]">Get Feedback. Improve.</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-[#6b6b6b] text-lg">
        Talk to an AI interviewer. Get scored. Land the job.
        </p>

        {/* Avatars */}
        <div className="flex items-center mt-8">
          <img
            src="https://i.pravatar.cc/40?img=1"
            className="w-8 h-8 rounded-full border-2 border-white"
          />
          <img
            src="https://i.pravatar.cc/40?img=7"
            className="w-8 h-8 rounded-full border-2 border-white -ml-2"
          />
          <img
            src="https://i.pravatar.cc/40?img=3"
            className="w-8 h-8 rounded-full border-2 border-white -ml-2"
          />
          <img
            src="https://i.pravatar.cc/40?img=4"
            className="w-8 h-8 rounded-full border-2 border-white -ml-2"
          />
        </div>

        {/* Stars */}
        <div className="flex mt-3 text-yellow-500 text-lg">
          ★★★★★
        </div>

        <p className="text-sm text-[#6b6b6b] mt-1">
          Trusted by 180K+ users
        </p>

        {/* CTA */}
        <button 
        onClick={() => redirect("/jobs")}
        className="mt-8 flex items-center gap-2 px-6 py-3 rounded-lg bg-[#1f1f1f] text-white text-sm hover:bg-neutral-800 shadow-sm">
        Start Mock Interview 
          <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}