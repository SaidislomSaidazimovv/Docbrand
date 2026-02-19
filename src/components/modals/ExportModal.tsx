'use client';

import { useState, useEffect } from 'react';
import { X, Download, FileText, Check, AlertCircle } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';

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

    const editor = useEditorStore((state) => state.editor);

    // Check if content exists
    useEffect(() => {
        if (editor) {
            const content = editor.getText().trim();
            if (!content || content.length === 0) {
                setPhase('empty');
            }
        }
    }, [editor]);

    const completeStep = (stepId: string) => {
        setSteps(prev => prev.map(step =>
            step.id === stepId ? { ...step, completed: true } : step
        ));
    };

    const handleExport = async () => {
        if (!editor) return;

        const content = editor.getText().trim();
        if (!content || content.length === 0) {
            setPhase('empty');
            return;
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

                // Government-compliant typography styles
                const pdfStyles = document.createElement('style');
                pdfStyles.textContent = `
                  * { font-family: 'Times New Roman', Times, serif !important; }
                  h1 { font-size: 42.67px; font-weight: 700; line-height: 0.65; margin-top: 0; margin-bottom: 24pt; color: #1A1A1A; }
                  h2 { font-size: 21.33px; font-weight: 700; line-height: 1.15; margin-top: 6pt; margin-bottom: 12pt; color: #13818A; }
                  h3 { font-size: 18.67px; font-weight: 700; line-height: 1.15; margin-top: 14pt; margin-bottom: 6pt; color: #1A1A1A; }
                  h4 { font-size: 17.33px; font-weight: 700; font-style: italic; line-height: 1; margin-top: 12pt; margin-bottom: 6pt; color: #1A1A1A; }
                  h5 { font-size: 14.67px; font-weight: 400; line-height: 1; margin-top: 0; margin-bottom: 4pt; color: #1A1A1A; }
                  h6 { font-size: 16px; font-weight: 400; line-height: 1.5; margin-top: 0; margin-bottom: 6pt; color: #1A1A1A; }
                  p  { font-size: 16px; font-weight: 400; line-height: 1; margin-top: 0; margin-bottom: 6pt; color: #1A1A1A; }
                `;
                container.prepend(pdfStyles);

                // Container base styles with proper text wrapping
                container.style.width = '210mm'; // A4 width
                container.style.maxWidth = '100%';
                container.style.padding = '40px';
                container.style.fontFamily = "'Times New Roman', Times, serif";
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

                const options = {
                    margin: 10,
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
                const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlContent;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const children: any[] = [];

                /**
                 * Process a node (element or text) into DOCX nodes
                 */
                const processNode = (node: Node, formatting: { bold?: boolean; italic?: boolean; size?: number; color?: string; font?: string } = {}): any[] => {
                    const results: any[] = [];

                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent || '';
                        if (text.trim()) {
                            results.push(new TextRun({
                                text,
                                bold: formatting.bold,
                                italics: formatting.italic,
                                size: formatting.size,
                                color: formatting.color,
                                font: formatting.font || 'Times New Roman',
                            }));
                        }
                        return results;
                    }

                    if (node.nodeType !== Node.ELEMENT_NODE) return [];

                    const element = node as HTMLElement;

                    // Process children with inherited formatting
                    const processChildren = (additionalFormatting: { bold?: boolean; italic?: boolean; size?: number; color?: string; font?: string } = {}) => {
                        const merged = { ...formatting, ...additionalFormatting };
                        const childResults: any[] = [];
                        element.childNodes.forEach(child => {
                            childResults.push(...processNode(child, merged));
                        });
                        return childResults;
                    };

                    switch (element.tagName) {
                        case 'H1': {
                            // Title: 32pt (size=64 half-pts), bold, #1A1A1A, after=480twips
                            children.push(new Paragraph({
                                heading: HeadingLevel.HEADING_1,
                                children: processChildren({ bold: true, size: 64, color: '1A1A1A', font: 'Times New Roman' }),
                                spacing: { before: 0, after: 480, line: 240 },
                            }));
                            break;
                        }
                        case 'H2': {
                            // Section: 16pt (size=32), bold, #13818A, before=120 after=240
                            children.push(new Paragraph({
                                heading: HeadingLevel.HEADING_2,
                                children: processChildren({ bold: true, size: 32, color: '13818A', font: 'Times New Roman' }),
                                spacing: { before: 120, after: 240, line: 276 },
                            }));
                            break;
                        }
                        case 'H3': {
                            // Subsection: 14pt (size=28), bold, #1A1A1A, before=280 after=120
                            children.push(new Paragraph({
                                heading: HeadingLevel.HEADING_3,
                                children: processChildren({ bold: true, size: 28, color: '1A1A1A', font: 'Times New Roman' }),
                                spacing: { before: 280, after: 120, line: 276 },
                            }));
                            break;
                        }
                        case 'H4': {
                            // Sub-subsection: 13pt (size=26), bold italic, #1A1A1A, before=240 after=120
                            children.push(new Paragraph({
                                heading: HeadingLevel.HEADING_4,
                                children: processChildren({ bold: true, italic: true, size: 26, color: '1A1A1A', font: 'Times New Roman' }),
                                spacing: { before: 240, after: 120, line: 240 },
                            }));
                            break;
                        }
                        case 'H5': {
                            // Callout: 11pt (size=22), regular, #1A1A1A, after=80
                            children.push(new Paragraph({
                                heading: HeadingLevel.HEADING_5,
                                children: processChildren({ size: 22, color: '1A1A1A', font: 'Times New Roman' }),
                                spacing: { before: 0, after: 80, line: 240 },
                            }));
                            break;
                        }
                        case 'H6': {
                            // Lead: 12pt (size=24), regular, #1A1A1A, after=120
                            children.push(new Paragraph({
                                heading: HeadingLevel.HEADING_6,
                                children: processChildren({ size: 24, color: '1A1A1A', font: 'Times New Roman' }),
                                spacing: { before: 0, after: 120, line: 360 },
                            }));
                            break;
                        }
                        case 'P':
                            // Body: 12pt (size=24), regular, #1A1A1A, after=120
                            children.push(new Paragraph({
                                children: processChildren({ size: 24, color: '1A1A1A', font: 'Times New Roman' }),
                                spacing: { before: 0, after: 120, line: 240 },
                            }));
                            break;
                        case 'LI':
                            // List items are handled by parent UL/OL
                            children.push(new Paragraph({
                                children: processChildren(),
                                bullet: { level: 0 },
                            }));
                            break;
                        case 'UL':
                        case 'OL':
                            // Process each list item
                            element.querySelectorAll(':scope > li').forEach(li => {
                                processNode(li, formatting);
                            });
                            break;
                        case 'BLOCKQUOTE':
                            children.push(new Paragraph({
                                children: processChildren(),
                                indent: { left: 720 }, // Indent blockquotes
                            }));
                            break;
                        case 'PRE':
                        case 'CODE':
                            children.push(new Paragraph({
                                children: processChildren(),
                                style: 'code',
                            }));
                            break;
                        case 'STRONG':
                        case 'B':
                            return processChildren({ bold: true });
                        case 'EM':
                        case 'I':
                            return processChildren({ italic: true });
                        case 'BR':
                            results.push(new TextRun({ text: '', break: 1 }));
                            break;
                        case 'DIV':
                            // DocBlock wrapper - process children as separate paragraphs
                            if (element.classList.contains('doc-block') || element.hasAttribute('data-block-id')) {
                                element.childNodes.forEach(child => processNode(child, formatting));
                            } else {
                                // Regular div - unwrap
                                results.push(...processChildren());
                            }
                            break;
                        default:
                            // Unknown tag - process children
                            results.push(...processChildren());
                    }

                    return results;
                };

                // Process all top-level nodes
                tempDiv.childNodes.forEach((node) => {
                    processNode(node);
                });

                // Step 4: Finalizing
                await new Promise(resolve => setTimeout(resolve, 300));
                completeStep('finalize');

                const doc = new Document({ sections: [{ children }] });
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
