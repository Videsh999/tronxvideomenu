"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  FileVideo,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import type { Media, MediaType } from "@/types";
import { api } from "@/lib/api";
import { canUseNextImage } from "@/lib/image-url";
import AdminModal from "@/components/admin/AdminModal";

type MediaPickerResult = {
  requestKey: string;
  media: Media[];
  error: string | null;
};

type MediaPickerProps = {
  open: boolean;
  mediaType: MediaType;
  restaurantId: string;
  onClose: () => void;
  onSelect: (media: Media) => void;
};

export default function MediaPicker({
  open,
  mediaType,
  restaurantId,
  onClose,
  onSelect,
}: MediaPickerProps) {
  const [result, setResult] = useState<MediaPickerResult | null>(null);
  const requestKey = `${restaurantId}:${mediaType}`;
  const currentResult = result?.requestKey === requestKey ? result : null;
  const media = currentResult?.media ?? [];
  const error = currentResult?.error ?? null;
  const isLoading = open && !currentResult;

  useEffect(() => {
    if (!open) return;

    let isCurrent = true;

    api
      .getMedia(restaurantId)
      .then((items) => {
        if (isCurrent) {
          setResult({
            requestKey,
            media: items.filter((item) => item.type === mediaType),
            error: null,
          });
        }
      })
      .catch((fetchError) => {
        if (isCurrent) {
          setResult({
            requestKey,
            media: [],
            error:
              fetchError instanceof Error
                ? fetchError.message
                : "Failed to load media",
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [mediaType, open, requestKey, restaurantId]);

  const title = mediaType === "IMAGE" ? "Select Image" : "Select Video";

  return (
    <AdminModal title={title} open={open} onClose={onClose}>
      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center text-sm text-neutral-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading media library…
        </div>
      ) : error ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-rose-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : media.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center text-center">
          {mediaType === "IMAGE" ? (
            <ImageIcon className="h-8 w-8 text-neutral-300" />
          ) : (
            <FileVideo className="h-8 w-8 text-neutral-300" />
          )}
          <p className="mt-3 text-sm font-semibold text-neutral-600">
            No {mediaType === "IMAGE" ? "images" : "videos"} found
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Upload media from the Media Library before selecting it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {media.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item);
                onClose();
              }}
              className="group overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition hover:border-neutral-400 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-300"
            >
              <div className="relative aspect-square bg-neutral-100">
                {mediaType === "IMAGE" ? (
                  canUseNextImage(item.url) ? (
                    <Image
                      src={item.url}
                      alt={item.publicId}
                      fill
                      sizes="(max-width: 640px) 50vw, 160px"
                      className="object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt={item.publicId}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  )
                ) : (
                  <video
                    src={item.url}
                    muted
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                )}
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase text-white">
                  {item.format ?? mediaType}
                </span>
              </div>
              <span className="block truncate px-2.5 py-2 text-xs text-neutral-500">
                Select media
              </span>
            </button>
          ))}
        </div>
      )}
    </AdminModal>
  );
}
