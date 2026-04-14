import type React from 'react';
import { useRef, useState, useEffect } from 'react';

interface Props {
  videoPath: string;
  onClose: () => void;
}

export default function VideoView({ videoPath, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    videoRef.current?.play();
  }, [videoPath]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100 || 0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const pct = (clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * videoRef.current.duration;
  };

  return (
    <div className="relative h-full w-full flex flex-col">
      <div className="absolute top-2 left-2 z-10 text-gold text-xs bg-black/80 px-2 py-1 rounded">
        Video
      </div>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-10 text-gray-400 bg-black/80 px-3 py-1 rounded min-h-[44px] min-w-[44px]"
      >
        ✕
      </button>

      <div className="flex-1 flex items-center justify-center" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={`/artifacts/${videoPath}`}
          className="max-w-full max-h-full object-contain"
          loop
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-2 border-gold rounded-full flex items-center justify-center">
              <div className="w-0 h-0 border-l-[20px] border-l-gold border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="h-1 bg-gray-800 cursor-pointer mx-4 mb-3 rounded"
        onClick={handleSeek}
        onTouchStart={handleSeek}
      >
        <div
          className="h-full bg-gold rounded transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
