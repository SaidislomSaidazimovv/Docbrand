/**
 * DragHandle Extension for TipTap
 * Adds Notion-like drag handles to blocks
 * Uses inline positioning, not separate widget
 */

import { Extension, Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

export const DragHandlePluginKey = new PluginKey('dragHandle');

export interface DragHandleOptions {
    handleClass: string;
    plusClass: string;
}

// Store reference to current handle element
let currentHandleEl: HTMLElement | null = null;
let currentMenuEl: HTMLElement | null = null;

export const DragHandle = Extension.create<DragHandleOptions>({
    name: 'dragHandle',

    addOptions() {
        return {
            handleClass: 'drag-handle',
            plusClass: 'plus-handle',
        };
    },

    addProseMirrorPlugins() {
        const editor = this.editor;

        return [
            new Plugin({
                key: DragHandlePluginKey,
                view: () => {
                    // Create the handle element once
                    const handleContainer = document.createElement('div');
                    handleContainer.className = 'block-handle-container';
                    handleContainer.style.cssText = `
                        position: absolute;
                        display: flex;
                        align-items: center;
                        gap: 2px;
                        opacity: 0;
                        pointer-events: none;
                        transition: opacity 0.1s ease;
                        z-index: 50;
                    `;

                    // Plus button
                    const plusBtn = document.createElement('button');
                    plusBtn.className = 'plus-handle';
                    plusBtn.innerHTML = '+';
                    plusBtn.title = 'Add block';
                    plusBtn.style.cssText = `
                        width: 20px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: none;
                        background: transparent;
                        color: #9ca3af;
                        font-size: 16px;
                        cursor: pointer;
                        border-radius: 3px;
                        padding: 0;
                    `;

                    // Drag handle
                    const dragBtn = document.createElement('button');
                    dragBtn.className = 'drag-handle';
                    dragBtn.innerHTML = '⠿';
                    dragBtn.title = 'Drag';
                    dragBtn.style.cssText = `
                        width: 20px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: none;
                        background: transparent;
                        color: #9ca3af;
                        font-size: 12px;
                        cursor: grab;
                        border-radius: 3px;
                        padding: 0;
                    `;

                    handleContainer.appendChild(plusBtn);
                    handleContainer.appendChild(dragBtn);

                    currentHandleEl = handleContainer;

                    // Event handlers
                    let currentPos: number | null = null;
                    let currentNode: ProseMirrorNode | null = null;

                    const showHandle = (block: HTMLElement, pos: number, node: ProseMirrorNode) => {
                        const editorEl = document.querySelector('.ProseMirror');
                        if (!editorEl) return;

                        const blockRect = block.getBoundingClientRect();
                        const editorRect = editorEl.getBoundingClientRect();

                        handleContainer.style.left = `${blockRect.left - editorRect.left - 46}px`;
                        handleContainer.style.top = `${blockRect.top - editorRect.top + (blockRect.height / 2) - 10}px`;
                        handleContainer.style.opacity = '1';
                        handleContainer.style.pointerEvents = 'auto';

                        currentPos = pos;
                        currentNode = node;
                    };

                    const hideHandle = () => {
                        handleContainer.style.opacity = '0';
                        handleContainer.style.pointerEvents = 'none';
                    };

                    // Add button click
                    plusBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (currentPos !== null && currentNode) {
                            const endPos = currentPos + currentNode.nodeSize;
                            editor.chain().focus().insertContentAt(endPos, { type: 'paragraph' }).run();
                        }
                    };

                    // Drag button click - show menu
                    dragBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (currentPos !== null && currentNode) {
                            showBlockMenu(e, currentPos, currentNode, editor);
                        }
                    };

                    // Handle hover on button
                    plusBtn.onmouseenter = () => plusBtn.style.background = '#f3f4f6';
                    plusBtn.onmouseleave = () => plusBtn.style.background = 'transparent';
                    dragBtn.onmouseenter = () => dragBtn.style.background = '#f3f4f6';
                    dragBtn.onmouseleave = () => dragBtn.style.background = 'transparent';

                    // Mouse move handler
                    const onMouseMove = (event: MouseEvent) => {
                        const target = event.target as HTMLElement;

                        // Check if hovering over the handle itself
                        if (handleContainer.contains(target)) return;

                        const editorEl = document.querySelector('.ProseMirror');
                        if (!editorEl || !editorEl.contains(target)) {
                            hideHandle();
                            return;
                        }

                        // Find block element
                        const blockTags = ['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'UL', 'OL'];
                        let block: HTMLElement | null = target;

                        while (block && block !== editorEl) {
                            if (blockTags.includes(block.tagName)) break;
                            block = block.parentElement;
                        }

                        if (block && blockTags.includes(block.tagName) && block.textContent && block.textContent.trim().length > 0) {
                            try {
                                const pos = editor.view.posAtDOM(block, 0);
                                const node = editor.state.doc.nodeAt(pos);
                                if (node) {
                                    showHandle(block, pos, node);
                                }
                            } catch {
                                hideHandle();
                            }
                        } else {
                            hideHandle();
                        }
                    };

                    // Mount
                    const editorEl = document.querySelector('.ProseMirror');
                    if (editorEl) {
                        editorEl.appendChild(handleContainer);
                    }

                    document.addEventListener('mousemove', onMouseMove);

                    return {
                        destroy: () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            handleContainer.remove();
                            currentHandleEl = null;
                        },
                    };
                },
            }),
        ];
    },
});

// Block menu helper
function showBlockMenu(event: MouseEvent, pos: number, node: ProseMirrorNode, editor: Editor) {
    // Remove existing menu
    if (currentMenuEl) {
        currentMenuEl.remove();
        currentMenuEl = null;
    }

    const menu = document.createElement('div');
    menu.className = 'block-context-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${event.clientX}px;
        top: ${event.clientY}px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 4px;
        z-index: 1000;
        min-width: 150px;
    `;

    currentMenuEl = menu;

    interface MenuItem {
        label: string;
        icon?: string;
        danger?: boolean;
        action?: () => void;
    }

    const menuItems: MenuItem[] = [
        {
            label: 'Duplicate', icon: '📋', action: () => {
                editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run();
            }
        },
        {
            label: 'Delete', icon: '🗑️', danger: true, action: () => {
                editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
            }
        },
        { label: 'divider' },
        {
            label: 'Heading 1', icon: 'H1', action: () => {
                editor.chain().focus().setTextSelection(pos + 1).setHeading({ level: 1 }).run();
            }
        },
        {
            label: 'Heading 2', icon: 'H2', action: () => {
                editor.chain().focus().setTextSelection(pos + 1).setHeading({ level: 2 }).run();
            }
        },
        {
            label: 'Paragraph', icon: '¶', action: () => {
                editor.chain().focus().setTextSelection(pos + 1).setParagraph().run();
            }
        },
    ];

    menuItems.forEach(item => {
        if (item.label === 'divider') {
            const divider = document.createElement('div');
            divider.style.cssText = 'height: 1px; background: #e5e7eb; margin: 4px 0;';
            menu.appendChild(divider);
            return;
        }

        const btn = document.createElement('button');
        btn.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            padding: 6px 10px;
            border: none;
            background: none;
            cursor: pointer;
            font-size: 13px;
            color: ${item.danger ? '#dc2626' : '#374151'};
            border-radius: 4px;
            text-align: left;
        `;
        btn.innerHTML = `<span style="width: 18px; text-align: center; font-size: 12px;">${item.icon}</span>${item.label}`;
        btn.onmouseenter = () => btn.style.background = '#f3f4f6';
        btn.onmouseleave = () => btn.style.background = 'none';
        btn.onclick = () => {
            item.action?.();
            menu.remove();
            currentMenuEl = null;
        };
        menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    // Close on click outside
    const closeMenu = (e: MouseEvent) => {
        if (!menu.contains(e.target as Node)) {
            menu.remove();
            currentMenuEl = null;
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

export default DragHandle;
