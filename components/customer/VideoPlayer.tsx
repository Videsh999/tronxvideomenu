"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";

/**
 * Every visible card video plays at the same time. While a priority player (the
 * dish detail) is open, the cards behind it pause and resume when it closes.
 */
type Candidate = {
  visible: boolean;
  priority: boolean;
  setActive: (active: boolean) => void;
};

const candidates = new Map<symbol, Candidate>();

function syncPlayers() {
  const detailOpen = [...candidates.values()].some((candidate) => candidate.priority && candidate.visible);
  candidates.forEach((candidate) => candidate.setActive(candidate.visible && (candidate.priority || !detailOpen)));
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
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const hasError = errorUrl === videoUrl;

  const destroyHls = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
  }, []);

  const setPlayerActive = useCallback((active: boolean) => {
    const wasActive = activeRef.current;
    activeRef.current = active;
    const video = videoRef.current;
    if (!active) video?.pause();
    // Each time a video comes back into play it starts again from the beginning.
    else if (!wasActive && video && video.currentTime > 0) video.currentTime = 0;
    setIsActive((current) => (current === active ? current : active));
  }, []);

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

  // Register once; later effects only update this player's state in place so
  // playing videos are not interrupted while the page scrolls.
  useEffect(() => {
    const playerId = idRef.current;
    candidates.set(playerId, { visible: false, priority: false, setActive: setPlayerActive });
    return () => {
      candidates.delete(playerId);
      syncPlayers();
    };
  }, [setPlayerActive]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setViewportRatio(entry.isIntersecting ? entry.intersectionRatio : 0),
      { threshold: [0, 0.3, 0.6, 0.9, 1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const candidate = candidates.get(idRef.current);
    if (!candidate) return;
    candidate.priority = playbackPriority;
    candidate.visible = !hasError && (playbackPriority || viewportRatio >= 0.3);
    syncPlayers();
  }, [hasError, playbackPriority, viewportRatio]);

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
