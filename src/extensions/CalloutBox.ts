import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        calloutBox: {
            setCalloutBox: (type?: string) => ReturnType;
            unsetCalloutBox: () => ReturnType;
        };
    }
}

const CalloutBox = Node.create({
    name: 'calloutBox',
    group: 'block',
    content: 'block+',
    defining: true,

    addAttributes() {
        return {
            type: {
                default: 'info',
                parseHTML: (el: HTMLElement) => el.getAttribute('data-callout-type') || 'info',
                renderHTML: (attrs: Record<string, unknown>) => ({
                    'data-callout-type': attrs.type,
                }),
            },
            bgColor: {
                default: null,
                parseHTML: (el: HTMLElement) => el.getAttribute('data-bg-color'),
                renderHTML: (attrs: Record<string, unknown>) => {
                    if (!attrs.bgColor) return {};
                    return { 'data-bg-color': attrs.bgColor };
                },
            },
            borderColor: {
                default: null,
                parseHTML: (el: HTMLElement) => el.getAttribute('data-border-color'),
                renderHTML: (attrs: Record<string, unknown>) => {
                    if (!attrs.borderColor) return {};
                    return { 'data-border-color': attrs.borderColor };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-callout-type]',
            },
        ];
    },

    renderHTML({ HTMLAttributes, node }) {
        const attrs = mergeAttributes(HTMLAttributes);
        const style: string[] = [];
        if (node.attrs.bgColor) style.push(`background: ${node.attrs.bgColor}`);
        if (node.attrs.borderColor) style.push(`border-color: ${node.attrs.borderColor}`, `border-left-color: ${node.attrs.borderColor}`);
        if (style.length) attrs.style = style.join('; ');
        return ['div', attrs, 0];
    },

    addCommands() {
        return {
            setCalloutBox: (type = 'info') => ({ state, chain }) => {
                const { from, to } = state.selection;

                if (from !== to) {
                    return chain().wrapIn('calloutBox', { type }).run();
                }

                return chain().insertContent({
                    type: 'calloutBox',
                    attrs: { type },
                    content: [{ type: 'paragraph' }],
                }).run();
            },
            unsetCalloutBox: () => ({ commands }) => {
                return commands.lift('calloutBox');
            },
        };
    },
});

export default CalloutBox;
