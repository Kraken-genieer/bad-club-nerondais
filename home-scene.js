/*
 * <bcn-scene> v3 — Silhouettes fixes + volant animé.
 * Les 4 silhouettes de joueurs (extraites de l'affiche du club) sont FIGÉES
 * dans leurs poses dynamiques ; seuls s'animent : le volant orange (trajectoire
 * en arcs bouclée sur 10 s), sa traînée pointillée, les explosions de
 * particules aux frappes, un pulse de glow sur l'équipe qui frappe, la
 * poussière lumineuse d'ambiance et le parallax souris.
 * Canvas 2D + requestAnimationFrame. Aucune rotation globale de la scène.
 *
 * Attributs :
 *   density — multiplicateur des particules d'ambiance (défaut 1)
 */
(function () {
  const T = 10; // durée de la boucle (s)
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (p) => p * p * (3 - 2 * p);
  const lerp = (a, b, p) => a + (b - a) * p;

  class BCNScene extends HTMLElement {
    connectedCallback() {
      if (this._started) return;
      this._started = true;
      this.style.display = 'block';
      this.style.width = '100%';
      this.style.height = '100%';
      this.style.overflow = 'hidden';
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'width:100%;height:100%;display:block;';
      this.appendChild(canvas);
      this._canvas = canvas;
      this._ctx = canvas.getContext('2d');

      // silhouettes de l'affiche (blanches, fond transparent)
      this._silL = new Image(); this._silL.src = 'assets/sil-left.png';
      this._silR = new Image(); this._silR.src = 'assets/sil-right.png';
      this._net = new Image(); this._net.src = 'assets/net.png';

      this._par = { x: 0, y: 0, tx: 0, ty: 0 };
      this._onMove = (e) => {
        const r = this.getBoundingClientRect();
        this._par.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        this._par.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      };
      window.addEventListener('pointermove', this._onMove, { passive: true });
      this._resize = () => this._setup();
      window.addEventListener('resize', this._resize);
      this._reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this._setup();
      this._t0 = performance.now();
      const loop = (now) => {
        this._raf = requestAnimationFrame(loop);
        this._draw(((now - this._t0) / 1000) % T);
      };
      if (this._reduced) {
        const once = () => this._draw(2.2);
        this._silR.onload = once; this._silL.onload = once; once();
      } else {
        this._raf = requestAnimationFrame(loop);
      }
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      window.removeEventListener('pointermove', this._onMove);
      window.removeEventListener('resize', this._resize);
      this._started = false;
    }

    _setup() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.clientWidth || window.innerWidth;
      const h = this.clientHeight || window.innerHeight;
      this._w = w; this._h = h; this._dpr = dpr;
      this._canvas.width = Math.round(w * dpr);
      this._canvas.height = Math.round(h * dpr);
      this._simple = w < 720;
      const density = parseFloat(this.getAttribute('density') || '1') || 1;
      const n = Math.round((this._simple ? 45 : 100) * density);
      const rnd = (a, b) => a + Math.random() * (b - a);
      this._dust = [];
      for (let i = 0; i < n; i++) {
        this._dust.push({
          x: Math.random(), y: Math.random(), size: rnd(0.6, 1.9),
          cyan: Math.random() < 0.7, ph: rnd(0, Math.PI * 2), sp: rnd(0.1, 0.5),
        });
      }
      this._layout();
    }

    // Disposition des silhouettes + points de frappe du volant (coords écran)
    _layout() {
      const w = this._w, h = this._h;
      const gy = h * 0.62;            // ligne de sol (scène au-dessus du bloc titre)
      const sc = Math.min(h * 0.00092, w * 0.00068); // échelle silhouettes
      // gauche : 558x448 (2 hommes) — droite : 422x614 (smash femme + défense)
      const Lw = 558 * sc, Lh = 448 * sc;
      const Rw = 422 * sc * 0.95, Rh = 614 * sc * 0.95;
      if (this._simple) {
        // mobile : uniquement le duo de droite (2 silhouettes), centré
        const s2 = Math.min(h * 0.0009, w * 0.0016);
        const rw = 422 * s2, rh = 614 * s2;
        this._sils = [{ img: this._silR, x: w * 0.5 - rw * 0.45, y: gy - rh, w: rw, h: rh, team: 1, depth: 1 }];
        this._hits = [
          { t: 0.4, x: w * 0.5 + rw * 0.35, y: gy - rh * 1.02, side: 1 },   // smash
          { t: 3.2, x: w * 0.16, y: gy - rh * 0.35, side: 0 },
          { t: 5.4, x: w * 0.5 - rw * 0.28, y: gy - rh * 0.32, side: 1 },   // défense
          { t: 7.6, x: w * 0.14, y: gy - rh * 0.75, side: 0 },
        ];
      } else {
        this._sils = [
          { img: this._silL, x: w * 0.5 - Lw - w * 0.115, y: gy - Lh, w: Lw, h: Lh, team: 0, depth: 1 },
          { img: this._silR, x: w * 0.5 + w * 0.105, y: gy - Rh, w: Rw, h: Rh, team: 1, depth: 1 },
        ];
        const L = this._sils[0], R = this._sils[1];
        // points de frappe : raquettes des silhouettes
        this._hits = [
          { t: 0.35, x: R.x + R.w * 0.62, y: R.y + R.h * 0.16, side: 1 },  // smash de la joueuse
          { t: 2.60, x: L.x + L.w * 0.44, y: L.y + L.h * 0.52, side: 0 },  // défense homme 1
          { t: 4.60, x: R.x + R.w * 0.18, y: R.y + R.h * 0.62, side: 1 },  // reprise défenseur
          { t: 6.70, x: L.x + L.w * 0.85, y: L.y + L.h * 0.44, side: 0 },  // drive homme 2
          { t: 8.40, x: R.x + R.w * 0.60, y: R.y + R.h * 0.34, side: 1 },  // remise haute
        ];
      }
      // segments de vol entre frappes (bouclés)
      const hs = this._hits;
      this._segs = hs.map((a, i) => {
        const b = hs[(i + 1) % hs.length];
        const t1 = b.t > a.t ? b.t : b.t + T;
        const smash = i === 0; // après le smash : trajectoire rapide et tendue
        const midY = Math.min(a.y, b.y) - (smash ? 10 : this._h * 0.16);
        return { t0: a.t + 0.02, t1: t1 - 0.02, a, b, midY, smash };
      });
    }

    _shuttleAt(t) {
      t = ((t % T) + T) % T;
      for (const s of this._segs) {
        let tt = t;
        if (s.t1 > T && t < s.t0) tt = t + T;
        if (tt >= s.t0 && tt <= s.t1) {
          let p = (tt - s.t0) / (s.t1 - s.t0);
          p = s.smash ? 1 - (1 - p) * (1 - p) : smooth(p);
          const x = lerp(s.a.x, s.b.x, p);
          const base = lerp(s.a.y, s.b.y, p);
          const y = base - (base - s.midY) * Math.sin(Math.PI * p) * (s.smash ? 0.25 : 1);
          return { x, y, smash: s.smash };
        }
      }
      return { x: this._hits[0].x, y: this._hits[0].y, smash: false };
    }

    _draw(t) {
      const ctx = this._ctx, w = this._w, h = this._h;
      const p = this._par;
      p.x += (p.tx - p.x) * 0.04;
      p.y += (p.ty - p.y) * 0.04;

      ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // halo d'ambiance central
      let g = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.46, Math.max(w, h) * 0.55);
      g.addColorStop(0, 'rgba(41,171,226,0.10)');
      g.addColorStop(0.5, 'rgba(18,48,88,0.07)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';

      // poussière flottante
      for (const d of this._dust) {
        const a = 0.13 + 0.11 * Math.sin(d.ph + t * d.sp * 2 * Math.PI);
        ctx.fillStyle = d.cyan ? 'rgba(41,171,226,' + a + ')' : 'rgba(245,130,32,' + a + ')';
        ctx.beginPath();
        ctx.arc(d.x * w + p.x * 6, d.y * h + p.y * 5, d.size, 0, 6.2832);
        ctx.fill();
      }

      this._drawCourt(ctx, t, p);
      this._drawSils(ctx, t, p);
      this._drawShuttle(ctx, t, p);
      this._drawBursts(ctx, t, p);
      ctx.globalCompositeOperation = 'source-over';
    }

    _line(ctx, x1, y1, x2, y2) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }

    // terrain suggéré en perspective + filet (fixes, parallax léger)
    _drawCourt(ctx, t, p) {
      const w = this._w, h = this._h;
      const ox = p.x * 10, oy = p.y * 7;
      const gy = h * 0.62 + oy;             // ligne de fond proche
      const fy = h * 0.455 + oy;            // ligne de fond lointaine
      const cx = w * 0.5 + ox;
      const nearHalf = w * 0.46, farHalf = w * 0.30;
      const yAt = (k) => lerp(gy, fy, k);
      const halfAt = (k) => lerp(nearHalf, farHalf, k);

      ctx.save();
      ctx.strokeStyle = 'rgba(90,200,255,0.30)';
      ctx.shadowColor = 'rgba(41,171,226,0.7)';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      // lignes transversales
      for (const k of [0, 0.22, 0.5, 0.78, 1]) {
        this._line(ctx, cx - halfAt(k), yAt(k), cx + halfAt(k), yAt(k));
      }
      // lignes de fuite
      for (const u of [-1, -0.72, 0, 0.72, 1]) {
        this._line(ctx, cx + u * nearHalf, gy, cx + u * farHalf, fy);
      }
      ctx.stroke();

      // filet : image extraite de l'affiche de référence (assets/net.png),
      // affichée telle quelle avec un léger glow, base du mât posée au sol
      if (this._net && this._net.complete && this._net.naturalWidth) {
        const ratio = this._net.naturalWidth / this._net.naturalHeight; // ~90/387
        const nh = Math.min(h * 0.34, w * 0.30 / ratio);
        const nw = nh * ratio;
        ctx.shadowColor = 'rgba(41,171,226,0.75)';
        ctx.shadowBlur = 14;
        ctx.globalAlpha = 0.95;
        ctx.drawImage(this._net, cx - nw * 0.5, gy - nh, nw, nh);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    // silhouettes FIXES ; seul le glow pulse à la frappe
    _drawSils(ctx, t, p) {
      for (const s of this._sils) {
        // intensité du pulse : proche d'une frappe de cette équipe
        let pulse = 0;
        for (const hit of this._hits) {
          if (hit.side !== s.team) continue;
          let dt = t - hit.t;
          if (dt < -T / 2) dt += T;
          if (dt > T / 2) dt -= T;
          if (dt > -0.25 && dt < 0.6) pulse = Math.max(pulse, 1 - Math.abs(dt - 0.1) / 0.55);
        }
        const ox = p.x * 20, oy = p.y * 12;
        ctx.save();
        // halo au sol sous la silhouette
        const gx = s.x + s.w / 2 + ox, gyy = s.y + s.h + oy;
        const gg = ctx.createRadialGradient(gx, gyy, 0, gx, gyy, s.w * 0.55);
        gg.addColorStop(0, 'rgba(41,171,226,' + (0.14 + pulse * 0.12) + ')');
        gg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.ellipse(gx, gyy, s.w * 0.55, s.w * 0.13, 0, 0, 6.2832);
        ctx.fill();
        // glow cyan (pulse orange à la frappe)
        ctx.shadowColor = pulse > 0.4 ? 'rgba(245,130,32,' + (0.5 + pulse * 0.5) + ')' : 'rgba(41,171,226,0.75)';
        ctx.shadowBlur = 22 + pulse * 26;
        ctx.globalAlpha = 0.96;
        if (s.img.complete && s.img.naturalWidth) {
          ctx.drawImage(s.img, s.x + ox, s.y + oy, s.w, s.h);
        }
        ctx.restore();
      }
    }

    _drawShuttle(ctx, t, p) {
      const ox = p.x * 14, oy = p.y * 9;
      ctx.save();
      // traînée pointillée
      for (let i = 16; i >= 1; i--) {
        const s = this._shuttleAt(t - i * 0.05);
        const a = (1 - i / 17) * 0.6;
        ctx.fillStyle = 'rgba(255,170,80,' + a + ')';
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, 1.5 + (1 - i / 17) * 1.8, 0, 6.2832);
        ctx.fill();
      }
      // volant filaire : liège + col + jupe de plumes, orienté selon la trajectoire
      const s = this._shuttleAt(t);
      const prev = this._shuttleAt(t - 0.05);
      const ang = Math.atan2(s.y - prev.y, s.x - prev.x); // direction du vol
      const k = Math.max(9, this._h * 0.016);             // taille
      ctx.translate(s.x + ox, s.y + oy);
      ctx.rotate(ang);
      // le liège pointe vers l'avant (+x), la jupe s'ouvre vers l'arrière (-x)
      ctx.shadowColor = 'rgba(245,130,32,0.95)';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'rgba(255,190,120,0.95)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      // plumes (éventail)
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.30;
        ctx.moveTo(k * 0.25, 0);
        ctx.lineTo(-k * 1.15, Math.sin(a) * k * 0.85);
      }
      ctx.stroke();
      // anneaux de la jupe (arrière large, milieu)
      ctx.strokeStyle = 'rgba(255,170,80,0.85)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(-k * 1.15, 0, k * 0.28, k * 0.82, 0, 0, 6.2832);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-k * 0.55, 0, k * 0.16, k * 0.48, 0, 0, 6.2832);
      ctx.stroke();
      // liège plein lumineux
      ctx.fillStyle = 'rgba(255,235,210,0.98)';
      ctx.beginPath();
      ctx.arc(k * 0.42, 0, k * 0.30, 0, 6.2832);
      ctx.fill();
      ctx.strokeStyle = 'rgba(245,130,32,0.95)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(k * 0.42, 0, k * 0.30, 0, 6.2832);
      ctx.stroke();
      ctx.restore();
    }

    // explosion de particules à chaque frappe
    _drawBursts(ctx, t, p) {
      const ox = p.x * 14, oy = p.y * 9;
      ctx.save();
      for (const hit of this._hits) {
        let dt = t - hit.t;
        if (dt < -T / 2) dt += T;
        if (dt < 0 || dt > 0.6) continue;
        const pr = dt / 0.6;
        const R = this._h * 0.03 + pr * this._h * 0.085;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + hit.t * 7;
          const col = i % 3 === 0 ? '245,130,32' : '41,171,226';
          ctx.fillStyle = 'rgba(' + col + ',' + (0.85 * (1 - pr)) + ')';
          ctx.beginPath();
          ctx.arc(hit.x + ox + Math.cos(a) * R, hit.y + oy + Math.sin(a) * R * 0.8, 2.4 * (1 - pr) + 0.6, 0, 6.2832);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  if (!customElements.get('bcn-scene')) customElements.define('bcn-scene', BCNScene);
})();
