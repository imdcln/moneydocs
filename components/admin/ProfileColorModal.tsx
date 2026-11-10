"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Check,
  Palette,
  Sparkles,
  Camera,
  ImagePlus,
  Trash2,
  Loader2,
  ShieldCheck,
  RefreshCw,
  User,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Crop,
  ArrowLeft,
  Sliders,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export interface ProfileColorPreset {
  id: string;
  name: string;
  gradient: string;
  glow: string;
  previewBg: string;
  description: string;
  accentColor: string;
}

// Exactly 10 presets (even number)
export const PROFILE_COLOR_PRESETS: ProfileColorPreset[] = [
  {
    id: "neon-rose",
    name: "Neon Rose",
    gradient: "from-pink-500 to-rose-400",
    glow: "rgba(244, 63, 94, 0.45)",
    previewBg: "linear-gradient(135deg, #ec4899, #fb7185)",
    description: "Vibrant pink & rose glow",
    accentColor: "#fb7185",
  },
  {
    id: "emerald-glow",
    name: "Emerald Glow",
    gradient: "from-emerald-500 to-teal-400",
    glow: "rgba(16, 185, 129, 0.45)",
    previewBg: "linear-gradient(135deg, #10b981, #2dd4bf)",
    description: "Fresh neon green & turquoise",
    accentColor: "#34d399",
  },
  {
    id: "cyber-cyan",
    name: "Cyber Cyan",
    gradient: "from-cyan-500 to-blue-500",
    glow: "rgba(6, 182, 212, 0.45)",
    previewBg: "linear-gradient(135deg, #06b6d4, #3b82f6)",
    description: "Futuristic tech cyan & electric blue",
    accentColor: "#38bdf8",
  },
  {
    id: "violet-dream",
    name: "Violet Dream",
    gradient: "from-purple-500 to-indigo-500",
    glow: "rgba(168, 85, 247, 0.45)",
    previewBg: "linear-gradient(135deg, #a855f7, #6366f1)",
    description: "Deep mystical purple & royal indigo",
    accentColor: "#c084fc",
  },
  {
    id: "electric-amber",
    name: "Electric Amber",
    gradient: "from-amber-400 to-orange-500",
    glow: "rgba(245, 158, 11, 0.45)",
    previewBg: "linear-gradient(135deg, #fbbf24, #f97316)",
    description: "Warm golden flame & bright amber",
    accentColor: "#fbbf24",
  },
  {
    id: "sunset-crimson",
    name: "Sunset Crimson",
    gradient: "from-rose-600 to-red-500",
    glow: "rgba(225, 29, 72, 0.45)",
    previewBg: "linear-gradient(135deg, #e11d48, #ef4444)",
    description: "Passionate crimson & fiery red",
    accentColor: "#f87171",
  },
  {
    id: "deep-amethyst",
    name: "Deep Amethyst",
    gradient: "from-fuchsia-600 to-purple-600",
    glow: "rgba(192, 38, 211, 0.45)",
    previewBg: "linear-gradient(135deg, #c026d3, #9333ea)",
    description: "Luminous fuchsia & royal amethyst",
    accentColor: "#e879f9",
  },
  {
    id: "ocean-indigo",
    name: "Ocean Indigo",
    gradient: "from-blue-600 to-indigo-600",
    glow: "rgba(37, 99, 235, 0.45)",
    previewBg: "linear-gradient(135deg, #2563eb, #4f46e5)",
    description: "Deep oceanic blue & rich indigo",
    accentColor: "#60a5fa",
  },
  {
    id: "solar-gold",
    name: "Solar Gold",
    gradient: "from-yellow-400 to-amber-500",
    glow: "rgba(250, 204, 21, 0.45)",
    previewBg: "linear-gradient(135deg, #facc15, #f59e0b)",
    description: "Brilliant solar rays & yellow gold",
    accentColor: "#facc15",
  },
  {
    id: "stealth-slate",
    name: "Stealth Slate",
    gradient: "from-slate-600 to-slate-800",
    glow: "rgba(148, 163, 184, 0.3)",
    previewBg: "linear-gradient(135deg, #475569, #1e293b)",
    description: "Minimalist graphite & slate shadow",
    accentColor: "#94a3b8",
  },
];

export function getProfilePresetByGradient(gradientStr?: string): ProfileColorPreset {
  if (!gradientStr) return PROFILE_COLOR_PRESETS[0];
  // Backward compatibility fallback for removed mint-fresh preset
  if (gradientStr === "from-teal-400 to-emerald-400" || gradientStr === "mint-fresh") {
    return PROFILE_COLOR_PRESETS.find((p) => p.id === "emerald-glow") || PROFILE_COLOR_PRESETS[0];
  }
  const found = PROFILE_COLOR_PRESETS.find(
    (p) => p.gradient === gradientStr || p.id === gradientStr
  );
  return found || PROFILE_COLOR_PRESETS[0];
}

interface ProfileColorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  currentImage?: string | null;
  userName?: string;
  onColorChange: (newColorGradient: string) => void;
  onImageChange?: (newImage: string | null) => void;
}

const CROP_VIEWPORT_SIZE = 260; // Size of crop viewport in px

export default function ProfileColorModal({
  isOpen,
  onClose,
  currentColor,
  currentImage = null,
  userName = "Declane",
  onColorChange,
  onImageChange,
}: ProfileColorModalProps) {
  const { toast } = useToast();
  const [savingColor, setSavingColor] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [selectedGradient, setSelectedGradient] = useState<string>(currentColor);
  const [selectedImage, setSelectedImage] = useState<string | null>(currentImage);

  // Live camera stream state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Hidden inputs for file selection & fallback camera capture
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // ── Crop & Resize State ──────────────────────────────────────────────
  const [cropTargetImage, setCropTargetImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const cropImageRef = useRef<HTMLImageElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initPanX: number;
    initPanY: number;
  } | null>(null);

  useEffect(() => {
    setSelectedGradient(currentColor);
  }, [currentColor]);

  useEffect(() => {
    setSelectedImage(currentImage);
  }, [currentImage]);

  // Cleanup camera stream and crop state when closing
  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      setCropTargetImage(null);
    }
  }, [isOpen]);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // ── Pan Boundary Clamping ──────────────────────────────────────────
  // Ensures the image always covers the entire crop viewport (no black bars/empty space)
  const getClampedPan = useCallback(
    (
      panX: number,
      panY: number,
      currentZoom: number = zoom,
      currentRotation: number = rotation
    ) => {
      const width = imgNaturalSize.width || CROP_VIEWPORT_SIZE;
      const height = imgNaturalSize.height || CROP_VIEWPORT_SIZE;

      const isSideways = currentRotation === 90 || currentRotation === 270;
      const effectiveW = isSideways ? height : width;
      const effectiveH = isSideways ? width : height;

      const baseScale = Math.max(
        CROP_VIEWPORT_SIZE / effectiveW,
        CROP_VIEWPORT_SIZE / effectiveH
      );

      const previewW = width * baseScale;
      const previewH = height * baseScale;

      // Visual dimensions after rotation & scale
      const visualW = (isSideways ? previewH : previewW) * currentZoom;
      const visualH = (isSideways ? previewW : previewH) * currentZoom;

      const maxPanX = Math.max(0, (visualW - CROP_VIEWPORT_SIZE) / 2);
      const maxPanY = Math.max(0, (visualH - CROP_VIEWPORT_SIZE) / 2);

      return {
        x: Math.min(maxPanX, Math.max(-maxPanX, panX)),
        y: Math.min(maxPanY, Math.max(-maxPanY, panY)),
      };
    },
    [imgNaturalSize, zoom, rotation]
  );

  // Keep pan strictly within bounds whenever zoom, rotation, or natural size updates
  useEffect(() => {
    if (cropTargetImage) {
      setPan((prev) => {
        const clamped = getClampedPan(prev.x, prev.y, zoom, rotation);
        if (clamped.x === prev.x && clamped.y === prev.y) return prev;
        return clamped;
      });
    }
  }, [cropTargetImage, zoom, rotation, imgNaturalSize, getClampedPan]);

  if (!isOpen) return null;

  const activePreset = getProfilePresetByGradient(selectedGradient);
  const firstInitial = (userName?.[0] || "D").toUpperCase();

  // Save selected color preset
  const handleSelectPreset = async (preset: ProfileColorPreset) => {
    setSelectedGradient(preset.gradient);
    setSavingColor(true);
    try {
      const res = await fetch("/api/finance/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileColor: preset.gradient }),
      });
      if (res.ok) {
        onColorChange(preset.gradient);
        if (typeof window !== "undefined") {
          localStorage.setItem("dclne_profile_color", preset.gradient);
          window.dispatchEvent(
            new CustomEvent("profile-color-changed", { detail: preset.gradient })
          );
        }
        toast(`Profile color updated to ${preset.name}`, "success");
      } else {
        toast("Failed to update profile color", "error");
      }
    } catch {
      toast("Error updating profile color", "error");
    } finally {
      setSavingColor(false);
    }
  };

  // Upload sanitized image payload
  const uploadProfileImage = async (dataUrl: string | null) => {
    setSavingImage(true);
    try {
      const res = await fetch("/api/finance/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update profile picture.");
      }

      setSelectedImage(dataUrl);
      if (onImageChange) {
        onImageChange(dataUrl);
      }

      if (typeof window !== "undefined") {
        if (dataUrl) {
          localStorage.setItem("dclne_profile_image", dataUrl);
        } else {
          localStorage.removeItem("dclne_profile_image");
        }
        window.dispatchEvent(
          new CustomEvent("profile-image-changed", { detail: dataUrl })
        );
      }

      toast(
        dataUrl ? "Profile picture updated successfully!" : "Profile picture removed.",
        "success"
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error updating profile picture";
      toast(message, "error");
    } finally {
      setSavingImage(false);
    }
  };

  // Pre-load selected file into the Crop & Resize Editor
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict client-side validation
    const safeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!safeTypes.includes(file.type)) {
      toast("Invalid file type. Only JPG, PNG, and WebP are allowed.", "error");
      e.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast("Image file size must be under 10MB.", "error");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => toast("Failed to read image file", "error");
    reader.onload = () => {
      const dataUrl = reader.result as string;
      openCropEditor(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Launch live camera stream or fallback to native camera input
  const startCamera = async (facing: "user" | "environment" = "user") => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      nativeCameraInputRef.current?.click();
      return;
    }

    try {
      stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsCameraActive(true);
      setCameraFacing(facing);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.warn("Live camera access failed, falling back to native picker:", error);
      nativeCameraInputRef.current?.click();
    }
  };

  // Switch between front and back camera
  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === "user" ? "environment" : "user";
    startCamera(nextFacing);
  };

  // Capture frame from active live camera video stream and send to Crop Editor
  const capturePhotoFromCamera = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const size = Math.min(video.videoWidth, video.videoHeight) || 480;
      const sx = (video.videoWidth - size) / 2;
      const sy = (video.videoHeight - size) / 2;

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Unable to create canvas context.");
      }

      // If front camera, mirror image for natural selfie feel
      if (cameraFacing === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

      stopCameraStream();
      openCropEditor(dataUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to capture photo";
      toast(message, "error");
    }
  };

  // Open the interactive Crop & Preview editor
  const openCropEditor = (imageSrc: string) => {
    setCropTargetImage(imageSrc);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);

    const testImg = new Image();
    testImg.onload = () => {
      setImgNaturalSize({ width: testImg.naturalWidth, height: testImg.naturalHeight });
    };
    testImg.src = imageSrc;
  };

  // Delete profile picture
  const handleDeleteProfilePicture = async () => {
    if (!selectedImage) return;
    await uploadProfileImage(null);
  };

  // ── Drag & Pan Handlers for Crop Area ────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDraggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPanX: pan.x,
      initPanY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const rawX = dragStartRef.current.initPanX + dx;
    const rawY = dragStartRef.current.initPanY + dy;
    const clamped = getClampedPan(rawX, rawY, zoom, rotation);

    // If reaching boundary, adjust drag anchor so reversing direction responds immediately
    if (rawX !== clamped.x) {
      dragStartRef.current.startX = e.clientX;
      dragStartRef.current.initPanX = clamped.x;
    }
    if (rawY !== clamped.y) {
      dragStartRef.current.startY = e.clientY;
      dragStartRef.current.initPanY = clamped.y;
    }

    setPan(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.min(3, Math.max(1, newZoom));
    setZoom(clampedZoom);
    setPan((prev) => getClampedPan(prev.x, prev.y, clampedZoom, rotation));
  };

  const handleRotate = () => {
    const nextRotation = (rotation + 90) % 360;
    setRotation(nextRotation);
    setPan((prev) => getClampedPan(prev.x, prev.y, zoom, nextRotation));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    handleZoomChange(+(zoom + delta).toFixed(2));
  };

  // Render crop onto canvas, sanitize, and save
  const handleSaveAndApplyCrop = async () => {
    if (!cropTargetImage || !cropImageRef.current) return;

    setSavingImage(true);
    try {
      const TARGET_SIZE = 512;
      const canvas = document.createElement("canvas");
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;
      const ctx = canvas.getContext("2d");

      if (!ctx) throw new Error("Canvas context initialization failed.");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Ratio between export resolution and preview box
      const ratio = TARGET_SIZE / CROP_VIEWPORT_SIZE;

      // 1. Center canvas origin
      ctx.translate(TARGET_SIZE / 2, TARGET_SIZE / 2);

      // 2. Apply user pan (scaled to export)
      ctx.translate(pan.x * ratio, pan.y * ratio);

      // 3. Apply rotation & zoom around the panned center
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      // 4. Compute fit dimensions matching the preview box
      const isSideways = rotation === 90 || rotation === 270;
      const naturalW = isSideways ? imgNaturalSize.height : imgNaturalSize.width;
      const naturalH = isSideways ? imgNaturalSize.width : imgNaturalSize.height;

      const baseScale = Math.max(
        CROP_VIEWPORT_SIZE / (naturalW || 1),
        CROP_VIEWPORT_SIZE / (naturalH || 1)
      );

      const drawFitW = (imgNaturalSize.width || CROP_VIEWPORT_SIZE) * baseScale * ratio;
      const drawFitH = (imgNaturalSize.height || CROP_VIEWPORT_SIZE) * baseScale * ratio;

      // 5. Draw image centered
      ctx.drawImage(
        cropImageRef.current,
        -drawFitW / 2,
        -drawFitH / 2,
        drawFitW,
        drawFitH
      );

      // Clean, sanitized JPEG (strips EXIF / GPS tags)
      const sanitizedDataUrl = canvas.toDataURL("image/jpeg", 0.88);

      await uploadProfileImage(sanitizedDataUrl);
      setCropTargetImage(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process cropped image";
      toast(msg, "error");
    } finally {
      setSavingImage(false);
    }
  };

  // Calculate image preview size inside crop viewport
  const isSideways = rotation === 90 || rotation === 270;
  const effectiveW = isSideways ? imgNaturalSize.height : imgNaturalSize.width;
  const effectiveH = isSideways ? imgNaturalSize.width : imgNaturalSize.height;
  const baseScale = Math.max(
    CROP_VIEWPORT_SIZE / (effectiveW || 1),
    CROP_VIEWPORT_SIZE / (effectiveH || 1)
  );
  const previewImgW = (imgNaturalSize.width || CROP_VIEWPORT_SIZE) * baseScale;
  const previewImgH = (imgNaturalSize.height || CROP_VIEWPORT_SIZE) * baseScale;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-[#13151b] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto scrollbar-hide">
        {/* Hidden inputs for camera capture & gallery file picker */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileInputChange}
        />
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="user"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW A: CROP & RESIZE PREVIEW SCREEN
        ══════════════════════════════════════════════════════════════════════ */}
        {cropTargetImage ? (
          <div className="space-y-4 animate-fade-in">
            {/* Crop Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCropTargetImage(null)}
                  className="w-9 h-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-white font-bold text-base tracking-tight flex items-center gap-1.5">
                    Crop &amp; Resize Profile
                    <Crop
                      className="w-4 h-4 transition-colors"
                      style={{ color: activePreset.accentColor }}
                    />
                  </h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Drag to position • Adjust zoom &amp; rotation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCropTargetImage(null)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Crop Viewport Box */}
            <div className="flex flex-col items-center">
              <div
                className="relative rounded-2xl overflow-hidden bg-black/90 border border-white/15 select-none touch-none cursor-grab active:cursor-grabbing shadow-inner"
                style={{
                  width: `${CROP_VIEWPORT_SIZE}px`,
                  height: `${CROP_VIEWPORT_SIZE}px`,
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
              >
                {/* Scaled and Panned Image */}
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
                  }}
                >
                  <img
                    ref={cropImageRef}
                    src={cropTargetImage}
                    alt="Crop Target"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth && img.naturalHeight) {
                        setImgNaturalSize({
                          width: img.naturalWidth,
                          height: img.naturalHeight,
                        });
                      }
                    }}
                    className="max-w-none transition-transform duration-75"
                    style={{
                      width: `${previewImgW}px`,
                      height: `${previewImgH}px`,
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transformOrigin: "center center",
                    }}
                    draggable={false}
                  />
                </div>

                {/* Circular Mask Overlay with Reticle */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-full"
                  style={{
                    boxShadow: "0 0 0 9999px rgba(10, 11, 15, 0.78)",
                    border: `2px solid ${activePreset.accentColor}`,
                  }}
                />

                {/* Faint Center Reticle Crosshairs */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
                  <div className="w-8 h-[1px] bg-white/70" />
                  <div className="h-8 w-[1px] bg-white/70 absolute" />
                </div>
              </div>
            </div>

            {/* Zoom Slider */}
            <div className="p-3 rounded-2xl bg-[#181a22] border border-white/6 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  Scale / Zoom
                </span>
                <span className="text-white font-mono font-bold text-[11px]">
                  {zoom.toFixed(2)}x
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleZoomChange(+(zoom - 0.1).toFixed(2))}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  className="flex-1 accent-[var(--color-primary)] cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                />
                <button
                  type="button"
                  onClick={() => handleZoomChange(+(zoom + 0.1).toFixed(2))}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Rotation & Reset Row */}
            <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-[#181a22] border border-white/6">
              <button
                type="button"
                onClick={handleRotate}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Rotate 90°
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>

            {/* Action Buttons: Cancel vs Save & Apply */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={savingImage}
                onClick={() => setCropTargetImage(null)}
                className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={savingImage}
                onClick={handleSaveAndApplyCrop}
                className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Apply Picture</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════════════════════
              VIEW B: STANDARD PROFILE AVATAR & PRESETS VIEW
          ══════════════════════════════════════════════════════════════════════ */
          <>
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white shadow-md">
                  <Palette
                    className="w-5 h-5 transition-colors duration-300"
                    style={{ color: activePreset.accentColor }}
                  />
                </div>
                <div>
                  <h2 className="text-white font-bold text-base tracking-tight flex items-center gap-2">
                    Profile Avatar
                    <Sparkles
                      className="w-3.5 h-3.5 transition-colors duration-300"
                      style={{ color: activePreset.accentColor }}
                    />
                  </h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Customize your profile picture and color theme
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopCameraStream();
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Preview Card */}
            <div className="p-4 rounded-2xl bg-[#181a22] border border-white/6 flex items-center gap-4 relative overflow-hidden">
              <div className="relative">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-extrabold shadow-xl transition-all duration-300 overflow-hidden ${
                    selectedImage ? "p-0.5" : ""
                  }`}
                  style={{
                    background: activePreset.previewBg,
                    boxShadow: `0 8px 24px -2px ${activePreset.glow}`,
                  }}
                >
                  {selectedImage ? (
                    <img
                      src={selectedImage}
                      alt={userName}
                      className="w-full h-full rounded-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setSelectedImage(null)}
                    />
                  ) : (
                    <span>{firstInitial}</span>
                  )}
                </div>

                {/* Glowing Accent Indicator */}
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full border border-black/40 flex items-center justify-center shadow"
                  style={{ backgroundColor: activePreset.accentColor }}
                >
                  <Sparkles className="w-2.5 h-2.5 text-black" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-white font-bold text-sm tracking-tight truncate">
                    {userName}
                  </p>
                </div>
                <p className="text-slate-400 text-xs mt-0.5">
                  Theme:{" "}
                  <span className="text-white font-semibold">{activePreset.name}</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {activePreset.description}
                </p>
              </div>
            </div>

            {/* ── Section: Profile Picture (Camera, Gallery, Delete) ── */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Profile Picture
                </span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Interactive Crop &amp; Resize
                </span>
              </div>

              {/* In-Modal Live Camera Viewfinder Overlay (When Camera is Active) */}
              {isCameraActive && (
                <div className="p-3 rounded-2xl bg-[#181a22] border border-white/15 space-y-3 animate-fade-in">
                  <div className="relative w-full aspect-square max-h-56 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-white/10">
                    <video
                      ref={(el) => {
                        videoRef.current = el;
                        if (el && streamRef.current && el.srcObject !== streamRef.current) {
                          el.srcObject = streamRef.current;
                          el.play().catch(() => {});
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${
                        cameraFacing === "user" ? "scale-x-[-1]" : ""
                      }`}
                    />
                    {/* Viewfinder crosshairs */}
                    <div className="absolute inset-4 border border-dashed border-white/30 rounded-full pointer-events-none" />
                  </div>

                  {/* Camera Action Buttons */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={stopCameraStream}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={toggleCameraFacing}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
                      title="Switch camera"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={capturePhotoFromCamera}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Take Photo
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons: Camera, Gallery, Delete */}
              <div className="grid grid-cols-3 gap-2">
                {/* 1. Camera Trigger */}
                <button
                  type="button"
                  disabled={savingImage}
                  onClick={() => startCamera("user")}
                  className="p-3 rounded-2xl bg-[#181a22] border border-white/8 hover:border-white/20 hover:bg-white/5 text-left transition-all group cursor-pointer disabled:opacity-50 flex flex-col items-center justify-center text-center gap-1.5"
                >
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300 group-hover:text-white group-hover:scale-105 transition-all">
                    <Camera className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Camera</span>
                  <span className="text-[10px] text-slate-500">Take photo</span>
                </button>

                {/* 2. Gallery File Picker */}
                <button
                  type="button"
                  disabled={savingImage}
                  onClick={() => galleryInputRef.current?.click()}
                  className="p-3 rounded-2xl bg-[#181a22] border border-white/8 hover:border-white/20 hover:bg-white/5 text-left transition-all group cursor-pointer disabled:opacity-50 flex flex-col items-center justify-center text-center gap-1.5"
                >
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-300 group-hover:text-white group-hover:scale-105 transition-all">
                    <ImagePlus className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Gallery</span>
                  <span className="text-[10px] text-slate-500">Upload file</span>
                </button>

                {/* 3. Delete Picture */}
                <button
                  type="button"
                  disabled={savingImage || !selectedImage}
                  onClick={handleDeleteProfilePicture}
                  className={`p-3 rounded-2xl border transition-all flex flex-col items-center justify-center text-center gap-1.5 ${
                    selectedImage
                      ? "bg-[#181a22] border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-500/10 text-rose-400 cursor-pointer"
                      : "bg-[#181a22]/50 border-white/4 text-slate-600 cursor-not-allowed opacity-40"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                      selectedImage
                        ? "bg-rose-500/10 text-rose-400"
                        : "bg-white/5 text-slate-600"
                    }`}
                  >
                    {savingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      selectedImage ? "text-rose-400" : "text-slate-600"
                    }`}
                  >
                    Delete
                  </span>
                  <span className="text-[10px] text-slate-500">Revert color</span>
                </button>
              </div>
            </div>

            {/* ── Section: Color Presets (10 Themes) ── */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-400" />
                  Color Presets (10)
                </span>
                <span className="text-[10px] text-slate-500">Ambient Glow &amp; Theme</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PROFILE_COLOR_PRESETS.map((preset) => {
                  const isSelected =
                    activePreset.id === preset.id || selectedGradient === preset.gradient;
                  return (
                    <button
                      key={preset.id}
                      disabled={savingColor}
                      onClick={() => handleSelectPreset(preset)}
                      className={`text-left p-3 rounded-2xl border transition-all flex items-center gap-3 group cursor-pointer ${
                        isSelected
                          ? "bg-white/10 border-white/30 shadow-lg scale-[1.01]"
                          : "bg-[#181a22] border-white/6 hover:border-white/15 hover:bg-white/4"
                      }`}
                      style={{
                        boxShadow: isSelected ? `0 4px 18px -2px ${preset.glow}` : undefined,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md flex-shrink-0 transition-transform group-hover:scale-105 overflow-hidden"
                        style={{
                          background: preset.previewBg,
                          boxShadow: `0 2px 10px ${preset.glow}`,
                        }}
                      >
                        {isSelected ? (
                          <Check className="w-4 h-4 text-white stroke-[3]" />
                        ) : (
                          <span className="text-xs opacity-90">{firstInitial}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-white text-xs font-bold truncate">{preset.name}</p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {preset.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Done Button */}
            <button
              onClick={() => {
                stopCameraStream();
                onClose();
              }}
              className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
