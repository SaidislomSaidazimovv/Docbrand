/**
 * Slash Commands Extension for TipTap
 * Enables "/" commands like Notion for inserting blocks
 */

import { Extension } from '@tiptap/core';
import { Editor, Range } from '@tiptap/core';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';

export interface CommandItem {
    title: string;
    description: string;
    icon: string;
    command: (props: { editor: Editor; range: Range }) => void;
}

export const SLASH_COMMANDS: CommandItem[] = [
    {
        title: 'Heading 1',
        description: 'Large section heading',
        icon: 'H1',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
        },
    },
    {
        title: 'Heading 2',
        description: 'Medium section heading',
        icon: 'H2',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
        },
    },
    {
        title: 'Paragraph',
        description: 'Plain text block',
        icon: '¶',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setParagraph().run();
        },
    },
    {
        title: 'Bullet List',
        description: 'Unordered list of items',
        icon: '•',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
    },
    {
        title: 'Numbered List',
        description: 'Ordered list of items',
        icon: '1.',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
    },
    {
        title: 'Quote',
        description: 'Block quote for citations',
        icon: '"',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
    },
    {
        title: 'Code Block',
        description: 'Monospace code block',
        icon: '</>',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
    },
    {
        title: 'Divider',
        description: 'Horizontal line separator',
        icon: '—',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
    },
    {
        title: 'To-do List',
        description: 'Track tasks with checklist',
        icon: '☑',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleTaskList().run();
        },
    },
    {
        title: 'Table',
        description: 'Add a table with rows and columns',
        icon: '▦',
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        },
    },
    {
        title: 'Emoji',
        description: 'Insert an emoji',
        icon: '😀',
        command: ({ editor, range }) => {
            // Insert a placeholder emoji, user can replace with their choice
            editor.chain().focus().deleteRange(range).insertContent('😀').run();
        },
    },
];

interface CommandProps {
    editor: Editor;
    range: Range;
    props: CommandItem;
}

export const SlashCommands = Extension.create({
    name: 'slashCommands',

    addOptions() {
        return {
            suggestion: {
                char: '/',
                command: ({ editor, range, props }: CommandProps) => {
                    props.command({ editor, range });
                },
            } as Partial<SuggestionOptions>,
        };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ];
    },
});
