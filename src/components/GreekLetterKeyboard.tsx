interface GreekLetterKeyboardProps {
  readonly compact?: boolean;
  onInsert(letter: string): void;
}

const GREEK_LETTERS = [
  "\u03b1",
  "\u03b2",
  "\u03b3",
  "\u03b4",
  "\u03b5",
  "\u03b6",
  "\u03b7",
  "\u03b8",
  "\u03b9",
  "\u03ba",
  "\u03bb",
  "\u03bc",
  "\u03bd",
  "\u03be",
  "\u03bf",
  "\u03c0",
  "\u03c1",
  "\u03c3",
  "\u03c4",
  "\u03c5",
  "\u03c6",
  "\u03c7",
  "\u03c8",
  "\u03c9",
] as const;

function GreekLetterKeyboard({
  compact = false,
  onInsert,
}: GreekLetterKeyboardProps) {
  return (
    <div
      aria-label="Greek letters"
      className={
        compact ? "greek-letter-keyboard compact" : "greek-letter-keyboard"
      }
    >
      {GREEK_LETTERS.map((letter) => (
        <button
          key={letter}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onInsert(letter);
          }}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          {letter}
        </button>
      ))}
    </div>
  );
}

export default GreekLetterKeyboard;
