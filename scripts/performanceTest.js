/**
 * Performance Test Script
 * 
 * Tests editor performance with 500+ blocks.
 * Run this in browser console at http://localhost:3000
 * 
 * Usage:
 * 1. Open http://localhost:3000
 * 2. Open browser console (F12 -> Console)
 * 3. Copy and paste this entire script
 * 4. Wait for results
 */

(async function performanceTest() {
    console.log('🚀 Starting Performance Test...');

    // Find TipTap editor
    const editor = document.querySelector('.ProseMirror');
    if (!editor) {
        console.error('❌ Editor not found!');
        return;
    }

    // Get TipTap editor instance
    const tiptapEditor = window.__TIPTAP_EDITOR__;
    if (!tiptapEditor) {
        console.warn('⚠️ TipTap editor instance not exposed. Using DOM-based test.');
    }

    const BLOCK_COUNT = 500;
    const startTime = performance.now();

    // Generate 500 paragraphs
    console.log(`📝 Generating ${BLOCK_COUNT} paragraphs...`);

    let content = '';
    for (let i = 1; i <= BLOCK_COUNT; i++) {
        content += `<p>Paragraph ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>`;
    }

    const generateTime = performance.now() - startTime;
    console.log(`✅ Content generated in ${generateTime.toFixed(2)}ms`);

    // Insert content
    const insertStart = performance.now();

    if (tiptapEditor) {
        tiptapEditor.commands.setContent(content);
    } else {
        editor.innerHTML = content;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const insertTime = performance.now() - insertStart;
    console.log(`✅ Content inserted in ${insertTime.toFixed(2)}ms`);

    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 500));

    // Measure scroll performance
    console.log('📊 Testing scroll performance...');
    const scrollStart = performance.now();

    for (let i = 0; i < 10; i++) {
        editor.scrollTop = (i % 2 === 0) ? 10000 : 0;
        await new Promise(resolve => requestAnimationFrame(resolve));
    }

    const scrollTime = performance.now() - scrollStart;
    const avgScrollTime = scrollTime / 10;
    console.log(`✅ Scroll test: ${scrollTime.toFixed(2)}ms total, ${avgScrollTime.toFixed(2)}ms avg per scroll`);

    // Count actual blocks
    const paragraphs = editor.querySelectorAll('p');
    console.log(`📝 Total paragraphs in DOM: ${paragraphs.length}`);

    // Measure typing performance
    console.log('⌨️ Testing typing performance...');
    const typeStart = performance.now();

    editor.focus();
    for (let i = 0; i < 100; i++) {
        const event = new InputEvent('beforeinput', {
            inputType: 'insertText',
            data: 'x',
            bubbles: true,
            cancelable: true
        });
        editor.dispatchEvent(event);
    }

    const typeTime = performance.now() - typeStart;
    console.log(`✅ Typing test: ${typeTime.toFixed(2)}ms for 100 chars`);

    // Total time
    const totalTime = performance.now() - startTime;

    // Results
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📊 PERFORMANCE TEST RESULTS');
    console.log('═══════════════════════════════════════');
    console.log(`📝 Blocks generated: ${BLOCK_COUNT}`);
    console.log(`📝 DOM paragraphs: ${paragraphs.length}`);
    console.log(`⏱️ Content generation: ${generateTime.toFixed(2)}ms`);
    console.log(`⏱️ Content insertion: ${insertTime.toFixed(2)}ms`);
    console.log(`⏱️ Scroll (avg): ${avgScrollTime.toFixed(2)}ms`);
    console.log(`⏱️ Typing (100 chars): ${typeTime.toFixed(2)}ms`);
    console.log(`⏱️ Total time: ${totalTime.toFixed(2)}ms`);
    console.log('═══════════════════════════════════════');

    // Performance verdict
    if (insertTime < 1000 && avgScrollTime < 50) {
        console.log('✅ PASS: Performance is acceptable');
    } else if (insertTime < 3000 && avgScrollTime < 100) {
        console.log('⚠️ WARN: Performance could be improved');
    } else {
        console.log('❌ FAIL: Performance issues detected');
    }

    return {
        blockCount: BLOCK_COUNT,
        domParagraphs: paragraphs.length,
        generateTime,
        insertTime,
        avgScrollTime,
        typeTime,
        totalTime
    };
})();
