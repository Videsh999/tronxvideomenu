"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";

type Candidate = {
  ratio: number;
  priority: number;
  setActive: (active: boolean) => void;
};

const candidates = new Map<symbol, Candidate>();
let activePlayer: symbol | null = null;

function chooseActivePlayer() {
  const next = [...candidates.entries()]
    .filter(([, candidate]) => candidate.ratio > 0)
    .sort(
      ([, left], [, right]) =>
        right.priority - left.priority || right.ratio - left.ratio,
    )[0]?.[0] ?? null;

  if (activePlayer === next) return;
  activePlayer = next;
  candidates.forEach((candidate, id) => candidate.setActive(id === next));
}

function isHlsSource(url: string) {
  return (
    /\.m3u8(?:$|[?#])/i.test(url) ||
    /(?:^|[/?])f_m3u8(?:[,/?]|$)/i.test(url) ||
    /[?&](?:format|f)=m3u8(?:&|$)/i.test(url) ||
    /\/hls\//i.test(url)
  );
}

type VideoPlayerProps = {
  videoUrl: string;
  posterUrl?: string;
  title?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
  playbackPriority?: boolean;
  hovered?: boolean;
  className?: string;
};

function VideoPlayer({
  videoUrl,
  posterUrl,
  title,
  autoPlay = true,
  muted = true,
  controls = false,
  loop = true,
  playbackPriority = false,
  hovered = false,
  className = "",
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const idRef = useRef(Symbol("customer-video"));
  const hlsRef = useRef<HlsType | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const activeRef = useRef(false);
  const [isActive, setIsActive] = useState(false);
  const [viewportRatio, setViewportRatio] = useState(0);
  const [hasFinePointer, setHasFinePointer] = useState(false);
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const hasError = errorUrl === videoUrl;

  const destroyHls = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
  }, []);

  const setPlayerActive = useCallback((active: boolean) => {
    activeRef.current = active;
    if (!active) videoRef.current?.pause();
    setIsActive((current) => (current === active ? current : active));
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHasFinePointer(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setViewportRatio(entry.isIntersecting ? entry.intersectionRatio : 0),
      { threshold: [0, 0.1, 0.35, 0.6, 1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const eligibleRatio = playbackPriority
      ? Math.max(viewportRatio, 1)
      : hasFinePointer
        ? (hovered ? 1 : 0)
        : (viewportRatio >= 0.35 ? viewportRatio : 0);

    const playerId = idRef.current;
    candidates.set(playerId, {
      ratio: eligibleRatio,
      priority: playbackPriority ? 1 : 0,
      setActive: setPlayerActive,
    });
    chooseActivePlayer();

    return () => {
      candidates.delete(playerId);
      chooseActivePlayer();
    };
  }, [hasFinePointer, hovered, playbackPriority, setPlayerActive, viewportRatio]);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video || !activeRef.current || !autoPlay || sourceUrlRef.current !== videoUrl) return;
    void video.play().catch((error: unknown) => {
      if (!activeRef.current || sourceUrlRef.current !== videoUrl) return;
      const blockedAutoplay = error instanceof DOMException && error.name === "NotAllowedError";
      // On cards, reveal the image fallback. The detail modal has native controls
      // so the customer can start playback with a direct gesture.
      if (!blockedAutoplay || !controls) setErrorUrl(videoUrl);
    });
  }, [autoPlay, controls, videoUrl]);

  const loadVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !activeRef.current || !videoUrl) return;
    if (video.getAttribute("src") === videoUrl || hlsRef.current) {
      play();
      return;
    }

    const isHls = isHlsSource(videoUrl);
    try {
      if (
        isHls &&
        (video.canPlayType("application/vnd.apple.mpegurl") ||
          video.canPlayType("application/x-mpegURL"))
      ) {
        video.src = videoUrl;
        play();
        return;
      }

      if (isHls) {
        const Hls = (await import("hls.js")).default;
        if (!activeRef.current || sourceUrlRef.current !== videoUrl) return;
        if (!Hls.isSupported()) {
          setErrorUrl(videoUrl);
          return;
        }
        const hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, play);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal || sourceUrlRef.current !== videoUrl) return;
          destroyHls();
          setErrorUrl(videoUrl);
        });
        return;
      }

      video.src = videoUrl;
      play();
    } catch {
      setErrorUrl(videoUrl);
    }
  }, [destroyHls, play, videoUrl]);

  useEffect(() => {
    destroyHls();
    sourceUrlRef.current = videoUrl;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    return () => {
      if (sourceUrlRef.current === videoUrl) sourceUrlRef.current = null;
      destroyHls();
    };
  }, [destroyHls, videoUrl]);

  useEffect(() => {
    if (!isActive || hasError) {
      videoRef.current?.pause();
      hlsRef.current?.stopLoad();
      return;
    }
    hlsRef.current?.startLoad();
    const frame = window.requestAnimationFrame(() => void loadVideo());
    return () => window.cancelAnimationFrame(frame);
  }, [hasError, isActive, loadVideo]);

  useEffect(
    () => () => {
      candidates.delete(idRef.current);
      chooseActivePlayer();
      destroyHls();
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    },
    [destroyHls],
  );

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden ${hasError ? "invisible" : ""} ${className}`}
    >
      <video
        ref={videoRef}
        poster={isActive ? posterUrl : undefined}
        autoPlay={autoPlay && isActive}
        muted={muted}
        loop={loop}
        playsInline
        controls={controls}
        preload="none"
        aria-label={title ? `${title} video preview` : "Dish video preview"}
        className="h-full w-full object-contain"
        onCanPlay={play}
        onError={() => {
          if (sourceUrlRef.current === videoUrl) setErrorUrl(videoUrl);
        }}
      />
    </div>
  );
}

export default memo(VideoPlayer);
