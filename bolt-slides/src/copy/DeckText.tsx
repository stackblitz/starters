import { getPath, useStore } from '../data/store';
import { useSlide } from './SlideScope';
import { renderRich } from './rich';
import { deckPathProps, pipeSegment } from './deckPath';

/** Authored deck copy. Stamps `data-deck-path` for visual-edit persist. */
export default function T({
  path,
  block,
  pipeIndex,
}: {
  path: string;
  placeholder?: string;
  block?: boolean;
  pipeIndex?: number;
}) {
  const { slideId, slide: ctxSlide } = useSlide();
  const storeValue: string | null = useStore((s) => {
    const slide = s.slides.find((sl) => sl.id === slideId);

    return slide ? String(getPath(slide.props, path) ?? '') : null;
  });
  const rawValue: string =
    storeValue ?? String(getPath(ctxSlide?.props ?? {}, path) ?? '');
  const value: string =
    pipeIndex != null ? pipeSegment(rawValue, pipeIndex) : rawValue;
  const pathOpts = pipeIndex != null ? { pipeIndex } : undefined;
  const blockStyle = block ? { display: 'block' as const } : undefined;

  return (
    <span style={blockStyle} {...deckPathProps(slideId, path, pathOpts)}>
      {renderRich(value)}
    </span>
  );
}
