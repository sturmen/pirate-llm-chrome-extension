// content.js

// This script runs on web pages to extract text and replace it with pirate speak
// when instructed by the popup.

const PIRATE_CHUNK_SEPARATOR = "%%PIRATE_CHUNK_SEPARATOR%%";
let originalElements = [];

/**
 * Attempts to find the main content area of the page.
 * @returns {HTMLElement} The main content element, or document.body as a fallback.
 */
function findMainContentElement() {
    const selectors = [
        'article', 'main', '.main-content', '#main-content',
        '.post-content', '#post-content', '.entry-content',
        '.td-post-content', '.story-content', 'div[itemprop="articleBody"]',
    ];
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log(`Pirate Rewriter (Content): Found main content with selector: ${selector}`);
            return element;
        }
    }
    console.log("Pirate Rewriter (Content): Could not identify a specific main content area. Using document.body as fallback.");
    return document.body;
}

/**
 * Extracts text, sends it for rewriting, and replaces it.
 * @param {function} sendResponse - Function to call to send a response back to the popup.
 */
function extractAndProcessText(sendResponseToPopup) {
    if (document.body.hasAttribute('data-pirate-rewritten-session')) {
        console.log("Pirate Rewriter (Content): Page already marked as rewritten in this session.");
        sendResponseToPopup({ success: false, message: "Page already rewritten in this session.", alreadyRewritten: true });
        return;
    }

    const mainContentElement = findMainContentElement();
    if (!mainContentElement) {
        console.error("Pirate Rewriter (Content): No main content element found.");
        sendResponseToPopup({ success: false, message: "No main content element found on page." });
        return;
    }

    originalElements = [];
    const textsToRewrite = [];
    // Query for elements that are likely to contain readable text.
    const textBearingElements = Array.from(mainContentElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, span, div'));

    textBearingElements.forEach(el => {
        if (el.closest('nav, header, footer, aside, script, style, noscript, [role="navigation"], [role="banner"], [role="complementary"], [role="contentinfo"]')) {
            return;
        }
        if (el.offsetParent === null || el.textContent.trim().length < 15) {
            return;
        }
        if (originalElements.some(oe => oe.element.contains(el) || el.contains(oe.element))) {
            return;
        }
        let directText = "";
        for (let i = 0; i < el.childNodes.length; i++) {
            if (el.childNodes[i].nodeType === Node.TEXT_NODE) {
                directText += el.childNodes[i].nodeValue;
            }
        }
        directText = directText.trim();
        if (directText.length > 15 || (el.children.length === 0 && el.textContent.trim().length > 15)) {
            const style = window.getComputedStyle(el);
            if (style.userSelect === 'none' || style.display === 'none' || style.visibility === 'hidden') {
                return;
            }
            let hasUnselectableOrHiddenChild = false;
            for(let child of el.getElementsByTagName('*')) {
                const childStyle = window.getComputedStyle(child);
                if(childStyle.userSelect === 'none' || childStyle.display === 'none' || childStyle.visibility === 'hidden') {
                    hasUnselectableOrHiddenChild = true;
                    break;
                }
            }
            if(hasUnselectableOrHiddenChild) return;
            const text = el.textContent.trim();
            if (text) {
                originalElements.push({ element: el, originalText: text });
                textsToRewrite.push(text);
            }
        }
    });

    if (textsToRewrite.length > 0) {
        console.log(`Pirate Rewriter (Content): Found ${textsToRewrite.length} text segments to rewrite.`);
        const combinedText = textsToRewrite.join(PIRATE_CHUNK_SEPARATOR);
        
        document.body.style.cursor = 'wait'; // Visual feedback on the page

        chrome.runtime.sendMessage(
            { type: "rewriteText", text: combinedText }, // This message goes to background.js
            (responseFromBackground) => {
                document.body.style.cursor = 'default';
                if (chrome.runtime.lastError) {
                    console.error("Pirate Rewriter (Content) Error communicating with background:", chrome.runtime.lastError.message);
                    sendResponseToPopup({ success: false, message: `Extension error: ${chrome.runtime.lastError.message}` });
                    return;
                }
                if (responseFromBackground && responseFromBackground.error) {
                    console.error("Pirate Rewriter (Content) LLM Error:", responseFromBackground.error);
                    sendResponseToPopup({ success: false, message: `LLM Error: ${responseFromBackground.error}` });
                } else if (responseFromBackground && responseFromBackground.rewrittenText) {
                    console.log("Pirate Rewriter (Content): Received rewritten text from background.");
                    const rewrittenChunks = PIRATE_CHUNK_SEPARATOR ? responseFromBackground.rewrittenText.split(PIRATE_CHUNK_SEPARATOR) : [responseFromBackground.rewrittenText];
                    
                    if (rewrittenChunks.length === originalElements.length) {
                        originalElements.forEach((item, index) => {
                            if (item.element.isConnected) {
                                item.element.textContent = rewrittenChunks[index];
                            }
                        });
                        console.log("Pirate Rewriter (Content): Page content rewritten!");
                        document.body.setAttribute('data-pirate-rewritten-session', 'true'); // Mark as rewritten for this session
                        sendResponseToPopup({ success: true, message: "Page successfully piratified!" });
                    } else {
                        console.error("Pirate Rewriter (Content): Mismatch between original and rewritten chunk count.",
                            `Original: ${originalElements.length}, Rewritten: ${rewrittenChunks.length}`);
                        sendResponseToPopup({ success: false, message: "Translation error: Text chunk mismatch." });
                    }
                } else {
                    console.error("Pirate Rewriter (Content): No response or invalid response from background script.");
                    sendResponseToPopup({ success: false, message: "Invalid response from background." });
                }
            }
        );
    } else {
        console.log("Pirate Rewriter (Content): No suitable text found to rewrite on this page.");
        sendResponseToPopup({ success: false, message: "No suitable text found on this page to rewrite." });
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "PIRATIFY_PAGE_CONTENT") {
        console.log("Pirate Rewriter (Content): Received PIRATIFY_PAGE_CONTENT message from popup.");
        extractAndProcessText(sendResponse);
        return true; // Indicates that the response will be sent asynchronously.
    }
});

console.log("Pirate Rewriter Content Script Loaded (v1.4 - Popup Activation)");