/**
 * Utility function to clean and format quiz titles.
 * Removes HTML entities like &quot;, &amp;, prefixes like CONTEXT:, Topic:, Assessment:,
 * and leading/trailing quotes.
 */
export function cleanQuizTitle(title) {
    if (!title || typeof title !== 'string') return 'Untitled Quiz';

    let cleaned = title;

    // 1. Decode common HTML entities (handles &quot;, &QUOT;, &amp;, &#39;, &#x27;, &lt;, &gt;, &nbsp;)
    cleaned = cleaned
        .replace(/&(quot|QUOT);/gi, '"')
        .replace(/&(amp|AMP);/gi, '&')
        .replace(/&(apos|APOS);/gi, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&#39;/gi, "'")
        .replace(/&(lt|LT);/gi, '<')
        .replace(/&(gt|GT);/gi, '>')
        .replace(/&(nbsp|NBSP);/gi, ' ');

    // 2. Decode using DOMParser if in browser environment for any remaining entities
    if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
        try {
            const doc = new DOMParser().parseFromString(cleaned, 'text/html');
            cleaned = doc.body.textContent || cleaned;
        } catch (e) {
            // Fallback if parsing fails
        }
    }

    // 3. Remove prefixes like "Context:", "CONTEXT:", "Topic:", "Quiz:", "Assessment:"
    cleaned = cleaned.replace(/^(context|topic|quiz|assessment)\s*:\s*/i, '');

    // 4. Strip surrounding quotation marks ("..." or '...')
    cleaned = cleaned.replace(/^["'\u201c\u201d]+|["'\u201c\u201d]+$/g, '');

    // 5. Trim leading/trailing whitespace
    cleaned = cleaned.trim();

    return cleaned || 'Untitled Quiz';
}

export default cleanQuizTitle;
