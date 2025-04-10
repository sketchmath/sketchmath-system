import { preprocessLaTeX } from "@/lib/utils";
import { InterfaceContext } from "@/pages/interface";
import { useContext, useEffect, useState, useRef } from "react";
import { track, useEditor } from "tldraw"
import 'katex/dist/katex.min.css';
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export const ContextToolbarComponent = track(() => {
  const { annotationToExplanationMap } = useContext(InterfaceContext);
  const editor = useEditor();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // All shape and selection calculations
  const currentlySelectedShapes = editor.getSelectedShapes();
  const showToolbar = editor.isIn('select.idle') && (currentlySelectedShapes.length === 1 && currentlySelectedShapes[0].id.startsWith('shape:annotated'));
  const selectionRotatedPageBounds = editor.getSelectionRotatedPageBounds();

  // Measure the toolbar after it renders
  useEffect(() => {
    if (toolbarRef.current && showToolbar && selectionRotatedPageBounds) {
      const { width, height } = toolbarRef.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
  }, [annotationToExplanationMap, currentlySelectedShapes, showToolbar, selectionRotatedPageBounds]);

  // Early return AFTER all hooks have been called
  if (!showToolbar || !selectionRotatedPageBounds) {
    return null;
  }

  // Calculate the position for the toolbar
  const pageCoordinates = editor.pageToViewport(selectionRotatedPageBounds.point);

  // Position the toolbar centered horizontally and above the shape
  const toolbarStyle = {
    position: 'absolute' as const,
    pointerEvents: 'all' as const,
    // Position above the shape by the height of the toolbar plus some padding
    top: pageCoordinates.y - dimensions.height - 8,
    // Center horizontally relative to the shape
    left: pageCoordinates.x + (selectionRotatedPageBounds.width * editor.getZoomLevel() / 2) - (dimensions.width / 2),
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  const currentExplanation = currentlySelectedShapes[0] && annotationToExplanationMap
    ? annotationToExplanationMap[currentlySelectedShapes[0].id]
    : 'No explanation available';

  return (
    <div
      ref={toolbarRef}
      style={toolbarStyle}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          borderRadius: 8,
          display: 'flex',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1)',
          background: 'var(--color-panel)',
          width: 'fit-content',
          maxWidth: '300px', // Prevent extremely wide tooltips
          alignItems: 'center',
          padding: `${Math.floor(4 * editor.getZoomLevel())}px ${Math.floor(8 * editor.getZoomLevel())}px`,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} className="whitespace-pre-line text-base">
          {preprocessLaTeX(currentExplanation)}
        </Markdown>
      </div>
    </div>
  );
});