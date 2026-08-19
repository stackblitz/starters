/* Editing context — layout renderers are shared by the editor canvas,
   sidebar thumbnails, present mode, PDF export and layout previews. Only the
   editor canvas turns `editable` on; T (EditableText) then becomes
   contentEditable. `slide` is the row being rendered — T falls back to it
   when the id isn't in the store (e.g. add-slide previews). */
import { createContext, useContext } from 'react'
import type { SlideData } from '../data/types'

export interface EditCtxValue {
  editable: boolean
  slideId: string | null
  slide?: SlideData | null
}

export const EditCtx = createContext<EditCtxValue>({ editable: false, slideId: null, slide: null })
export const useEdit = () => useContext(EditCtx)
