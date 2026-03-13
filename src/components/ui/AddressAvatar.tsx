interface AddressAvatarProps {
  address: string;
  size?: number;
}

function colorsFromAddress(address: string): [string, string, string] {
  // Use address bytes to derive 3 deterministic HSL colors
  const hex = address.replace("0x", "").toLowerCase();
  const h1 = parseInt(hex.slice(0, 4), 16) % 360;
  const h2 = parseInt(hex.slice(4, 8), 16) % 360;
  const h3 = parseInt(hex.slice(8, 12), 16) % 360;
  return [
    `hsl(${h1}, 65%, 65%)`,
    `hsl(${h2}, 55%, 55%)`,
    `hsl(${h3}, 60%, 70%)`,
  ];
}

export default function AddressAvatar({ address, size = 32 }: AddressAvatarProps) {
  const [c1, c2, c3] = colorsFromAddress(address);
  // Derive angle from address for variety
  const angle = parseInt(address.slice(2, 6), 16) % 360;

  return (
    <div
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(${angle}deg, ${c1}, ${c2}, ${c3})`,
      }}
    />
  );
}
