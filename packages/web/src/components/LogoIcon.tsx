export function LogoIcon({ className = "" }: { className?: string }) {
  return (
    <svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 512 512"
  width="100%"
  height="100%"
  className={className}
>
  <defs>
    <style dangerouslySetInnerHTML={{ __html: `@keyframes pulse-heart { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.95; filter: drop-shadow(0 0 8px #d76f32); } } @keyframes data-stream { to { stroke-dashoffset: -40; } } @keyframes subtle-float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } } .pulse-element { transform-origin: 256px 320px; animation: pulse-heart 1s ease-in-out infinite; } .flow-element { stroke-dasharray: 8 6; animation: data-stream 1.5s linear infinite; } .float-headset { transform-origin: 256px 130px; animation: subtle-float 4s ease-in-out infinite; }` }} />
    
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    
    <pattern id="canvas-grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <circle
        cx="24"
        cy="24"
        r="1"
        fill="#50331c"
        opacity="0.12"
      />
    </pattern>
  
    

    

    <clipPath id="app-icon-clip">
      <rect width="512" height="512" rx="115" />
    </clipPath>
</defs>
  <g clipPath="url(#app-icon-clip)">
    <rect width="512" height="512" fill="#ffffff" />
<rect width="512" height="512" fill="#ffffff" />

  
  


  <rect width="100%" height="100%" fill="url(#canvas-grid)" />

  {/* Abstract Schema Grid Background accents */}
  <g opacity="0.15">
    <path d="M 40 100 L 120 100 M 100 40 L 100 120" stroke="#50331c" strokeWidth="2" strokeDasharray="4 4" />
    <path d="M 400 420 L 480 420 M 420 380 L 420 460" stroke="#50331c" strokeWidth="2" strokeDasharray="4 4" />
  </g>

  {/* Binaural Headset Arch */}
  <g className="float-headset">
    <circle cx="180" cy="80" r="11" fill="#d76f32" />
    <circle cx="332" cy="80" r="11" fill="#d76f32" />

    <path
      d="M 180 91 C 180 150, 210 170, 256 170"
      fill="none"
      stroke="#50331c"
      strokeWidth="10"
      strokeLinecap="round"
    />
    <path
      d="M 332 91 C 332 150, 302 170, 256 170"
      fill="none"
      stroke="#50331c"
      strokeWidth="10"
      strokeLinecap="round"
    />

    {/* Tension Support Bracket */}
    <path
      d="M 198 125 C 220 135, 292 135, 314 125"
      fill="none"
      stroke="#d76f32"
      strokeWidth="4"
      strokeLinecap="round"
    />

    {/* Junction Box */}
    <rect x="245" y="163" width="14" height="24" rx="3" fill="#50331c" />
  </g>

  {/* Left Entity Database Schema Table */}
  <g>
    {/* Table Body Box */}
    <rect
      x="60"
      y="235"
      width="120"
      height="170"
      rx="12"
      fill="#ffffff"
      stroke="#50331c"
      strokeWidth="4"
      style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))", transition: "fill 0.3s" }}
    />
    {/* Table Orange Header */}
    <path
      d="M 60 247 A 12 12 0 0 1 72 235 L 168 235 A 12 12 0 0 1 180 247 L 180 275 L 60 275 Z"
      fill="#d76f32"
    />
    {/* Mock UI Elements in Table Header */}
    <rect x="76" y="249" width="50" height="10" rx="5" fill="#ffffff" />
    <circle cx="152" cy="254" r="5" fill="#ffffff" />

    {/* Table Rows */}
    {/* PK Row */}
    <circle cx="82" cy="300" r="4.5" fill="#d76f32" />
    <rect x="96" y="295" width="54" height="10" rx="5" fill="#50331c" opacity="0.35" />

    {/* Attribute 2 */}
    <rect x="78" y="322" width="9" height="9" rx="2" fill="#50331c" opacity="0.5" />
    <rect x="96" y="322" width="64" height="10" rx="5" fill="#50331c" opacity="0.2" />

    {/* Attribute 3 */}
    <rect x="78" y="349" width="9" height="9" rx="2" fill="#50331c" opacity="0.5" />
    <rect x="96" y="349" width="46" height="10" rx="5" fill="#50331c" opacity="0.2" />

    {/* Attribute 4 */}
    <rect x="78" y="376" width="9" height="9" rx="2" fill="#50331c" opacity="0.5" />
    <rect x="96" y="376" width="58" height="10" rx="5" fill="#50331c" opacity="0.15" />
  </g>

  {/* Right Entity Database Schema Table */}
  <g>
    {/* Table Body Box */}
    <rect
      x="332"
      y="235"
      width="120"
      height="170"
      rx="12"
      fill="#ffffff"
      stroke="#50331c"
      strokeWidth="4"
      style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))", transition: "fill 0.3s" }}
    />
    {/* Table Espresso Header */}
    <path
      d="M 332 247 A 12 12 0 0 1 344 235 L 440 235 A 12 12 0 0 1 452 247 L 452 275 L 332 275 Z"
      fill="#50331c"
      stroke="none"
      strokeWidth="0"
    />
    {/* Mock UI Elements in Table Header */}
    <rect x="348" y="249" width="50" height="10" rx="5" fill="#ffffff" />
    <circle cx="424" cy="254" r="5" fill="#d76f32" />

    {/* Table Rows */}
    {/* PK Row */}
    <circle cx="354" cy="300" r="4.5" fill="#d76f32" />
    <rect x="368" y="295" width="48" height="10" rx="5" fill="#50331c" opacity="0.35" />

    {/* Attribute 2 */}
    <rect x="350" y="322" width="9" height="9" rx="2" fill="#50331c" opacity="0.5" />
    <rect x="368" y="322" width="58" height="10" rx="5" fill="#50331c" opacity="0.2" />

    {/* Attribute 3 */}
    <rect x="350" y="349" width="9" height="9" rx="2" fill="#50331c" opacity="0.5" />
    <rect x="368" y="349" width="62" height="10" rx="5" fill="#50331c" opacity="0.2" />

    {/* Attribute 4 */}
    <rect x="350" y="376" width="9" height="9" rx="2" fill="#50331c" opacity="0.5" />
    <rect x="368" y="376" width="40" height="10" rx="5" fill="#50331c" opacity="0.15" />
  </g>

  {/* ERD Cardinality Connection Relationship Line */}
  <g>
    {/* Background Static Line */}
    <line
      x1="180"
      y1="320"
      x2="332"
      y2="320"
      stroke="#d76f32"
      strokeWidth="4"
      
    />

    {/* Active Animated Flow Element */}
    
    <line
      x1="180"
      y1="320"
      x2="332"
      y2="320"
      stroke="#ffffff"
      strokeWidth="4"
      className="flow-element"
      opacity="0.8"
    />

    {/* Cardinality Annotation: 'One' on the Left */}
    <path
      d="M 194 310 L 194 330 M 201 310 L 201 330"
      stroke="#d76f32"
      strokeWidth="3"
      strokeLinecap="round"
    />

    {/* Cardinality Annotation: 'Many' (Crow's Foot) on the Right */}
    <path
      d="M 314 310 L 328 320 L 314 330 M 322 310 L 322 330"
      stroke="#d76f32"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
  </g>

  {/* Stethoscope Flexible Diagnostic Tube */}
  <path
    d="M 256 185 L 256 205 L 290 205 L 290 255 L 222 255 L 222 225 L 256 225 L 256 274"
    fill="none"
    stroke="#d76f32"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
    filter="url(#glow)"
  />

  {/* Active Electrocardiogram Diagnostics Chestpiece */}
  <g className="pulse-element">
    {/* Stem Connector */}
    <rect x="249" y="271" width="14" height="16" rx="2" fill="#50331c" />

    {/* External Metallic Ring */}
    <circle
      cx="256"
      cy="320"
      r="38"
      fill="#ffffff"
      stroke="#50331c"
      strokeWidth="5"
      style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.25))" }}
    />

    {/* Heartbeat Sensor core */}
    <circle cx="256" cy="320" r="29" fill="#d76f32" />

    {/* Electrocardiogram Pulse Signature Wave */}
    <path
      d="M 238 320 L 244 320 L 248 308 L 254 332 L 259 314 L 263 320 L 274 320"
      fill="none"
      stroke="#ffffff"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Diagnostic Glass Core Cover */}
    <circle cx="256" cy="320" r="8" fill="#ffffff" opacity="0.3" />
  </g>

  </g>
</svg>

  );
}
