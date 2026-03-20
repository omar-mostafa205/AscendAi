import Image from "next/image";

interface AvatarCardProps {
  image: string;
  badge: string;
  isSelected: boolean;
  title: string;
  description: string;
  width?: number;
  height?: number;
  objectFit?: "cover" | "contain" | "fill" | "scale-down";
  backgroundColor?: string;
}

export function AvatarCard({
  image,
  badge,
  isSelected,
  title,
  description,
  backgroundColor,
  width = 390,
  height = 340,
  objectFit = "cover",
}: AvatarCardProps) {
  const cardStyle = backgroundColor ? ({ backgroundColor } as const) : undefined;

  return (
    <button
      style={cardStyle}
      className={`relative rounded-2xl border-2 transition-all text-left overflow-hidden ${
        isSelected
          ? "border-primary shadow-xl shadow-primary/20"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div
        className="relative w-full overflow-hidden flex items-center justify-center"
        style={{ ...(cardStyle ?? {}), aspectRatio: `${width}/${height}` }}
      >
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
