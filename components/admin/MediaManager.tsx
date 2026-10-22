"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  AlertCircle,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import type { Media } from "@/types";
import { api } from "@/lib/api";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const acceptedFiles =
  "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime";

type MediaManagerProps = {
  initialMedia: Media[];
  initialError: string | null;
  restaurantId: string;
};

function formatDuration(duration?: number): string | null {
  if (duration === undefined || !Number.isFinite(duration)) return null;
  const totalSeconds = Math.max(0, Math.round(duration));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatDimensions(media: Media): string | null {
  if (media.width === undefined || media.height === undefined) return null;
  return `${media.width} × ${media.height}`;
}

export default function MediaManager({
  initialMedia,
  initialError,
  restaurantId,
}: MediaManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState(initialMedia);
  const [error, setError] = useState<string | null>(initialError);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshMedia = async () => {
    setIsRefreshing(true);
    try {
      const nextMedia = await api.getMedia(restaurantId);
      setMedia(nextMedia);
      setError(null);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to load media",
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError(null);
    setFeedback(null);

    if (!file) {
      setError("Choose an image or video file to upload.");
      return;
    }

    if (!allowedMimeTypes.has(file.type)) {
      setError("Use a JPG, PNG, WebP, MP4, WebM, or MOV file.");
      return;
    }

    setIsUploading(true);
    try {
      await api.uploadMedia(file, restaurantId);
      await refreshMedia();
      setFeedback(`${file.name} uploaded successfully.`);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (item: Media) => {
    if (
      !window.confirm(`Delete ${item.format ?? item.type.toLowerCase()} media?`)
    ) {
      return;
    }

    setDeletingId(item.id);
    setError(null);
    setFeedback(null);
    try {
      await api.deleteMedia(item.id);
      setMedia((current) =>
        current.filter((mediaItem) => mediaItem.id !== item.id),
      );
      setFeedback("Media deleted successfully.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Delete failed",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Media Library
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage restaurant images and videos used across the menu.
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-neutral-800 has-disabled:cursor-not-allowed has-disabled:opacity-50">
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span>{isUploading ? "Uploading…" : "Upload Media"}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFiles}
            onChange={handleUpload}
            disabled={isUploading}
            className="sr-only"
          />
        </label>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {feedback ? (
        <p role="status" className="text-sm text-emerald-700">
          {feedback}
        </p>
      ) : null}

      {isRefreshing && media.length === 0 ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-sm text-neutral-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading media…
        </div>
      ) : media.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white px-6 text-center">
          <ImageIcon className="h-8 w-8 text-neutral-300" />
          <p className="mt-3 text-sm font-semibold text-neutral-600">
            No media files yet
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Upload an image or video to start building the restaurant library.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item) => {
            const dimensions = formatDimensions(item);
            const duration = formatDuration(item.duration);
            const isVideo =
              item.type === "VIDEO" || item.resourceType === "video";

            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
              >
                <div className="relative aspect-video bg-neutral-100">
                  {isVideo ? (
                    <video
                      src={item.url}
                      controls
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Image
                      src={item.url}
                      alt={item.publicId}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  )}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                    {isVideo ? (
                      <FileVideo className="h-3 w-3" />
                    ) : (
                      <ImageIcon className="h-3 w-3" />
                    )}
                    {item.type}
                  </span>
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                    {item.format ? (
                      <span>{item.format.toUpperCase()}</span>
                    ) : null}
                    {dimensions ? <span>{dimensions}</span> : null}
                    {duration ? <span>{duration}</span> : null}
                  </div>
                  <p
                    className="truncate text-xs text-neutral-400"
                    title={item.publicId}
                  >
                    {item.publicId}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {deletingId === item.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
