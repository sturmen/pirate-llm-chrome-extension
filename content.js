// content.js

// This script runs on web pages to extract text and replace it with pirate speak
// when instructed by the popup. All text is combined for a single API call.

const PIRATE_CHUNK_SEPARATOR = "%%PIRATE_CHUNK_SEPARATOR%%";
let originalElements = []; // To store references to the DOM elements and their original text

/**
 * Attempts to find the main content area of the page.
 * Uses a list of common selectors for articles and main content.
 * @returns {HTMLElement} The main content element, or document.body as a fallback.
 */
function findMainContentElement() {
    const selectors = [
        'article', // Standard article tag
        'main',    // Standard main landmark
        '.post-content', // Common class for post content
        '.entry-content', // Another common class for entries
        'div[itemprop="articleBody"]', // Schema.org markup
        '#main-content', // Common ID
        '#content',      // Another common ID
        '.td-post-content', // Theme-specific
        '.story-content'    // Common in news sites
    ];
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log(`Pirate Rewriter (Content): Found main content with selector: ${selector}`);
            return element;
        }
    }
    console.log("Pirate Rewriter (Content): Could not identify a specific main content area with common selectors. Using document.body as fallback (results may vary).");
    return document.body;
}

/**
 * Extracts text from relevant elements, sends it for rewriting (combined), and replaces it.
 * @param {function} sendResponseToPopup - Function to call to send a response back to the popup.
 */
function extractAndProcessTextCombined(sendResponseToPopup) {
    // Check if the page has already been rewritten in the current session to avoid re-processing.
    if (document.body.hasAttribute('data-pirate-rewritten-session')) {
        console.log("Pirate Rewriter (Content): Page already marked as rewritten in this session.");
        sendResponseToPopup({ success: false, message: "Page already rewritten in this session.", alreadyRewritten: true });
        return;
    }

    const mainContentElement = findMainContentElement();
    if (!mainContentElement) {
        // This case should ideally not be hit due to document.body fallback, but good to have.
        console.error("Pirate Rewriter (Content): No main content element found.");
        sendResponseToPopup({ success: false, message: "No main content element found on page." });
        return;
    }

    originalElements = []; // Reset for each run
    const textsToRewrite = [];
    // Target specific elements likely to contain distinct blocks of text.
    const textBearingSelectors = 'p, h1, h2, h3, h4, h5, h6, li';
    const textBearingElements = Array.from(mainContentElement.querySelectorAll(textBearingSelectors));

    textBearingElements.forEach(el => {
        // Skip elements within common non-article sections like nav, header, footer, aside, etc.
        if (el.closest('nav, header, footer, aside, script, style, noscript, [role="navigation"], [role="banner"], [role="complementary"], [role="contentinfo"], .ad-wrapper, .ad-container, .advertisement, .related-posts, .comments-area, .author-bio, .site-footer, .site-header-main')) {
            return;
        }

        // Element should be visible and contain more than just whitespace (at least 15 chars).
        const currentTextContent = el.textContent.trim();
        if (el.offsetParent === null || currentTextContent.length < 15) {
            return;
        }

        // Check computed styles to avoid hidden or non-interactive elements.
        const style = window.getComputedStyle(el);
        if (style.userSelect === 'none' || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return;
        }
        // Check if any parent is effectively hidden (this can be complex, basic check here)
        let parent = el.parentElement;
        let hiddenParentFound = false;
        while (parent && parent !== mainContentElement && parent !== document.body) {
            const parentStyle = window.getComputedStyle(parent);
            if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || parentStyle.opacity === '0') {
                hiddenParentFound = true;
                break;
            }
            parent = parent.parentElement;
        }
        if (hiddenParentFound) return;


        // The text content is substantial enough, add it.
        originalElements.push({ element: el, originalText: currentTextContent });
        textsToRewrite.push(currentTextContent);
    });

    if (textsToRewrite.length > 0) {
        console.log(`Pirate Rewriter (Content): Found ${textsToRewrite.length} text segments to rewrite (combined).`);
        const combinedText = textsToRewrite.join(PIRATE_CHUNK_SEPARATOR);

        document.body.style.cursor = 'wait'; // Visual feedback on the page

        // Send the combined text to background.js for rewriting
        chrome.runtime.sendMessage(
            { type: "rewriteCombinedText", text: combinedText },
            (responseFromBackground) => {
                document.body.style.cursor = 'default'; // Reset cursor
                if (chrome.runtime.lastError) {
                    console.error("Pirate Rewriter (Content) Error communicating with background:", chrome.runtime.lastError.message);
                    sendResponseToPopup({ success: false, message: `Extension error: ${chrome.runtime.lastError.message}` });
                    return;
                }
                if (responseFromBackground && responseFromBackground.error) {
                    console.error("Pirate Rewriter (Content) LLM Error:", responseFromBackground.error);
                    sendResponseToPopup({ success: false, message: `LLM Error: ${responseFromBackground.error}` });
                } else if (responseFromBackground && responseFromBackground.rewrittenText) {
                    console.log("Pirate Rewriter (Content): Received combined rewritten text from background.");
                    const rewrittenChunks = responseFromBackground.rewrittenText.split(PIRATE_CHUNK_SEPARATOR);

                    if (rewrittenChunks.length === originalElements.length) {
                        originalElements.forEach((item, index) => {
                            // Ensure element is still part of the DOM and chunk exists
                            if (item.element.isConnected && rewrittenChunks[index] !== undefined) {
                                item.element.textContent = rewrittenChunks[index];
                            }
                        });
                        console.log("Pirate Rewriter (Content): Page content rewritten!");
                        document.body.setAttribute('data-pirate-rewritten-session', 'true'); // Mark as rewritten
                        sendResponseToPopup({ success: true, message: "Page successfully piratified!" });
                    } else {
                        // Mismatch in chunk count can happen if LLM doesn't follow separator instructions perfectly.
                        console.error("Pirate Rewriter (Content): Mismatch between original and rewritten chunk count.",
                            `Original: ${originalElements.length}, Rewritten: ${rewrittenChunks.length}`);
                        sendResponseToPopup({ success: false, message: "Translation error: Text chunk mismatch after rewrite. Some content might not be changed." });
                    }
                } else {
                    console.error("Pirate Rewriter (Content): No response or invalid response from background script.");
                    sendResponseToPopup({ success: false, message: "Invalid response from background script." });
                }
            }
        );
    } else {
        console.log("Pirate Rewriter (Content): No suitable text found to rewrite on this page after filtering.");
        sendResponseToPopup({ success: false, message: "No suitable text found on this page to rewrite." });
    }
}

// Listen for messages from the popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "PIRATIFY_PAGE_CONTENT") {
        console.log("Pirate Rewriter (Content): Received PIRATIFY_PAGE_CONTENT message from popup.");
        extractAndProcessTextCombined(sendResponse); // Call the combined processing function
        return true; // Indicates that the response will be sent asynchronously.
    }
});

console.log("Pirate Rewriter Content Script Loaded (v1.4.2 - Combined API Call, Refined Selection)");
