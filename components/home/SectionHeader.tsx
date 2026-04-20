type Props = {
  title: string;
  highlight: string;
  subtitle?: string;
  center?: boolean;
};

export default function SectionHeader({ title, highlight, subtitle, center = false }: Props) {
  return (
    <div className={center ? "text-center space-y-2" : "space-y-2"}>
      <h2 className="text-primary text-3xl sm:text-4xl font-semibold">
        {title}{" "}
        <span className="text-secondary">{highlight}</span>
      </h2>
      {subtitle && (
        <p className="text-muted-foreground font-light text-base">{subtitle}</p>
      )}
    </div>
  );
}
