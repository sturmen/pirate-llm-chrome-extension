
// This script runs on web pages to inject a button and, on click,
// extract text and replace it with pirate speak.

const PIRATE_CHUNK_SEPARATOR = "%%PIRATE_CHUNK_SEPARATOR%%"; // A more robust separator
let originalElements = []; // To store references to the DOM elements
let rewriteButton = null; // Reference to the rewrite button

/**
 * Attempts to find the main content area of the page.
 * @returns {HTMLElement} The main content element, or document.body as a fallback.
 */
function findMainContentElement() {
    const selectors = [
        'article',
        'main',
        '.main-content',
        '#main-content',
        '.post-content',
        '#post-content',
        '.entry-content',
        '.td-post-content',
        '.story-content',
        'div[itemprop="articleBody"]',
    ];
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log(`Pirate Rewriter: Found main content with selector: ${selector}`);
            return element;
        }
    }
    console.log("Pirate Rewriter: Could not identify a specific main content area. Using document.body as fallback.");
    return document.body;
}

/**
 * Extracts text from relevant elements within the main content area.
 */
function extractAndProcessText() {
    if (document.body.hasAttribute('data-pirate-rewritten')) {
        console.log("Pirate Rewriter: Page already rewritten. Ignoring button click.");
        if(rewriteButton) {
            rewriteButton.textContent = "🏴‍☠️ Page Piratified!";
            rewriteButton.classList.add('pirate-rewritten');
            rewriteButton.disabled = true;
        }
        return;
    }

    const mainContentElement = findMainContentElement();
    if (!mainContentElement) {
        console.error("Pirate Rewriter: No main content element found.");
        if(rewriteButton) {
            rewriteButton.textContent = "Error: No Content";
            rewriteButton.classList.add('pirate-error');
        }
        return;
    }

    const textBearingElements = Array.from(mainContentElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, span, div'));
    originalElements = [];
    const textsToRewrite = [];

    textBearingElements.forEach(el => {
        if (el.closest('nav, header, footer, aside, script, style, noscript, [role="navigation"], [role="banner"], [role="complementary"], [role="contentinfo"]')) {
            return; // Skip common non-article sections
        }
        if (el.offsetParent === null || el.textContent.trim().length < 15) { // Increased min length
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
            let hasUnselectableChild = false;
            for(let child of el.getElementsByTagName('*')) {
                const childStyle = window.getComputedStyle(child);
                if(childStyle.userSelect === 'none' || childStyle.display === 'none' || childStyle.visibility === 'hidden') {
                    hasUnselectableChild = true;
                    break;
                }
            }
            if(hasUnselectableChild) return;

            const text = el.textContent.trim(); // Use textContent for capture, but be mindful of what it grabs
            if (text) {
                originalElements.push({ element: el, originalText: text });
                textsToRewrite.push(text);
            }
        }
    });

    if (textsToRewrite.length > 0) {
        console.log(`Pirate Rewriter: Found ${textsToRewrite.length} text segments to rewrite.`);
        const combinedText = textsToRewrite.join(PIRATE_CHUNK_SEPARATOR);
        
        if (rewriteButton) {
            rewriteButton.textContent = "⏳ Piratifyin'...";
            rewriteButton.classList.add('loading');
            rewriteButton.disabled = true;
        }
        
        const banner = document.createElement('div');
        banner.id = 'pirate-rewriter-banner';
        banner.textContent = '🏴‍☠️ Shiver me timbers! Rewritin\' this page, arrr...';
        document.body.appendChild(banner);
        document.body.style.cursor = 'wait';

        chrome.runtime.sendMessage(
            { type: "rewriteText", text: combinedText },
            (response) => {
                document.body.style.cursor = 'default';
                const existingBanner = document.getElementById('pirate-rewriter-banner');
                if (existingBanner) existingBanner.remove();

                if (rewriteButton) {
                    rewriteButton.classList.remove('loading');
                    rewriteButton.disabled = false; // Re-enable unless successful
                }

                if (chrome.runtime.lastError) {
                    console.error("Pirate Rewriter Error:", chrome.runtime.lastError.message);
                    alert(`Pirate Rewriter Error: ${chrome.runtime.lastError.message}. Check background script console.`);
                     if (rewriteButton) {
                        rewriteButton.textContent = "☠️ Rewrite Failed";
                        rewriteButton.classList.add('pirate-error');
                    }
                    return;
                }
                if (response && response.error) {
                    console.error("Pirate Rewriter LLM Error:", response.error);
                    alert(`Pirate Rewriter LLM Error: ${response.error}. Check your LLM server and settings.`);
                    if (rewriteButton) {
                        rewriteButton.textContent = "☠️ LLM Error";
                        rewriteButton.classList.add('pirate-error');
                    }
                } else if (response && response.rewrittenText) {
                    console.log("Pirate Rewriter: Received rewritten text.");
                    // Ensure the separator is not empty before splitting
                    const rewrittenChunks = PIRATE_CHUNK_SEPARATOR ? response.rewrittenText.split(PIRATE_CHUNK_SEPARATOR) : [response.rewrittenText];
                    
                    if (rewrittenChunks.length === originalElements.length) {
                        originalElements.forEach((item, index) => {
                            if (item.element.isConnected) {
                                item.element.textContent = rewrittenChunks[index];
                            }
                        });
                        console.log("Pirate Rewriter: Page content rewritten!");
                        document.body.setAttribute('data-pirate-rewritten', 'true');
                        if (rewriteButton) {
                            rewriteButton.textContent = "🏴‍☠️ Page Piratified!";
                            rewriteButton.classList.add('pirate-rewritten');
                            rewriteButton.disabled = true;
                        }
                    } else {
                        console.error("Pirate Rewriter: Mismatch between original and rewritten chunk count.",
                            `Original: ${originalElements.length}, Rewritten: ${rewrittenChunks.length}`);
                        alert("Pirate Rewriter: Arr, th' translation be a bit muddled! Some parts may not have been rewritten correctly.");
                        if (rewriteButton) {
                            rewriteButton.textContent = "⚠️ Partial Rewrite";
                            rewriteButton.classList.add('pirate-error'); // Or a warning class
                        }
                    }
                } else {
                    console.error("Pirate Rewriter: No response or invalid response from background script.");
                    if (rewriteButton) {
                        rewriteButton.textContent = "☠️ No Response";
                        rewriteButton.classList.add('pirate-error');
                    }
                }
            }
        );
    } else {
        console.log("Pirate Rewriter: No suitable text found to rewrite on this page.");
        if (rewriteButton) {
            rewriteButton.textContent = "⚓ No Text Found";
            rewriteButton.disabled = true;
        }
    }
}

/**
 * Injects the rewrite button onto the page.
 */
function injectRewriteButton() {
    if (document.getElementById('pirate-rewrite-button')) {
        return; // Button already exists
    }

    rewriteButton = document.createElement('button');
    rewriteButton.id = 'pirate-rewrite-button';
    
    // Create an SVG icon for the button (simple pirate flag)
    const iconSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="24px" height="24px">
            <path d="M0 0h24v24H0z" fill="none"/>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2.14c1.72.45 3 2 3 3.86 0 2.21-1.79 4-4 4s-4-1.79-4-4c0-1.86 1.28-3.41 3-3.86V7zm0 6.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zM12 4c-1.95 0-3.7.74-5.09 1.97L12 11l5.09-5.03C15.7 4.74 13.95 4 12 4z" transform="scale(0.8) translate(3,3)"/>
            <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6zm3.6 8h-2.9l-.4-2H7v-3h5.1l.4 2H18v3z"/>
        </svg>
    `;
    // A more thematic text:
    rewriteButton.innerHTML = `<img src="${chrome.runtime.getURL("icons/pirate-flag.svg")}" alt="Pirate Flag"> Rewrite in Pirate Speak`;
    
    rewriteButton.addEventListener('click', () => {
        // Reset button state if it was in error from previous attempt on another page perhaps
        rewriteButton.classList.remove('pirate-error', 'pirate-rewritten');
        rewriteButton.disabled = false;
        extractAndProcessText();
    });

    document.body.appendChild(rewriteButton);
    console.log("Pirate Rewriter: Rewrite button injected.");

    // Create an icon file icons/pirate-flag.svg with simple SVG content.
    // Example SVG for icons/pirate-flag.svg:
    /*
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="white">
      <rect x="10" y="10" width="80" height="60" fill="black"/>
      <circle cx="50" cy="40" r="10" fill="white"/>
      <rect x="45" y="25" width="10" height="30" fill="white"/>
      <rect x="35" y="50" width="30" height="10" fill="white"/>
      <line x1="30" y1="30" x2="70" y2="50" stroke="white" stroke-width="5"/>
      <line x1="30" y1="50" x2="70" y2="30" stroke="white" stroke-width="5"/>
      <rect x="5" y="5" width="5" height="90" fill="#795548"/>
    </svg>
    */
    // Ensure you have this SVG file in your icons folder and listed in web_accessible_resources.
}

// --- Main execution ---
// Check if the page is primarily text-based or an application
// and avoid running on frames or non-HTML documents.
if (window.top === window && document.contentType === 'text/html' && !document.body.classList.contains('application')) {
    // Check if we've already injected the button (e.g. for SPA navigation)
    if (!document.getElementById('pirate-rewrite-button')) {
         // Inject the button after a small delay to ensure page is more settled
        setTimeout(injectRewriteButton, 500);
    }
} else {
    console.log("Pirate Rewriter: Not injecting button (not top window, not HTML, or is an application).");
}