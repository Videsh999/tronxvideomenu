import Image from "next/image";
import { canUseNextImage } from "@/lib/image-url";

type SmartImageProps = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
};

export default function SmartImage({ src, alt, sizes, className = "", priority = false }: SmartImageProps) {
  if (canUseNextImage(src)) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} className={`absolute inset-0 h-full w-full ${className}`} />
  );
}
