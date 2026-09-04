import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useInView } from '../deck/useInView';

export type TableColumn =
  | string
  | { label: string; align?: 'left' | 'right' | 'center' };
export type TableCell = string | number | ReactNode;

export default function Table({
  columns,
  rows,
  highlightCol,
  highlightRow,
  caption,
}: {
  columns: TableColumn[];
  rows: TableCell[][];
  highlightCol?: number;
  highlightRow?: number;
  caption?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  const reduce = useReducedMotion();

  const align = (c: TableColumn) =>
    typeof c === 'string' ? undefined : c.align;
  const alignClass = (i: number) => {
    const a = align(columns[i]);

    return a ? ` al-${a[0]}` : '';
  };

  return (
    <div ref={ref}>
      <div className="dtable mat">
        <table>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={i}
                  className={
                    (i === highlightCol ? 'hl-col' : '') + alignClass(i)
                  }
                >
                  {typeof c === 'string' ? c : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <motion.tr
                key={ri}
                className={ri === highlightRow ? 'hl-row' : undefined}
                initial={reduce ? false : { opacity: 0 }}
                animate={inView ? { opacity: 1 } : undefined}
                transition={{
                  duration: 0.4,
                  delay: 0.08 + ri * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {r.map((cell, ci) => (
                  <td
                    key={ci}
                    className={
                      (ci === highlightCol ? 'hl-col' : '') + alignClass(ci)
                    }
                  >
                    {cell}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && (
        <div
          className="foot dtable-caption"
          style={{ maxWidth: 880, marginInline: 'auto' }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
