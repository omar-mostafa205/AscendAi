import Image from "next/image";
import { CheckCircle } from "lucide-react";

interface AvatarCardProps {
  image: string;
  badge: string;
  isSelected: boolean;
  title: string;
  description: string;
  width?: number;
  height?: number;
  objectFit?: "cover" | "contain" | "fill" | "scale-down";
}

export function AvatarCard({
  image,
  badge,
  isSelected,
  title,
  description,
  width = 400,
  height = 320,
  objectFit = "cover",
}: AvatarCardProps) {
  return (
    <button
      className={`relative bg-white/90 rounded-2xl border-2 transition-all text-left overflow-hidden ${
        isSelected
          ? "border-primary shadow-xl shadow-primary/20"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="relative w-full bg-white overflow-hidden flex items-center justify-center" style={{ aspectRatio: `${width}/${height}` }}>
        <Image
          src={`/${image}`}
          alt={badge}
          width={width}
          height={height}
          className="w-full h-full"
          style={{ objectFit }}
          priority
        />
      </div>

      <div className="p-4 bg-background">
        <h3 className="font-semibold text-sm text-foreground">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {description}
        </p>
      </div>
    </button>
  );
}