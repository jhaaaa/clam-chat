interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const QUICK_REACTIONS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F525}"];

export default function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 shadow-lg">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="rounded-full p-1 text-lg transition-transform hover:scale-125"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
