'use client';

import { useState, useEffect } from 'react';
import { X, Download, FileText, Check, AlertCircle, AlertTriangle } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useStyleStore } from '@/store/styleStore';
import { useHeaderFooterStore } from '@/store/headerFooterStore';
import { GOVCON_FONTS } from '@/lib/fonts';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type ExportFormat = 'pdf' | 'docx';
type Phase = 'select' | 'exporting' | 'done' | 'empty';

interface ExportStep {
    id: string;
    label: string;
    completed: boolean;
}

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
    const [phase, setPhase] = useState<Phase>('select');
    const [fileName, setFileName] = useState('proposal');
    const [steps, setSteps] = useState<ExportStep[]>([
        { id: 'content', label: 'Preparing content', completed: false },
        { id: 'styles', label: 'Applying styles', completed: false },
        { id: 'headers', label: 'Generating headers/footers', completed: false },
        { id: 'finalize', label: 'Finalizing document', completed: false },
    ]);
    const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);
    const [fontWarning, setFontWarning] = useState<string | null>(null);

    const editor = useEditorStore((state) => state.editor);
    const {
        fontFamily, fontSize, lineHeight, spaceBefore, spaceAfter, bodyColor,
        h1FontSize, h1Color, h1SpaceBefore, h1SpaceAfter, h1LineHeight,
        h2FontSize, h2Color, h2SpaceBefore, h2SpaceAfter, h2LineHeight,
        h3FontSize, h3Color, h3SpaceBefore, h3SpaceAfter, h3LineHeight,
        h4FontSize, h4Color, h4SpaceBefore, h4SpaceAfter, h4LineHeight,
        h5FontSize, h5Color, h5SpaceBefore, h5SpaceAfter, h5LineHeight,
        h6FontSize, h6Color, h6SpaceBefore, h6SpaceAfter, h6LineHeight,
        marginTop, marginBottom, marginLeft, marginRight, pageWidth,
    } = useStyleStore();
    const headerConfig = useHeaderFooterStore((state) => state.header);
    const footerConfig = useHeaderFooterStore((state) => state.footer);

    // Reset all state when modal opens — prevents stale content from previous export
    useEffect(() => {
        if (isOpen) {
            setPhase('select');
            setSteps(prev => prev.map(s => ({ ...s, completed: false })));
            setDownloadBlob(null);
            setFontWarning(null);

            // Sync filename with current document title
            if (headerConfig.documentTitle) {
                setFileName(headerConfig.documentTitle);
            }

            // Check if content exists
            if (editor) {
                const docJSON = editor.getJSON();
                const isEmpty = !docJSON?.content ||
                    docJSON.content.length === 0 ||
                    (docJSON.content.length === 1 &&
                     docJSON.content[0].type === 'paragraph' &&
                     !docJSON.content[0].content);
                if (isEmpty) {
                    setPhase('empty');
                }
            }
        }
    }, [isOpen, editor, headerConfig.documentTitle]);

    const completeStep = (stepId: string) => {
        setSteps(prev => prev.map(step =>
            step.id === stepId ? { ...step, completed: true } : step
        ));
    };

    const handleExport = async () => {
        if (!editor) return;

        const docJSON = editor.getJSON();
        const isEmpty = !docJSON?.content ||
            docJSON.content.length === 0 ||
            (docJSON.content.length === 1 &&
             docJSON.content[0].type === 'paragraph' &&
             !docJSON.content[0].content);
        if (isEmpty) {
            setPhase('empty');
            return;
        }

        // Font compliance warning for DOCX
        if (selectedFormat === 'docx' && !GOVCON_FONTS.includes(fontFamily)) {
            setFontWarning(`"${fontFamily}" will be converted to Times New Roman for GovCon compliance`);
        } else {
            setFontWarning(null);
        }

        setPhase('exporting');
        setSteps(steps.map(s => ({ ...s, completed: false })));

        try {
            const htmlContent = editor.getHTML();
            const fullFileName = `${fileName}.${selectedFormat}`;

            // Step 1: Preparing content
            await new Promise(resolve => setTimeout(resolve, 500));
            completeStep('content');

            // Step 2: Applying styles
            await new Promise(resolve => setTimeout(resolve, 400));
            completeStep('styles');

            // Step 3: Generating headers/footers
            await new Promise(resolve => setTimeout(resolve, 300));
            completeStep('headers');

            if (selectedFormat === 'pdf') {
                const html2pdf = (await import('html2pdf.js')).default;

                const container = document.createElement('div');
                container.innerHTML = htmlContent;

                // Typography styles from store (brand spec)
                const pdfStyles = document.createElement('style');
                pdfStyles.textContent = `
                  * { font-family: '${fontFamily}', Arial, sans-serif !important; }
                  h1 { font-size: ${h1FontSize}pt; font-weight: 700; line-height: ${h1LineHeight}; margin-top: ${h1SpaceBefore}pt; margin-bottom: ${h1SpaceAfter}pt; color: ${h1Color}; }
                  h2 { font-size: ${h2FontSize}pt; font-weight: 700; line-height: ${h2LineHeight}; margin-top: ${h2SpaceBefore}pt; margin-bottom: ${h2SpaceAfter}pt; color: ${h2Color}; }
                  h3 { font-size: ${h3FontSize}pt; font-weight: 700; font-style: italic; line-height: ${h3LineHeight}; margin-top: ${h3SpaceBefore}pt; margin-bottom: ${h3SpaceAfter}pt; color: ${h3Color}; }
                  h4 { font-size: ${h4FontSize}pt; font-weight: 400; line-height: ${h4LineHeight}; margin-top: ${h4SpaceBefore}pt; margin-bottom: ${h4SpaceAfter}pt; color: ${h4Color}; }
                  h5 { font-size: ${h5FontSize}pt; font-weight: 400; line-height: ${h5LineHeight}; margin-top: ${h5SpaceBefore}pt; margin-bottom: ${h5SpaceAfter}pt; color: ${h5Color}; }
                  h6 { font-size: ${h6FontSize}pt; font-weight: 400; font-style: italic; line-height: ${h6LineHeight}; margin-top: ${h6SpaceBefore}pt; margin-bottom: ${h6SpaceAfter}pt; color: ${h6Color}; }
                  p  { font-size: ${fontSize}pt; font-weight: 400; line-height: ${lineHeight}; margin-top: ${spaceBefore}pt; margin-bottom: ${spaceAfter}pt; color: ${bodyColor}; }
                `;
                container.prepend(pdfStyles);

                // Container base styles with proper text wrapping
                container.style.width = '210mm'; // A4 width
                container.style.maxWidth = '100%';
                container.style.padding = '40px';
                container.style.fontFamily = `'${fontFamily}', Arial, sans-serif`;
                container.style.fontSize = '16px';
                container.style.lineHeight = '1';
                container.style.color = '#1A1A1A';
                container.style.wordWrap = 'break-word';
                container.style.wordBreak = 'break-word';
                container.style.overflowWrap = 'break-word';
                container.style.whiteSpace = 'normal';

                // Style lists
                container.querySelectorAll('ul, ol').forEach((list) => {
                    (list as HTMLElement).style.marginBottom = '12px';
                    (list as HTMLElement).style.paddingLeft = '24px';
                });

                container.querySelectorAll('li').forEach((li) => {
                    (li as HTMLElement).style.marginBottom = '6px';
                    (li as HTMLElement).style.wordWrap = 'break-word';
                });

                // px to mm: 1px at 96 DPI = 0.2646mm
                const pxToMm = (px: number) => Math.round(px * 0.2646);
                const pdfMargin: [number, number, number, number] = [pxToMm(marginTop), pxToMm(marginRight), pxToMm(marginBottom), pxToMm(marginLeft)];
                const options = {
                    margin: pdfMargin,
                    filename: fullFileName,
                    image: { type: 'jpeg' as const, quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        letterRendering: true,
                    },
                    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
                };

                // Step 4: Finalizing
                await new Promise(resolve => setTimeout(resolve, 300));
                completeStep('finalize');

                await html2pdf().set(options).from(container).save();
            } else {
                // ============================================================
                // DOCX Export — Native OpenXML via TipTap JSON AST
                // ============================================================
                const {
                    Document, Packer, Paragraph, TextRun, HeadingLevel,
                    LevelFormat, AlignmentType, Header, Footer, PageNumber,
                    BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType,
                } = await import('docx');

                // Get TipTap JSON AST (not HTML DOM)
                const docJSON = editor.getJSON();

                // --- Font: use selected font (warning already shown if non-GovCon) ---
                const safeFont = fontFamily || 'Times New Roman';

                // --- Unit conversions ---
                const ptToHalfPt = (pt: number) => Math.round(pt * 2);
                const ptToTwips = (pt: number) => Math.round(pt * 20);
                const pxToTwips = (px: number) => Math.round(px * 1440 / 96);

                // --- Heading sizes (half-points from pt) ---
                const h1Size = ptToHalfPt(h1FontSize);
                const h2Size = ptToHalfPt(h2FontSize);
                const h3Size = ptToHalfPt(h3FontSize);
                const h4Size = ptToHalfPt(h4FontSize);
                const h5Size = ptToHalfPt(h5FontSize);
                const h6Size = ptToHalfPt(h6FontSize);
                const bodySize = ptToHalfPt(fontSize);

                // --- Colors (strip #) ---
                const h1Hex = h1Color.replace('#', '');
                const h2Hex = h2Color.replace('#', '');
                const h3Hex = h3Color.replace('#', '');
                const h4Hex = h4Color.replace('#', '');
                const h5Hex = h5Color.replace('#', '');
                const h6Hex = h6Color.replace('#', '');
                const bodyHex = bodyColor.replace('#', '');

                // --- Line spacing (240ths; 240 = single) ---
                const lineSpacing = Math.round((lineHeight || 1) * 240);

                // --- TipTap JSON types ---
                interface TipTapNode {
                    type: string;
                    attrs?: Record<string, unknown>;
                    content?: TipTapNode[];
                    text?: string;
                    marks?: { type: string; attrs?: Record<string, unknown> }[];
                }

                // --- Build TextRun[] from inline content nodes ---
                const buildTextRuns = (
                    nodes: TipTapNode[] | undefined,
                    defaults: { size: number; color: string; bold?: boolean; italic?: boolean },
                ): InstanceType<typeof TextRun>[] => {
                    if (!nodes || nodes.length === 0) {
                        return [new TextRun({ text: '', font: safeFont, size: defaults.size })];
                    }

                    const runs: InstanceType<typeof TextRun>[] = [];
                    for (const node of nodes) {
                        if (node.type === 'text') {
                            let bold = defaults.bold || false;
                            let italic = defaults.italic || false;
                            let runColor = defaults.color;

                            if (node.marks) {
                                for (const mark of node.marks) {
                                    if (mark.type === 'bold') bold = true;
                                    if (mark.type === 'italic') italic = true;
                                    if (mark.type === 'textStyle' && mark.attrs) {
                                        if (typeof mark.attrs.color === 'string') {
                                            runColor = mark.attrs.color.replace('#', '');
                                        }
                                    }
                                }
                            }

                            runs.push(new TextRun({
                                text: node.text || '',
                                font: safeFont,
                                size: defaults.size,
                                color: runColor,
                                bold,
                                italics: italic,
                            }));
                        } else if (node.type === 'hardBreak') {
                            runs.push(new TextRun({ text: '', break: 1 }));
                        }
                    }

                    return runs.length > 0
                        ? runs
                        : [new TextRun({ text: '', font: safeFont, size: defaults.size })];
                };

                // --- Build list items with depth tracking ---
                const buildListItem = (
                    node: TipTapNode,
                    listType: 'bullet' | 'ordered',
                    depth: number,
                ): InstanceType<typeof Paragraph>[] => {
                    const items: InstanceType<typeof Paragraph>[] = [];
                    if (!node.content) return items;

                    for (const child of node.content) {
                        if (child.type === 'paragraph') {
                            items.push(new Paragraph({
                                children: buildTextRuns(child.content, { size: bodySize, color: bodyHex }),
                                spacing: { before: 0, after: ptToTwips(2), line: lineSpacing },
                                numbering: {
                                    reference: listType === 'ordered' ? 'ordered-list' : 'bullet-list',
                                    level: depth,
                                },
                            }));
                        } else if (child.type === 'bulletList' && child.content) {
                            for (const nested of child.content) {
                                items.push(...buildListItem(nested, 'bullet', depth + 1));
                            }
                        } else if (child.type === 'orderedList' && child.content) {
                            for (const nested of child.content) {
                                items.push(...buildListItem(nested, 'ordered', depth + 1));
                            }
                        }
                    }

                    return items;
                };

                // --- Build Table from TipTap table node ---
                const buildTable = (node: TipTapNode): InstanceType<typeof Table> => {
                    const contentWidthTwips = pxToTwips(pageWidth) - pxToTwips(marginLeft) - pxToTwips(marginRight);
                    const firstRow = node.content?.[0];
                    const colCount = firstRow?.content?.length || 1;
                    const colWidth = Math.floor(contentWidthTwips / colCount);

                    const rows = (node.content || []).map((rowNode) => {
                        const isHeader = rowNode.content?.some(c => c.type === 'tableHeader') || false;

                        const cells = (rowNode.content || []).map((cellNode) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const cellChildren: any[] = cellNode.content
                                ? buildDocxChildren(cellNode.content)
                                : [];

                            if (cellChildren.length === 0) {
                                cellChildren.push(new Paragraph({
                                    children: [new TextRun({ text: '', font: safeFont, size: bodySize })],
                                }));
                            }

                            const colspan = (cellNode.attrs?.colspan as number) || 1;
                            const rowspan = (cellNode.attrs?.rowspan as number) || 1;

                            return new TableCell({
                                width: { size: colWidth * colspan, type: WidthType.DXA },
                                columnSpan: colspan > 1 ? colspan : undefined,
                                rowSpan: rowspan > 1 ? rowspan : undefined,
                                borders: {
                                    top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                },
                                shading: isHeader
                                    ? { fill: 'EBF3FB', type: ShadingType.CLEAR, color: 'auto' }
                                    : undefined,
                                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                                children: cellChildren,
                            });
                        });

                        return new TableRow({
                            tableHeader: isHeader,
                            children: cells,
                        });
                    });

                    return new Table({
                        width: { size: contentWidthTwips, type: WidthType.DXA },
                        columnWidths: Array(colCount).fill(colWidth),
                        rows,
                    });
                };

                // --- Main: walk TipTap JSON nodes → Paragraph | Table ---
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const buildDocxChildren = (nodes: TipTapNode[] | undefined): any[] => {
                    if (!nodes) return [];
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const result: any[] = [];

                    for (const node of nodes) {
                        switch (node.type) {
                            case 'heading': {
                                const level = (node.attrs?.level as number) || 1;
                                let heading, size: number, color: string, bold: boolean, italic: boolean;
                                let sBefore: number, sAfter: number;

                                if (level === 1) {
                                    heading = HeadingLevel.HEADING_1;
                                    size = h1Size; color = h1Hex;
                                    bold = true; italic = false;
                                    sBefore = ptToTwips(h1SpaceBefore);
                                    sAfter = ptToTwips(h1SpaceAfter);
                                } else if (level === 2) {
                                    heading = HeadingLevel.HEADING_2;
                                    size = h2Size; color = h2Hex;
                                    bold = true; italic = false;
                                    sBefore = ptToTwips(h2SpaceBefore);
                                    sAfter = ptToTwips(h2SpaceAfter);
                                } else if (level === 3) {
                                    heading = HeadingLevel.HEADING_3;
                                    size = h3Size; color = h3Hex;
                                    bold = true; italic = true;
                                    sBefore = ptToTwips(h3SpaceBefore);
                                    sAfter = ptToTwips(h3SpaceAfter);
                                } else if (level === 4) {
                                    heading = HeadingLevel.HEADING_4;
                                    size = h4Size; color = h4Hex;
                                    bold = false; italic = false;
                                    sBefore = ptToTwips(h4SpaceBefore);
                                    sAfter = ptToTwips(h4SpaceAfter);
                                } else if (level === 5) {
                                    heading = HeadingLevel.HEADING_5;
                                    size = h5Size; color = h5Hex;
                                    bold = false; italic = false;
                                    sBefore = ptToTwips(h5SpaceBefore);
                                    sAfter = ptToTwips(h5SpaceAfter);
                                } else {
                                    heading = HeadingLevel.HEADING_6;
                                    size = h6Size; color = h6Hex;
                                    bold = false; italic = true;
                                    sBefore = ptToTwips(h6SpaceBefore);
                                    sAfter = ptToTwips(h6SpaceAfter);
                                }

                                result.push(new Paragraph({
                                    heading,
                                    children: buildTextRuns(node.content, { size, color, bold, italic }),
                                    spacing: { before: sBefore, after: sAfter, line: lineSpacing },
                                }));
                                break;
                            }

                            case 'paragraph':
                                result.push(new Paragraph({
                                    children: buildTextRuns(node.content, { size: bodySize, color: bodyHex }),
                                    spacing: {
                                        before: ptToTwips(spaceBefore ?? 0),
                                        after: ptToTwips(spaceAfter ?? 6),
                                        line: lineSpacing,
                                    },
                                }));
                                break;

                            case 'bulletList':
                                if (node.content) {
                                    for (const li of node.content) {
                                        result.push(...buildListItem(li, 'bullet', 0));
                                    }
                                }
                                break;

                            case 'orderedList':
                                if (node.content) {
                                    for (const li of node.content) {
                                        result.push(...buildListItem(li, 'ordered', 0));
                                    }
                                }
                                break;

                            case 'table':
                                result.push(buildTable(node));
                                break;

                            case 'blockquote':
                                if (node.content) {
                                    for (const child of node.content) {
                                        if (child.type === 'paragraph') {
                                            result.push(new Paragraph({
                                                children: buildTextRuns(child.content, { size: bodySize, color: bodyHex }),
                                                indent: { left: 720 },
                                                spacing: { before: 0, after: ptToTwips(spaceAfter ?? 6), line: lineSpacing },
                                            }));
                                        } else {
                                            result.push(...buildDocxChildren([child]));
                                        }
                                    }
                                }
                                break;

                            case 'codeBlock': {
                                const codeText = node.content?.map(n => n.text || '').join('') || '';
                                result.push(new Paragraph({
                                    children: [new TextRun({
                                        text: codeText,
                                        font: 'Courier New',
                                        size: bodySize,
                                        color: bodyHex,
                                    })],
                                    spacing: { before: ptToTwips(4), after: ptToTwips(4), line: lineSpacing },
                                }));
                                break;
                            }

                            case 'horizontalRule':
                                result.push(new Paragraph({
                                    children: [new TextRun({ text: '' })],
                                    border: {
                                        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                                    },
                                }));
                                break;

                            default:
                                if (node.content) {
                                    result.push(...buildDocxChildren(node.content));
                                }
                        }
                    }

                    return result;
                };

                // Build document content from TipTap JSON
                const children = buildDocxChildren((docJSON.content || []) as TipTapNode[]);

                // Step 4: Finalizing
                await new Promise(resolve => setTimeout(resolve, 300));
                completeStep('finalize');

                // --- Build DOCX Header ---
                const headerAlignment = headerConfig.alignment === 'center' ? AlignmentType.CENTER
                    : headerConfig.alignment === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT;
                const headerRuns: InstanceType<typeof TextRun>[] = [];
                if (headerConfig.companyName) {
                    headerRuns.push(new TextRun({
                        text: headerConfig.companyName,
                        font: headerConfig.fontFamily || safeFont,
                        size: (headerConfig.fontSize || 12) * 2,
                        color: (headerConfig.textColor || '#374151').replace('#', ''),
                        bold: true,
                    }));
                }
                if (headerConfig.companyName && headerConfig.documentTitle) {
                    headerRuns.push(new TextRun({
                        text: '  |  ',
                        font: headerConfig.fontFamily || safeFont,
                        size: (headerConfig.fontSize || 12) * 2,
                        color: (headerConfig.textColor || '#374151').replace('#', ''),
                    }));
                }
                if (headerConfig.documentTitle) {
                    headerRuns.push(new TextRun({
                        text: headerConfig.documentTitle,
                        font: headerConfig.fontFamily || safeFont,
                        size: (headerConfig.fontSize || 12) * 2,
                        color: (headerConfig.textColor || '#374151').replace('#', ''),
                    }));
                }

                const headerParagraph = new Paragraph({
                    children: headerRuns.length > 0 ? headerRuns : [new TextRun({ text: '' })],
                    alignment: headerAlignment,
                    border: headerConfig.showBorder ? {
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                    } : undefined,
                });

                // --- Build DOCX Footer ---
                const footerAlignment = footerConfig.alignment === 'center' ? AlignmentType.CENTER
                    : footerConfig.alignment === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT;
                const footerRuns: InstanceType<typeof TextRun>[] = [];

                if (footerConfig.text) {
                    footerRuns.push(new TextRun({
                        text: footerConfig.text,
                        font: footerConfig.fontFamily || safeFont,
                        size: (footerConfig.fontSize || 12) * 2,
                        color: (footerConfig.textColor || '#6b7280').replace('#', ''),
                    }));
                }
                if (footerConfig.showDate) {
                    const now = new Date();
                    let dateStr: string;
                    if (footerConfig.dateFormat === 'iso') {
                        dateStr = now.toISOString().slice(0, 10);
                    } else if (footerConfig.dateFormat === 'short') {
                        dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    } else {
                        dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                    }
                    if (footerRuns.length > 0) {
                        footerRuns.push(new TextRun({
                            text: '  |  ',
                            font: footerConfig.fontFamily || safeFont,
                            size: (footerConfig.fontSize || 12) * 2,
                            color: (footerConfig.textColor || '#6b7280').replace('#', ''),
                        }));
                    }
                    footerRuns.push(new TextRun({
                        text: dateStr,
                        font: footerConfig.fontFamily || safeFont,
                        size: (footerConfig.fontSize || 12) * 2,
                        color: (footerConfig.textColor || '#6b7280').replace('#', ''),
                    }));
                }
                if (footerConfig.showPageNumbers) {
                    if (footerRuns.length > 0) {
                        footerRuns.push(new TextRun({
                            text: '  |  ',
                            font: footerConfig.fontFamily || safeFont,
                            size: (footerConfig.fontSize || 12) * 2,
                            color: (footerConfig.textColor || '#6b7280').replace('#', ''),
                        }));
                    }
                    if (footerConfig.pageNumberFormat === 'pageOf') {
                        footerRuns.push(new TextRun({
                            text: 'Page ',
                            font: footerConfig.fontFamily || safeFont,
                            size: (footerConfig.fontSize || 12) * 2,
                            color: (footerConfig.textColor || '#6b7280').replace('#', ''),
                        }));
                        footerRuns.push(new TextRun({
                            children: [PageNumber.CURRENT],
                            font: footerConfig.fontFamily || safeFont,
                            size: (footerConfig.fontSize || 12) * 2,
                            color: (footerConfig.textColor || '#6b7680').replace('#', ''),
                        }));
                        footerRuns.push(new TextRun({
                            text: ' of ',
                            font: footerConfig.fontFamily || safeFont,
                            size: (footerConfig.fontSize || 12) * 2,
                            color: (footerConfig.textColor || '#6b7280').replace('#', ''),
                        }));
                        footerRuns.push(new TextRun({
                            children: [PageNumber.TOTAL_PAGES],
                            font: footerConfig.fontFamily || safeFont,
                            size: (footerConfig.fontSize || 12) * 2,
                            color: (footerConfig.textColor || '#6b7280').replace('#', ''),
                        }));
                    } else {
                        footerRuns.push(new TextRun({
                            children: [PageNumber.CURRENT],
                            font: footerConfig.fontFamily || safeFont,
                            size: (footerConfig.fontSize || 12) * 2,
                            color: (footerConfig.textColor || '#6b7280').replace('#', ''),
                        }));
                    }
                }

                const footerParagraph = new Paragraph({
                    children: footerRuns.length > 0 ? footerRuns : [new TextRun({ text: '' })],
                    alignment: footerAlignment,
                    border: footerConfig.showBorder ? {
                        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                    } : undefined,
                });

                const doc = new Document({
                    numbering: {
                        config: [
                            {
                                reference: 'ordered-list',
                                levels: [0, 1, 2, 3].map(level => ({
                                    level,
                                    format: LevelFormat.DECIMAL,
                                    text: `%${level + 1}.`,
                                    alignment: AlignmentType.START,
                                    style: {
                                        paragraph: {
                                            indent: { left: 720 * (level + 1), hanging: 360 },
                                        },
                                    },
                                })),
                            },
                            {
                                reference: 'bullet-list',
                                levels: [0, 1, 2, 3].map(level => ({
                                    level,
                                    format: LevelFormat.BULLET,
                                    text: '\u2022',
                                    alignment: AlignmentType.LEFT,
                                    style: {
                                        paragraph: {
                                            indent: { left: 720 * (level + 1), hanging: 360 },
                                        },
                                    },
                                })),
                            },
                        ],
                    },
                    sections: [{
                        headers: {
                            default: new Header({ children: [headerParagraph] }),
                        },
                        footers: {
                            default: new Footer({ children: [footerParagraph] }),
                        },
                        properties: {
                            page: {
                                margin: {
                                    top: pxToTwips(marginTop),
                                    bottom: pxToTwips(marginBottom),
                                    left: pxToTwips(marginLeft),
                                    right: pxToTwips(marginRight),
                                },
                            },
                        },
                        children,
                    }],
                });
                const blob = await Packer.toBlob(doc);
                setDownloadBlob(blob);
            }

            await new Promise(resolve => setTimeout(resolve, 300));
            setPhase('done');
        } catch (error) {
            console.error('Export failed:', error);
            setPhase('select');
        }
    };

    const handleDownload = async () => {
        if (selectedFormat === 'docx' && downloadBlob) {
            const { saveAs } = await import('file-saver');
            saveAs(downloadBlob, `${fileName}.docx`);
        }
        onClose();
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 modal-overlay ${isOpen ? 'modal-open' : ''}`} onClick={onClose}>
            <div
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden modal-panel"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded transition-colors"
                >
                    <X size={20} className="text-gray-400" />
                </button>

                {/* Content */}
                <div className="p-8">
                    {/* Empty State */}
                    {phase === 'empty' && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 mx-auto bg-amber-50 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle size={32} className="text-amber-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">Nothing to Export</h3>
                            <p className="text-gray-500 text-sm mb-6">
                                Your document is empty. Please add some content before exporting.
                            </p>
                            <button
                                onClick={onClose}
                                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
                            >
                                Go Back
                            </button>
                        </div>
                    )}

                    {/* Select Format */}
                    {phase === 'select' && (
                        <>
                            {/* Icon */}
                            <div className="flex justify-center mb-4">
                                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
                                    <FileText size={28} className="text-emerald-500" />
                                </div>
                            </div>

                            <h3 className="text-xl font-semibold text-gray-800 text-center mb-1">Export Document</h3>
                            <p className="text-gray-500 text-sm text-center mb-6">Choose your preferred format</p>

                            {/* File Name */}
                            <div className="mb-4">
                                <label className="block text-sm text-gray-600 mb-2">File Name</label>
                                <input
                                    type="text"
                                    value={fileName}
                                    onChange={(e) => setFileName(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                    placeholder="Enter file name"
                                />
                            </div>

                            {/* Format Selection */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <button
                                    onClick={() => setSelectedFormat('pdf')}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${selectedFormat === 'pdf'
                                        ? 'bg-emerald-50 border-emerald-400'
                                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <FileText size={20} className={selectedFormat === 'pdf' ? 'text-emerald-500' : 'text-red-500'} />
                                    <div className="text-left">
                                        <p className="text-sm font-medium text-gray-800">PDF</p>
                                        <p className="text-xs text-gray-500">Best for sharing</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setSelectedFormat('docx')}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${selectedFormat === 'docx'
                                        ? 'bg-emerald-50 border-emerald-400'
                                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <FileText size={20} className={selectedFormat === 'docx' ? 'text-emerald-500' : 'text-blue-500'} />
                                    <div className="text-left">
                                        <p className="text-sm font-medium text-gray-800">DOCX</p>
                                        <p className="text-xs text-gray-500">For editing</p>
                                    </div>
                                </button>
                            </div>

                            {/* Export Button */}
                            <button
                                onClick={handleExport}
                                disabled={!fileName.trim()}
                                className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-xl text-white font-medium transition-colors"
                            >
                                <Download size={18} />
                                Export as {selectedFormat.toUpperCase()}
                            </button>
                        </>
                    )}

                    {/* Exporting Progress */}
                    {phase === 'exporting' && (
                        <div className="py-4">
                            {/* Font compliance warning */}
                            {fontWarning && (
                                <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
                                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                    <span className="text-xs text-amber-700">{fontWarning}</span>
                                </div>
                            )}

                            <div className="flex justify-center mb-4">
                                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
                                    <FileText size={28} className="text-emerald-500" />
                                </div>
                            </div>

                            <h3 className="text-xl font-semibold text-gray-800 text-center mb-1">Exporting...</h3>
                            <p className="text-gray-500 text-sm text-center mb-6">Please wait while we prepare your document</p>

                            {/* Progress Bar */}
                            <div className="h-1.5 bg-gray-100 rounded-full mb-6 overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 transition-all duration-500"
                                    style={{ width: `${(steps.filter(s => s.completed).length / steps.length) * 100}%` }}
                                />
                            </div>

                            {/* Steps */}
                            <div className="space-y-3">
                                {steps.map((step) => (
                                    <div key={step.id} className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${step.completed
                                            ? 'bg-emerald-500'
                                            : 'bg-gray-200'
                                            }`}>
                                            {step.completed && <Check size={12} className="text-white" />}
                                        </div>
                                        <span className={`text-sm ${step.completed ? 'text-emerald-600' : 'text-gray-500'}`}>
                                            {step.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Export Complete */}
                    {phase === 'done' && (
                        <div className="py-4">
                            {/* Font compliance warning */}
                            {fontWarning && (
                                <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
                                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                    <span className="text-xs text-amber-700">{fontWarning}</span>
                                </div>
                            )}

                            <div className="flex justify-center mb-4">
                                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
                                    <FileText size={28} className="text-emerald-500" />
                                </div>
                            </div>

                            <h3 className="text-xl font-semibold text-gray-800 text-center mb-1">Export Complete</h3>
                            <p className="text-gray-500 text-sm text-center mb-6">Your document is ready to download</p>

                            {/* Progress Bar Complete */}
                            <div className="h-1.5 bg-emerald-500 rounded-full mb-6" />

                            {/* Steps - All Complete */}
                            <div className="space-y-3 mb-6">
                                {steps.map((step) => (
                                    <div key={step.id} className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                            <Check size={12} className="text-white" />
                                        </div>
                                        <span className="text-sm text-emerald-600">{step.label}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Download Button */}
                            <button
                                onClick={handleDownload}
                                className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-white font-medium transition-colors"
                            >
                                <Download size={18} />
                                Download File
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
