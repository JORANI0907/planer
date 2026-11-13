'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'

// 공용 리치텍스트 에디터 (TipTap). 10년계획·생각확장 등에서 재사용.
const EDITOR_STYLES = `
  .tiptap-editor .ProseMirror { outline: none; min-height: 320px; padding: 0; }
  .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder); float: left; color: #adb5bd; pointer-events: none; height: 0;
  }
  .tiptap-editor .ProseMirror h1 { font-size: 1.875rem; font-weight: 700; margin: 1rem 0 0.5rem; }
  .tiptap-editor .ProseMirror h2 { font-size: 1.5rem; font-weight: 600; margin: 0.875rem 0 0.4rem; }
  .tiptap-editor .ProseMirror h3 { font-size: 1.25rem; font-weight: 600; margin: 0.75rem 0 0.3rem; }
  .tiptap-editor .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
  .tiptap-editor .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
  .tiptap-editor .ProseMirror li { margin: 0.2rem 0; }
  .tiptap-editor .ProseMirror blockquote { border-left: 3px solid #e2e8f0; padding-left: 1rem; color: #64748b; margin: 0.75rem 0; }
  .tiptap-editor .ProseMirror code { background: #f1f5f9; border-radius: 4px; padding: 0.1em 0.3em; font-size: 0.875em; }
  .tiptap-editor .ProseMirror pre { background: #1e293b; color: #e2e8f0; border-radius: 8px; padding: 1rem; overflow-x: auto; }
  .tiptap-editor .ProseMirror mark { background: #fef08a; border-radius: 2px; padding: 0.05em 0.1em; }
  .tiptap-editor .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0.25rem; }
  .tiptap-editor .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
  .tiptap-editor .ProseMirror ul[data-type="taskList"] li > label { margin-top: 0.1rem; flex-shrink: 0; }
  .tiptap-editor .ProseMirror ul[data-type="taskList"] li > div { flex: 1; }
  .tiptap-editor .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div { text-decoration: line-through; color: #94a3b8; }
`

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? '내용을 입력하세요...' }),
    ],
    content: value || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  const ToolBtn = ({ onClick, active, title, children }: {
    onClick: () => void; active?: boolean; title: string; children: React.ReactNode
  }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
        active ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )

  return (
    <>
      <style>{EDITOR_STYLES}</style>
      {editor && (
        <div className="flex flex-wrap items-center gap-0.5 mb-3 pb-2 border-b border-gray-100 sticky top-0 bg-white z-10">
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="제목 1">H1</ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="제목 2">H2</ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="제목 3">H3</ToolBtn>
          <span className="w-px h-5 bg-gray-200 mx-1" />
          <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="굵게"><b>B</b></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="기울임"><i>I</i></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="밑줄"><u>U</u></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="취소선"><s>S</s></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="형광펜">🖊</ToolBtn>
          <span className="w-px h-5 bg-gray-200 mx-1" />
          <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="글머리 기호">• 목록</ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="번호 목록">1. 목록</ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="체크 목록">☑ 할일</ToolBtn>
          <span className="w-px h-5 bg-gray-200 mx-1" />
          <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="인용문">&ldquo;</ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="코드">{'<>'}</ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="코드 블록">{'```'}</ToolBtn>
          <span className="w-px h-5 bg-gray-200 mx-1" />
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="실행 취소">↩</ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="다시 실행">↪</ToolBtn>
        </div>
      )}
      <div className="tiptap-editor">
        <EditorContent editor={editor} className="text-gray-800 text-base leading-relaxed" />
      </div>
    </>
  )
}
