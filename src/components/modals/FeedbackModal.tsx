'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Star, Loader2 } from 'lucide-react';
import posthog from 'posthog-js';
import { useUIStore } from '@/store/uiStore';

export default function FeedbackModal() {
    const { feedbackOpen, closeFeedback } = useUIStore();

    const [rating, setRating] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const reset = useCallback(() => {
        setRating(0);
        setHoveredStar(0);
        setComment('');
        setLoading(false);
        setSubmitted(false);
    }, []);

    const handleClose = useCallback(() => {
        closeFeedback();
        reset();
    }, [closeFeedback, reset]);

    // Close on Escape
    useEffect(() => {
        if (!feedbackOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [feedbackOpen, handleClose]);

    // Auto-close after thank-you
    useEffect(() => {
        if (!submitted) return;
        const timer = setTimeout(handleClose, 2000);
        return () => clearTimeout(timer);
    }, [submitted, handleClose]);

    const handleSubmit = () => {
        if (rating === 0 || loading) return;
        setLoading(true);

        posthog.capture('feedback_submitted', {
            rating,
            comment: comment.trim(),
            has_comment: !!comment.trim(),
            page: 'dashboard',
            timestamp: new Date().toISOString(),
        });

        // Brief delay so capture fires before state change
        setTimeout(() => {
            setLoading(false);
            setSubmitted(true);
        }, 300);
    };

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 modal-overlay ${feedbackOpen ? 'modal-open' : ''}`}
            onClick={handleClose}
        >
            <div
                className="w-full max-w-[420px] bg-[#f6f8fa] border border-[#d0d7de] rounded-xl shadow-2xl modal-panel"
                onClick={(e) => e.stopPropagation()}
            >
                {submitted ? (
                    /* Thank-you state */
                    <div className="p-8 text-center">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1a7f37]/20 flex items-center justify-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a7f37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-[#1f2328] mb-1">
                            Thank you for your feedback!
                        </h3>
                        <p className="text-sm text-[#656d76]">We read every response.</p>
                    </div>
                ) : (
                    /* Feedback form */
                    <div className="p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-[#1f2328]">
                                Share your feedback
                            </h3>
                            <button
                                onClick={handleClose}
                                className="p-1 text-[#656d76] hover:text-[#1f2328] transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Star rating */}
                        <div className="mb-5">
                            <label className="block text-sm text-[#656d76] mb-2">
                                How would you rate DocBrand?
                            </label>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((n) => {
                                    const filled = n <= (hoveredStar || rating);
                                    return (
                                        <button
                                            key={n}
                                            onClick={() => setRating(n)}
                                            onMouseEnter={() => setHoveredStar(n)}
                                            onMouseLeave={() => setHoveredStar(0)}
                                            className="p-1 transition-colors"
                                        >
                                            <Star
                                                size={28}
                                                className={filled
                                                    ? 'fill-[#9a6700] text-[#9a6700]'
                                                    : 'fill-none text-[#d0d7de]'
                                                }
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Comment textarea */}
                        <div className="mb-5">
                            <label className="block text-sm text-[#656d76] mb-2">
                                Tell us more (optional)
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                                placeholder="What can we improve?"
                                rows={4}
                                className="w-full px-3 py-2 text-sm text-[#1f2328] bg-[#f6f8fa] border border-[#d0d7de] rounded-lg resize-none placeholder-[#9198a1] focus:border-[#0969da] focus:outline-none transition-colors"
                            />
                            <div className="text-xs text-[#9198a1] text-right mt-1">
                                {comment.length}/500
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-sm text-[#1f2328] border border-[#d0d7de] rounded-lg hover:bg-[#eaeef2] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={rating === 0 || loading}
                                className="px-4 py-2 text-sm text-white bg-[#0969da] hover:bg-[#2563eb] rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {loading && <Loader2 size={14} className="animate-spin" />}
                                Send Feedback
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
