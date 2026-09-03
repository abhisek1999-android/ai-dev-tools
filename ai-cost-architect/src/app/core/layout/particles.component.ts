import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  inject,
} from '@angular/core';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

/**
 * Ambient particle field rendered behind every page.
 *
 * Purely decorative: the canvas is aria-hidden, pointer-events:none and
 * fixed at z-0, so it never intercepts input or reaches assistive tech.
 *
 * Performance notes — this runs on every route, so it has to stay cheap:
 *   - The RAF loop runs OUTSIDE the Angular zone. Inside the zone it would
 *     trigger change detection ~60x/sec across the whole app.
 *   - Device pixel ratio is capped at 2; a 3x phone gains nothing visible
 *     here but pays 2.25x the fill cost.
 *   - Particle count scales with viewport area and is hard-capped.
 *   - The loop is suspended entirely while the tab is hidden.
 *   - Link-line search is O(n²) over a small n; the cap keeps that trivial.
 *
 * Accessibility — under `prefers-reduced-motion: reduce` the field is
 * painted once as a static starfield and no animation loop is ever started.
 */
@Component({
  selector: 'app-particles',
  standalone: true,
  template: `
    <canvas
      #canvas
      aria-hidden="true"
      class="pointer-events-none fixed inset-0 z-0 h-full w-full"
    ></canvas>
  `,
})
export class ParticlesComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly zone = inject(NgZone);

  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private frameId = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;

  private width = 0;
  private height = 0;
  private dpr = 1;

  /** Cursor link target, in CSS pixels. -1 means "no pointer". */
  private pointerX = -1;
  private pointerY = -1;

  private reducedMotion = false;
  private finePointer = false;

  // --- Tuning ---------------------------------------------------------
  private static readonly LINK_DISTANCE = 132;
  private static readonly POINTER_DISTANCE = 168;
  private static readonly AREA_PER_PARTICLE = 19_000;
  private static readonly MIN_PARTICLES = 22;
  private static readonly MAX_PARTICLES = 88;
  private static readonly DOT_ALPHA = 0.42;
  private static readonly LINE_ALPHA = 0.13;
  private static readonly POINTER_ALPHA = 0.2;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    this.reducedMotion = this.prefers('(prefers-reduced-motion: reduce)');
    this.finePointer = this.prefers('(pointer: fine)');

    this.measure();
    this.seed();

    // Everything below is outside Angular's zone: no change detection.
    this.zone.runOutsideAngular(() => {
      window.addEventListener('resize', this.onResize, { passive: true });
      document.addEventListener('visibilitychange', this.onVisibility);

      if (this.reducedMotion) {
        this.draw(); // one static frame, then nothing moves
        return;
      }

      if (this.finePointer) {
        window.addEventListener('pointermove', this.onPointerMove, { passive: true });
        window.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
      }
      this.start();
    });
  }

  ngOnDestroy(): void {
    this.stop();
    clearTimeout(this.resizeTimer);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerleave', this.onPointerLeave);
  }

  // --- Lifecycle helpers ----------------------------------------------

  private prefers(query: string): boolean {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  }

  private start(): void {
    if (this.frameId) return;
    this.frameId = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (!this.frameId) return;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  private readonly onVisibility = (): void => {
    if (this.reducedMotion) return;
    if (document.hidden) this.stop();
    else this.start();
  };

  private readonly onResize = (): void => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.measure();
      this.seed();
      if (this.reducedMotion) this.draw();
    }, 160);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.pointerX = e.clientX;
    this.pointerY = e.clientY;
  };

  private readonly onPointerLeave = (): void => {
    this.pointerX = -1;
    this.pointerY = -1;
  };

  // --- Setup ------------------------------------------------------------

  private measure(): void {
    const canvas = this.canvasRef.nativeElement;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    canvas.width = Math.floor(this.width * this.dpr);
    canvas.height = Math.floor(this.height * this.dpr);

    // Draw in CSS pixels; the transform handles the device scale.
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private seed(): void {
    const target = Math.round((this.width * this.height) / ParticlesComponent.AREA_PER_PARTICLE);
    const count = Math.max(
      ParticlesComponent.MIN_PARTICLES,
      Math.min(ParticlesComponent.MAX_PARTICLES, target),
    );

    this.particles = Array.from({ length: count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      // Deliberately slow: this should read as drift, not as motion.
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.1 + 0.5,
    }));
  }

  // --- Render loop ------------------------------------------------------

  private readonly tick = (): void => {
    this.step();
    this.draw();
    this.frameId = requestAnimationFrame(this.tick);
  };

  private step(): void {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap rather than bounce — no visible "walls".
      if (p.x < -10) p.x = this.width + 10;
      else if (p.x > this.width + 10) p.x = -10;
      if (p.y < -10) p.y = this.height + 10;
      else if (p.y > this.height + 10) p.y = -10;
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    const {
      LINK_DISTANCE,
      POINTER_DISTANCE,
      DOT_ALPHA,
      LINE_ALPHA,
      POINTER_ALPHA,
    } = ParticlesComponent;

    // Link lines first, so dots sit on top of them.
    ctx.lineWidth = 1;
    for (let i = 0; i < this.particles.length; i++) {
      const a = this.particles[i];

      for (let j = i + 1; j < this.particles.length; j++) {
        const b = this.particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist > LINK_DISTANCE) continue;

        const alpha = (1 - dist / LINK_DISTANCE) * LINE_ALPHA;
        ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // A faint tether to the cursor keeps the field feeling alive.
      if (this.pointerX >= 0) {
        const pd = Math.hypot(a.x - this.pointerX, a.y - this.pointerY);
        if (pd < POINTER_DISTANCE) {
          const alpha = (1 - pd / POINTER_DISTANCE) * POINTER_ALPHA;
          ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(this.pointerX, this.pointerY);
          ctx.stroke();
        }
      }
    }

    ctx.fillStyle = `rgba(255,255,255,${DOT_ALPHA})`;
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
