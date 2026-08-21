/* One comparison-matrix cell in the Edit-data sheet: booleans are ✓/✗
   chips that TOGGLE on click; "abc" switches the cell to free text and
   the ✓ button switches it back. */
export default function CmpCell({
  value,
  onChange,
}: {
  value: boolean | string;
  onChange: (v: boolean | string) => void;
}) {
  if (typeof value === 'boolean') {
    return (
      <span className="cmp-cellwrap">
        <button
          className={'cmp-tgl' + (value ? ' yes' : ' no')}
          title="Toggle check"
          onClick={() => onChange(!value)}
        >
          {value ? '✓' : '✗'}
        </button>
        <button
          className="cmp-mode"
          title="Switch to text"
          onClick={() => onChange('')}
        >
          abc
        </button>
      </span>
    );
  }
  return (
    <span className="cmp-cellwrap">
      <input
        value={value}
        placeholder="text"
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        className="cmp-mode"
        title="Switch to ✓/✗ chip"
        onClick={() => onChange(true)}
      >
        ✓
      </button>
    </span>
  );
}
