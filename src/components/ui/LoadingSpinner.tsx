export default function LoadingSpinner({
  size = "md",
  label,
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-3",
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-gray-300 border-t-indigo-600`}
      />
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  );
}
