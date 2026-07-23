"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import createGlobe, { type Globe as CobeGlobe } from "cobe";

import { cn } from "@/lib/utils";

type GlobeColor = [number, number, number];
type GlobeCoordinates = [number, number];

export interface GlobeMarker {
  id: string;
  location: GlobeCoordinates;
  label?: string;
}

export interface GlobeArc {
  id: string;
  from: GlobeCoordinates;
  to: GlobeCoordinates;
  label?: string;
}

export interface GlobeProps {
  markers?: GlobeMarker[];
  arcs?: GlobeArc[];
  className?: string;
  markerColor?: GlobeColor;
  baseColor?: GlobeColor;
  arcColor?: GlobeColor;
  glowColor?: GlobeColor;
  dark?: number;
  mapBrightness?: number;
  markerSize?: number;
  markerElevation?: number;
  arcWidth?: number;
  arcHeight?: number;
  speed?: number;
  theta?: number;
  diffuse?: number;
  mapSamples?: number;
}

interface PointerPosition {
  horizontal: number;
  vertical: number;
}

interface TimedPointerPosition extends PointerPosition {
  recordedAt: number;
}

interface GlobeRotation {
  horizontal: number;
  vertical: number;
}

interface AnchorPositionStyle extends CSSProperties {
  positionAnchor: string;
}

const emptyMarkers: GlobeMarker[] = [];
const emptyArcs: GlobeArc[] = [];
const defaultMarkerColor: GlobeColor = [0.02, 0.48, 0.25];
const defaultBaseColor: GlobeColor = [0.9, 0.96, 0.92];
const defaultArcColor: GlobeColor = [0.02, 0.48, 0.25];
const defaultGlowColor: GlobeColor = [0.94, 0.98, 0.95];

function createCobeMarkers(markers: GlobeMarker[], markerSize: number) {
  return markers.map((marker) => ({
    id: marker.id,
    location: marker.location,
    size: markerSize,
  }));
}

function createCobeArcs(arcs: GlobeArc[]) {
  return arcs.map((arc) => ({
    id: arc.id,
    from: arc.from,
    to: arc.to,
  }));
}

export function Globe({
  markers = emptyMarkers,
  arcs = emptyArcs,
  className,
  markerColor = defaultMarkerColor,
  baseColor = defaultBaseColor,
  arcColor = defaultArcColor,
  glowColor = defaultGlowColor,
  dark = 0,
  mapBrightness = 7,
  markerSize = 0.025,
  markerElevation = 0.01,
  arcWidth = 0.5,
  arcHeight = 0.25,
  speed = 0.003,
  theta = 0.2,
  diffuse = 1.5,
  mapSamples = 16000,
}: GlobeProps) {
  const canvasReference = useRef<HTMLCanvasElement>(null);
  const activePointerReference = useRef<PointerPosition | null>(null);
  const lastPointerReference = useRef<TimedPointerPosition | null>(null);
  const dragRotationReference = useRef<GlobeRotation>({
    horizontal: 0,
    vertical: 0,
  });
  const rotationVelocityReference = useRef<GlobeRotation>({
    horizontal: 0,
    vertical: 0,
  });
  const horizontalOffsetReference = useRef(0);
  const verticalOffsetReference = useRef(0);
  const isPointerInteractingReference = useRef(false);
  const prefersReducedMotionReference = useRef(false);

  const handlePointerDown = useCallback(
    (pointerEvent: ReactPointerEvent<HTMLCanvasElement>) => {
      activePointerReference.current = {
        horizontal: pointerEvent.clientX,
        vertical: pointerEvent.clientY,
      };
      lastPointerReference.current = {
        horizontal: pointerEvent.clientX,
        vertical: pointerEvent.clientY,
        recordedAt: Date.now(),
      };
      isPointerInteractingReference.current = true;
      pointerEvent.currentTarget.style.cursor = "grabbing";
    },
    [],
  );

  const finishPointerInteraction = useCallback(() => {
    if (activePointerReference.current) {
      horizontalOffsetReference.current +=
        dragRotationReference.current.horizontal;
      verticalOffsetReference.current += dragRotationReference.current.vertical;
      dragRotationReference.current = { horizontal: 0, vertical: 0 };
    }

    activePointerReference.current = null;
    lastPointerReference.current = null;
    isPointerInteractingReference.current = false;

    if (canvasReference.current) {
      canvasReference.current.style.cursor = "grab";
    }
  }, []);

  const handlePointerMove = useCallback((pointerEvent: PointerEvent) => {
    const activePointer = activePointerReference.current;

    if (!activePointer) {
      return;
    }

    const horizontalDelta = pointerEvent.clientX - activePointer.horizontal;
    const verticalDelta = pointerEvent.clientY - activePointer.vertical;

    dragRotationReference.current = {
      horizontal: horizontalDelta / 300,
      vertical: verticalDelta / 1000,
    };

    const currentTimestamp = Date.now();
    const lastPointer = lastPointerReference.current;

    if (lastPointer) {
      const elapsedMilliseconds = Math.max(
        currentTimestamp - lastPointer.recordedAt,
        1,
      );
      const maximumVelocity = 0.15;
      const horizontalVelocity =
        ((pointerEvent.clientX - lastPointer.horizontal) /
          elapsedMilliseconds) *
        0.3;
      const verticalVelocity =
        ((pointerEvent.clientY - lastPointer.vertical) /
          elapsedMilliseconds) *
        0.08;

      rotationVelocityReference.current = {
        horizontal: Math.max(
          -maximumVelocity,
          Math.min(maximumVelocity, horizontalVelocity),
        ),
        vertical: Math.max(
          -maximumVelocity,
          Math.min(maximumVelocity, verticalVelocity),
        ),
      };
    }

    lastPointerReference.current = {
      horizontal: pointerEvent.clientX,
      vertical: pointerEvent.clientY,
      recordedAt: currentTimestamp,
    };
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerup", finishPointerInteraction, {
      passive: true,
    });
    window.addEventListener("pointercancel", finishPointerInteraction, {
      passive: true,
    });
    window.addEventListener("blur", finishPointerInteraction);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishPointerInteraction);
      window.removeEventListener("pointercancel", finishPointerInteraction);
      window.removeEventListener("blur", finishPointerInteraction);
    };
  }, [finishPointerInteraction, handlePointerMove]);

  useEffect(() => {
    const reducedMotionMediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const updateMotionPreference = () => {
      prefersReducedMotionReference.current =
        reducedMotionMediaQuery.matches;
    };

    updateMotionPreference();
    reducedMotionMediaQuery.addEventListener(
      "change",
      updateMotionPreference,
    );

    return () => {
      reducedMotionMediaQuery.removeEventListener(
        "change",
        updateMotionPreference,
      );
    };
  }, []);

  useEffect(() => {
    const canvas = canvasReference.current;

    if (!canvas) {
      return;
    }

    let globeInstance: CobeGlobe | null = null;
    let animationFrameIdentifier: number | null = null;
    let fadeInTimeoutIdentifier: number | null = null;
    let automaticHorizontalRotation = 0;

    const resizeGlobe = (containerWidth: number) => {
      if (!globeInstance || containerWidth <= 0) {
        return;
      }

      globeInstance.update({
        width: containerWidth,
        height: containerWidth,
      });
    };

    const initializeGlobe = () => {
      const containerWidth = canvas.offsetWidth;

      if (containerWidth <= 0 || globeInstance) {
        return;
      }

      const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      try {
        globeInstance = createGlobe(canvas, {
          devicePixelRatio,
          width: containerWidth,
          height: containerWidth,
          phi: 0,
          theta,
          dark,
          diffuse,
          mapSamples,
          mapBrightness,
          baseColor,
          markerColor,
          glowColor,
          markerElevation,
          markers: createCobeMarkers(markers, markerSize),
          arcs: createCobeArcs(arcs),
          arcColor,
          arcWidth,
          arcHeight,
          opacity: 0.8,
        });
      } catch {
        return;
      }

      const animateGlobe = () => {
        if (!globeInstance) {
          return;
        }

        if (
          !isPointerInteractingReference.current &&
          !prefersReducedMotionReference.current
        ) {
          automaticHorizontalRotation += speed;

          if (
            Math.abs(rotationVelocityReference.current.horizontal) > 0.0001 ||
            Math.abs(rotationVelocityReference.current.vertical) > 0.0001
          ) {
            horizontalOffsetReference.current +=
              rotationVelocityReference.current.horizontal;
            verticalOffsetReference.current +=
              rotationVelocityReference.current.vertical;
            rotationVelocityReference.current.horizontal *= 0.95;
            rotationVelocityReference.current.vertical *= 0.95;
          }

          const minimumVerticalRotation = -0.4;
          const maximumVerticalRotation = 0.4;

          if (
            verticalOffsetReference.current < minimumVerticalRotation
          ) {
            verticalOffsetReference.current +=
              (minimumVerticalRotation - verticalOffsetReference.current) *
              0.1;
          } else if (
            verticalOffsetReference.current > maximumVerticalRotation
          ) {
            verticalOffsetReference.current +=
              (maximumVerticalRotation - verticalOffsetReference.current) *
              0.1;
          }
        }

        globeInstance.update({
          phi:
            automaticHorizontalRotation +
            horizontalOffsetReference.current +
            dragRotationReference.current.horizontal,
          theta:
            theta +
            verticalOffsetReference.current +
            dragRotationReference.current.vertical,
        });
        animationFrameIdentifier = window.requestAnimationFrame(animateGlobe);
      };

      animateGlobe();
      fadeInTimeoutIdentifier = window.setTimeout(() => {
        canvas.style.opacity = "1";
      }, 50);
    };

    const resizeObserver = new ResizeObserver((resizeEntries) => {
      const containerWidth = resizeEntries[0]?.contentRect.width ?? 0;

      if (!globeInstance) {
        initializeGlobe();
        return;
      }

      resizeGlobe(containerWidth);
    });

    resizeObserver.observe(canvas);
    initializeGlobe();

    return () => {
      resizeObserver.disconnect();

      if (animationFrameIdentifier !== null) {
        window.cancelAnimationFrame(animationFrameIdentifier);
      }

      if (fadeInTimeoutIdentifier !== null) {
        window.clearTimeout(fadeInTimeoutIdentifier);
      }

      globeInstance?.destroy();
    };
  }, [
    arcColor,
    arcHeight,
    arcs,
    arcWidth,
    baseColor,
    dark,
    diffuse,
    glowColor,
    mapBrightness,
    mapSamples,
    markerColor,
    markerElevation,
    markerSize,
    markers,
    speed,
    theta,
  ]);

  return (
    <div
      className={cn("relative aspect-square select-none", className)}
      aria-hidden="true"
    >
      <canvas
        ref={canvasReference}
        onPointerDown={handlePointerDown}
        className="size-full cursor-grab rounded-full opacity-0 transition-opacity duration-1000"
        style={{ touchAction: "none" }}
        tabIndex={-1}
      />

      {markers
        .filter((marker) => marker.label)
        .map((marker) => (
          <div
            key={marker.id}
            className="pointer-events-none absolute rounded-sm bg-foreground px-1.5 py-0.5 font-mono text-[0.6rem] tracking-[0.08em] whitespace-nowrap text-background uppercase transition-[opacity,filter] duration-700"
            style={
              {
                positionAnchor: `--cobe-${marker.id}`,
                bottom: "anchor(top)",
                left: "anchor(center)",
                translate: "-50% 0",
                marginBottom: 8,
                opacity: `var(--cobe-visible-${marker.id}, 0)`,
                filter: `blur(calc((1 - var(--cobe-visible-${marker.id}, 0)) * 8px))`,
              } satisfies AnchorPositionStyle
            }
          >
            {marker.label}
            <span className="absolute top-full left-1/2 -translate-x-1/2 -translate-y-px border-5 border-transparent border-t-foreground" />
          </div>
        ))}

      {arcs
        .filter((arc) => arc.label)
        .map((arc) => (
          <div
            key={arc.id}
            className="pointer-events-none absolute rounded-sm bg-card px-1.5 py-0.5 font-mono text-[0.6rem] tracking-[0.08em] whitespace-nowrap text-foreground uppercase shadow-sm transition-[opacity,filter] duration-700"
            style={
              {
                positionAnchor: `--cobe-arc-${arc.id}`,
                bottom: "anchor(top)",
                left: "anchor(center)",
                translate: "-50% 0",
                marginBottom: 8,
                opacity: `var(--cobe-visible-arc-${arc.id}, 0)`,
                filter: `blur(calc((1 - var(--cobe-visible-arc-${arc.id}, 0)) * 8px))`,
              } satisfies AnchorPositionStyle
            }
          >
            {arc.label}
            <span className="absolute top-full left-1/2 -translate-x-1/2 -translate-y-px border-5 border-transparent border-t-card" />
          </div>
        ))}
    </div>
  );
}
