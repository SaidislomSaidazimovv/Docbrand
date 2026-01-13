/**
 * Paste Firewall Extension for TipTap
 * 
 * Matn paste qilganda:
 * 1. HTML/RTF formatni tozalaydi
 * 2. Plain text oladi
 * 3. Hozirgi kontekstga qarab style qo'llaydi
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const PasteFirewall = Extension.create({
    name: 'pasteFirewall',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('pasteFirewall'),
                props: {
                    handlePaste: (view, event) => {
                        event.preventDefault();

                        // 1. Plain text olish (HTML ni strip qilish)
                        const text = event.clipboardData?.getData('text/plain');
                        if (!text) return true;

                        // 2. Hozirgi cursor pozitsiyasi
                        const { state, dispatch } = view;
                        const { selection } = state;

                        // 3. Yangi text node yaratish
                        const tr = state.tr.insertText(text, selection.from, selection.to);

                        // 4. Dispatch qilish
                        dispatch(tr);

                        return true;
                    },
                },
            }),
        ];
    },
});

export default PasteFirewall;
