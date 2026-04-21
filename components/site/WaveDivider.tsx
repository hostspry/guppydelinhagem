export default function WaveDivider({ fill = "#07366A", flip = false }: { fill?: string; flip?: boolean }) {
  return (
    <div className="w-full overflow-hidden leading-[0]" style={flip ? { transform: "scaleY(-1)" } : undefined}>
      <svg
        viewBox="0 0 1440 60"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="w-full h-[60px] block"
      >
        <path
          d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}
