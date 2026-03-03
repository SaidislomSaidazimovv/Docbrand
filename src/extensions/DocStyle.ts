import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        docStyle: {
            setDocStyle: (style: string) => ReturnType;
            unsetDocStyle: () => ReturnType;
        };
    }
}

const DocStyle = Node.create({
    name: 'docStyle',
    group: 'block',
    content: 'inline*',
    defining: true,

    addAttributes() {
        return {
            style: {
                default: 'title',
                parseHTML: (el: HTMLElement) => el.getAttribute('data-doc-style'),
                renderHTML: (attrs: Record<string, unknown>) => ({
                    'data-doc-style': attrs.style,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'p[data-doc-style]',
                getAttrs: (el) => ({
                    style: (el as HTMLElement).getAttribute('data-doc-style'),
                }),
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['p', mergeAttributes(HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setDocStyle: (styleType: string) => ({ commands }) => {
                return commands.setNode('docStyle', { style: styleType });
            },
            unsetDocStyle: () => ({ commands }) => {
                return commands.setNode('paragraph');
            },
        };
    },
});

export default DocStyle;
