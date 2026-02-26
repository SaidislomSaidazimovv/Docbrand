import { Extension } from '@tiptap/core';

/**
 * When the cursor is in the very last cell of a table and the user presses Tab,
 * a new row is appended and the cursor moves into its first cell.
 *
 * For all other table cells, TipTap's built-in Tab behaviour (move to next cell) is preserved
 * because this extension only intercepts Tab when isInLastCell is true.
 */
export const TableTabHandler = Extension.create({
    name: 'tableTabHandler',

    addKeyboardShortcuts() {
        return {
            Tab: ({ editor }) => {
                if (!editor.isActive('table')) return false;

                const { state } = editor;
                const { $from } = state.selection;

                // Walk up from the cursor to find tableCell / tableHeader, tableRow, and table nodes
                let cellDepth: number | null = null;
                for (let d = $from.depth; d > 0; d--) {
                    const nodeName = $from.node(d).type.name;
                    if (nodeName === 'tableCell' || nodeName === 'tableHeader') {
                        cellDepth = d;
                        break;
                    }
                }
                if (cellDepth === null) return false;

                const rowDepth = cellDepth - 1;
                const tableDepth = rowDepth - 1;
                if (tableDepth < 0) return false;

                const row = $from.node(rowDepth);
                const table = $from.node(tableDepth);

                const cellIndex = $from.index(rowDepth);      // which cell in this row
                const rowIndex = $from.index(tableDepth);      // which row in the table

                const isLastCell = cellIndex === row.childCount - 1;
                const isLastRow = rowIndex === table.childCount - 1;

                if (isLastCell && isLastRow) {
                    editor.chain().focus().addRowAfter().run();
                    // The built-in goToNextCell will handle moving the cursor into the new row
                    // after we've added it — but we need to let the default Tab also fire.
                    // Instead, manually move to the first cell of the new row.
                    // After addRowAfter, the new row is appended. We can use goToNextCell(true).
                    return editor.chain().goToNextCell().run();
                }

                // Not the last cell — let built-in table Tab handler take over
                return false;
            },
        };
    },
});
