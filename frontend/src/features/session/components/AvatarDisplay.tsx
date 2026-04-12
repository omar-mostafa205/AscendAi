import Image from "next/image";
import { Card } from "@/shared/components/ui/card";

interface AvatarDisplayProps {
  image: string;
  label: string;
  error?: string | null;
}

export function AvatarDisplay({ image, label, error }: AvatarDisplayProps) {
  return (
    <div className="flex-1 relative">
      <div className="absolute inset-0 px-8 pb-8">
        <Card className="w-full h-full bg-white border-[#e5e1dc] overflow-hidden rounded-3xl">
          <div className="w-full h-full flex items-end justify-center relative">
            <div
              className="relative w-full max-w-2xl aspect-square 
  -mb-10 
  sm:-mb-30 
  md:-mb-34 
  lg:-mb-30 
  xl:-mb-30
"
            >
              {" "}
              <Image
                src={`/${image}`}
                alt={label}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 790px) 100vw, 50vw"
                quality={100}
              />
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <div className="absolute top-4 right-12 z-20">
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl">
            Audio error: {error}
          </div>
        </div>
      )}
    </div>
  );
}
