// netlify/functions/vehicle-render.js
// Deterministic "representative model render" (SVG) from make/model/year (+ body type)
// Includes a built-in sketch filter + provenance line.
// Always returns *something*: sketch render OR classy silhouette fallback.

export default async (req) => {
  try {
    const u = new URL(req.url);
    const make = clean(u.searchParams.get("make"));
    const model = clean(u.searchParams.get("model"));
    const year = clean(u.searchParams.get("year"));
    const bodyClass = clean(u.searchParams.get("bodyClass"));
    const vehicleType = clean(u.searchParams.get("vehicleType"));

    const label = [year, make, model].filter(Boolean).join(" ").trim() || "Vehicle";
    const kind = silhouetteKind(bodyClass, vehicleType, make, model);

    // Deterministic seed from decoded identity
    const seed = hash32(`${year}|${make}|${model}|${bodyClass}|${vehicleType}`) || 1337;

    const svg = buildSketchSVG({ label, kind, seed });

    return new Response(svg, {
      status: 200,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=86400",
      },
    });
  } catch (e) {
    // Hard fallback: simple silhouette SVG
    const svg = buildSketchSVG({ label: "Vehicle", kind: "sedan", seed: 42, forceFallback: true });
    return new Response(svg, {
      status: 200,
      headers: { "content-type": "image/svg+xml; charset=utf-8" },
    });
  }
};

function clean(x) {
  return String(x ?? "").trim();
}

function silhouetteKind(bodyClass, vehicleType, make, model) {
  const s = `${bodyClass} ${vehicleType} ${make} ${model}`.toLowerCase();

  if (s.includes("pickup") || s.includes("truck")) return "truck";
  if (s.includes("sport utility") || s.includes("suv") || s.includes("utility")) return "suv";
  if (s.includes("hatchback") || s.includes("hatch")) return "hatch";
  if (s.includes("coupe")) return "coupe";

  return "sedan";
}

function buildSketchSVG({ label, kind, seed, forceFallback = false }) {
  // Canvas
  const W = 980, H = 520;

  // Deterministic "personality" knobs (subtle, premium)
  const r = mulberry32(seed);
  const stance = lerp(0.92, 1.06, r());         // wheelbase feel
  const roof = lerp(0.92, 1.08, r());           // roof height feel
  const nose = lerp(0.90, 1.10, r());           // front length
  const tail = lerp(0.90, 1.10, r());           // rear length
  const belt = lerp(0.92, 1.06, r());           // beltline contour
  const ink = lerp(0.72, 0.88, r());            // line intensity

  // Build main body path from archetype points
  const archetype = getArchetype(kind);

  // If forceFallback, we'll keep it clean silhouette (no sketch noise)
  const sketchOn = !forceFallback;

  // Scale base archetype with deterministic knobs
  const bodyPath = deformPath(archetype.body, { stance, roof, nose, tail, belt });
  const glassPath = deformPath(archetype.glass, { stance, roof, nose, tail, belt });

  const wheelA = archetype.wheelA;
  const wheelB = archetype.wheelB;

  // Small deterministic "hand-drawn" offset (barely noticeable, tasteful)
  const jitter = (n) => (sketchOn ? (r() - 0.5) * n : 0);

  const prov = `Representative model render · Derived from decoded make/model/year · Not a photo of your exact vehicle`;

  // SVG with built-in sketch filter
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="rgba(255,255,255,.06)"/>
      <stop offset="1" stop-color="rgba(255,255,255,.02)"/>
    </linearGradient>

    ${sketchOn ? `
    <!-- Sketch filter: subtle paper + ink wobble (premium, not cartoon) -->
    <filter id="sketch" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="${seed % 997}" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" xChannelSelector="R" yChannelSelector="G" result="wobble"/>
      <feColorMatrix in="wobble" type="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 1 0" />
    </filter>

    <filter id="paper" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="${(seed + 7) % 997}" result="grain"/>
      <feColorMatrix in="grain" type="matrix"
        values="0 0 0 0 0.9
                0 0 0 0 0.9
                0 0 0 0 0.9
                0 0 0 .20 0" />
    </filter>` : ``}
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" rx="24" fill="url(#bg)"/>

  <!-- Top label -->
  <text x="34" y="56" fill="rgba(255,255,255,.70)" font-family="Arial, system-ui" font-size="15" font-weight="800" letter-spacing=".10em">
    VINVOYANT · VEHICLE FORM
  </text>
  <text x="34" y="82" fill="rgba(255,255,255,.55)" font-family="Arial, system-ui" font-size="13">
    ${esc(label)}
  </text>

  <!-- Vehicle sketch group -->
  <g transform="translate(${jitter(1.5)},${jitter(1.5)})" ${sketchOn ? `filter="url(#sketch)"` : ``}>
    <!-- Body silhouette base -->
    <path d="${bodyPath}" fill="rgba(255,255,255,.10)" stroke="rgba(255,255,255,${(0.32 * ink).toFixed(3)})" stroke-width="2.2" />

    <!-- Glass / cabin -->
    <path d="${glassPath}" fill="rgba(255,255,255,.08)" stroke="rgba(170,210,255,${(0.26 * ink).toFixed(3)})" stroke-width="2" />

    <!-- Wheels -->
    <g>
      ${wheelSvg(wheelA.cx, wheelA.cy, wheelA.r, ink)}
      ${wheelSvg(wheelB.cx, wheelB.cy, wheelB.r, ink)}
    </g>

    <!-- Ground line -->
    <path d="M150 394 H 830" stroke="rgba(255,255,255,0.10)" stroke-width="2" stroke-linecap="round"/>
  </g>

  <!-- Paper grain overlay -->
  ${sketchOn ? `<rect x="0" y="0" width="${W}" height="${H}" rx="24" filter="url(#paper)" opacity="0.25"/>` : ``}

  <!-- Provenance (laser-clean) -->
  <g>
    <text x="34" y="${H - 26}" fill="rgba(255,255,255,.46)" font-family="Arial, system-ui" font-size="12">
      ${esc(prov)}
    </text>
  </g>
</svg>`;
}

function wheelSvg(cx, cy, r, ink) {
  const rim = r * 0.62;
  const hub = r * 0.32;
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,${(0.22 * ink).toFixed(3)})" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${rim}" fill="rgba(0,0,0,.30)" stroke="rgba(255,255,255,${(0.12 * ink).toFixed(3)})" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${hub}" fill="rgba(255,255,255,.08)" stroke="rgba(170,210,255,${(0.10 * ink).toFixed(3)})" stroke-width="1.6"/>
  `;
}

function getArchetype(kind) {
  // Paths are built in a "premium silhouette" style (clean, not cartoon).
  // All share same wheel positions so it looks stable.
  const wheels = {
    wheelA: { cx: 270, cy: 360, r: 38 },
    wheelB: { cx: 740, cy: 360, r: 38 },
  };

  const A = {
    sedan: {
      ...wheels,
      body: `M150 330
             C170 275 230 230 310 220
             L430 190
             C490 175 560 175 620 190
             L740 220
             C820 230 880 275 900 330
             L915 360
             C920 375 910 392 892 392
             H158
             C140 392 130 375 135 360
             Z`,
      glass: `M300 260
              C320 230 350 215 390 205
              L470 185
              C500 178 530 178 560 185
              L640 205
              C680 215 710 230 730 260
              L745 295
              H285
              Z`,
    },
    suv: {
      ...wheels,
      body: `M140 330
             C160 268 225 220 320 210
             L460 192
             C510 185 570 185 620 192
             L760 210
             C855 220 920 268 940 330
             L958 362
             C966 377 956 394 936 394
             H144
             C124 394 114 377 122 362
             Z`,
      glass: `M290 262
              C310 224 350 205 410 198
              L485 190
              C510 187 540 187 565 190
              L650 198
              C710 205 750 224 770 262
              L780 296
              H280
              Z`,
    },
    truck: {
      wheelA: { cx: 250, cy: 360, r: 38 },
      wheelB: { cx: 640, cy: 360, r: 38 },
      body: `M140 340
             C155 285 205 240 270 225
             L430 190
             C470 182 510 182 550 190
             L630 207
             C680 218 710 250 720 290
             L735 340
             H920
             C940 340 950 360 944 378
             C938 392 924 400 908 400
             H140
             C124 400 110 392 104 378
             C98 360 108 340 128 340
             Z`,
      glass: `M300 270
              C315 235 345 215 385 206
              L465 188
              C495 182 525 182 555 188
              L595 198
              C620 205 640 225 650 250
              L660 290
              H285
              Z`,
    },
    hatch: {
      ...wheels,
      body: `M150 332
             C170 270 235 228 330 218
             L470 196
             C520 188 570 188 620 196
             L740 218
             C825 235 875 280 895 332
             L912 360
             C920 374 910 392 892 392
             H158
             C140 392 130 374 138 360
             Z`,
      glass: `M310 266
              C330 228 370 210 430 202
              L500 192
              C520 190 540 190 560 192
              L645 202
              C700 210 735 228 755 266
              L768 296
              H295
              Z`,
    },
    coupe: {
      ...wheels,
      body: `M160 334
             C190 270 260 230 350 218
             L470 194
             C520 184 570 184 620 194
             L730 218
             C800 235 850 275 875 334
             L892 360
             C902 374 892 392 874 392
             H166
             C148 392 138 374 148 360
             Z`,
      glass: `M340 270
              C370 232 420 214 480 206
              L525 200
              C540 198 555 198 570 200
              L640 210
              C690 218 725 236 745 270
              L756 296
              H330
              Z`,
    },
  };

  return A[kind] || A.sedan;
}

function deformPath(path, { stance, roof, nose, tail, belt }) {
  // We keep deformation subtle and "designerly."
  // Implementation: adjust a few key coordinate bands by heuristics.
  // This avoids complex path parsing while still producing stable variations.

  // Convert numeric tokens in the path and remap with simple rules.
  // Rule bands:
  // - x near left: affected by nose
  // - x near right: affected by tail
  // - y above ~240: affected by roof
  // - mid y band: beltline contour
  const nums = path.match(/-?\d+(\.\d+)?/g) || [];
  let i = 0;

  const rebuilt = path.replace(/-?\d+(\.\d+)?/g, (m) => {
    const n = parseFloat(m);
    const isX = (i % 2 === 0);
    const val = n;

    let out = val;

    if (isX) {
      // wheelbase stance: expand/contract from center
      const center = 490;
      out = center + (val - center) * stance;

      // front nose / rear tail accents
      if (val < 340) out = center + (out - center) * nose;
      if (val > 640) out = center + (out - center) * tail;
    } else {
      // roof height: only affect upper region (lower y values)
      if (val < 260) out = 260 + (val - 260) * roof;

      // beltline: mid contour nudge
      if (val >= 260 && val <= 320) out = 290 + (val - 290) * belt;
    }

    i++;
    return out.toFixed(1);
  });

  return rebuilt;
}

function hash32(str) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0);
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
