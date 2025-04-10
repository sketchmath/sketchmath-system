import { TldrawUiButton, track, useEditor } from "tldraw"
import { Trash2 } from "lucide-react";

export const DeleteAnnotationsPanel = track(() => {
  const editor = useEditor();

  const clearAnnotations = () => {
    if (!editor) return;

    editor.run(() => {
      editor.getCurrentPageShapes().forEach((shape) => {
        if (shape.id.startsWith("shape:annotated") || shape.id.startsWith('shape:annotation')) {
          editor.deleteShape(shape.id);
        }
      });
    });
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-low)',
      }}
      className="p-1 rounded-br-lg rounded-bl-lg"
    >
      <TldrawUiButton type="danger" onClick={clearAnnotations} className="flex items-center space-x-2">
        <Trash2 className="w-5" />
        <p className="text-sm">Clear Annotations</p>
      </TldrawUiButton>
    </div>
  )
});
