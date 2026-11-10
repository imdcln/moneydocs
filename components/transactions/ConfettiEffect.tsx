"use client";

import { useEffect, useRef } from "react";

interface ConfettiProps {
  duration?: number;
  particleCount?: number;
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: "circle" | "rect" | "star";
  alpha: number;
}

const COLORS = [
  "#10B981", // Emerald
  "#34D399", // Mint
  "#38BDF8", // Sky blue
  "#818CF8", // Indigo
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#A855F7", // Purple
  "#F43F5E", // Rose
];

export default function ConfettiEffect({
  duration = 3500,
  particleCount = 120,
  onComplete,
}: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let startTime = performance.now();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize particles originating from center and sides for a celebration burst
    const particles: Particle[] = [];
    const shapes: ("circle" | "rect" | "star")[] = ["circle", "rect", "star"];

    for (let i = 0; i < particleCount; i++) {
      // 50% burst from center, 25% from bottom left, 25% from bottom right
      let startX = canvas.width / 2;
      let startY = canvas.height * 0.45;
      let angle = Math.random() * Math.PI * 2;
      let speed = 4 + Math.random() * 9;

      if (i % 4 === 1) {
        startX = canvas.width * 0.15;
        startY = canvas.height * 0.7;
        angle = -Math.PI / 4 + (Math.random() - 0.5) * 0.6;
      } else if (i % 4 === 2) {
        startX = canvas.width * 0.85;
        startY = canvas.height * 0.7;
        angle = (-3 * Math.PI) / 4 + (Math.random() - 0.5) * 0.6;
      }

      particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (startY > canvas.height * 0.5 ? 4 : 1),
        size: 5 + Math.random() * 8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        alpha: 1,
      });
    }

    const drawStar = (
      context: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      spikes: number,
      outerRadius: number,
      innerRadius: number
    ) => {
      let rot = (Math.PI / 2) * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;

      context.beginPath();
      context.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        context.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        context.lineTo(x, y);
        rot += step;
      }
      context.lineTo(cx, cy - outerRadius);
      context.closePath();
      context.fill();
    };

    const render = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        // Physics update
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18; // gravity
        p.vx *= 0.985; // drag
        p.rotation += p.rotationSpeed;
        p.alpha = Math.max(0, 1 - progress * 1.15);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        } else if (p.shape === "star") {
          drawStar(ctx, 0, 0, 5, p.size, p.size * 0.45);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        if (onComplete) onComplete();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
    };
  }, [duration, particleCount, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[100]"
      aria-hidden="true"
    />
  );
}
