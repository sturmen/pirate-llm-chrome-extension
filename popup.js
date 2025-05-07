// popup.js

// Handles the settings and actions for the Pirate Rewriter extension popup.

document.addEventListener('DOMContentLoaded', () => {
    // Settings elements
    const apiUrlInput = document.getElementById('llmApiUrl');
    const modelNameInput = document.getElementById('llmModelName');
    const apiKeyInput = document.getElementById('llmApiKey');
    const saveButton = document.getElementById('saveButton');
    const settingsStatusDiv = document.getElementById('settingsStatus');

    // Action elements
    const piratifyButton = document.getElementById('piratifyButton');
    const rewriteStatusDiv = document.getElementById('rewriteStatus');

    const DEFAULT_LLM_API_URL = "http://localhost:1234/v1";
    const DEFAULT_LLM_MODEL = "llama3";

    // --- Load Saved Settings ---
    chrome.storage.sync.get(["llmApiUrl", "llmModelName", "llmApiKey"], (result) => {
        apiUrlInput.value = result.llmApiUrl || DEFAULT_LLM_API_URL;
        modelNameInput.value = result.llmModelName || DEFAULT_LLM_MODEL;
        apiKeyInput.value = result.llmApiKey || ""; // Default to empty string if not set
        if (!result.llmApiKey) {
             apiKeyInput.placeholder = "Usually 'none' or blank for LM Studio";
        }
    });

    // --- Save Settings ---
    saveButton.addEventListener('click', () => {
        settingsStatusDiv.textContent = "";
        settingsStatusDiv.className = 'status-area'; // Reset classes
        settingsStatusDiv.style.display = 'none';

        const apiUrl = apiUrlInput.value.trim();
        const modelName = modelNameInput.value.trim();
        const apiKey = apiKeyInput.value.trim();

        if (!apiUrl) {
            showStatus(settingsStatusDiv, "API URL cannot be empty, ye scallywag!", "error");
            return;
        }
        try {
            const parsedUrl = new URL(apiUrl);
            if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
                 showStatus(settingsStatusDiv, "API URL must start with http:// or https://", "error");
                 return;
            }
        } catch (_) {
            showStatus(settingsStatusDiv, "That API URL be lookin' fishy! Invalid format.", "error");
            return;
        }
        if (!modelName) {
            showStatus(settingsStatusDiv, "Avast! Ye need to enter a Model Name!", "error");
            return;
        }

        chrome.storage.sync.set({
            llmApiUrl: apiUrl,
            llmModelName: modelName,
            llmApiKey: apiKey
        }, () => {
            showStatus(settingsStatusDiv, "Settings saved, Cap'n!", "success");
            setTimeout(() => { settingsStatusDiv.style.display = 'none'; }, 3500);
        });
    });

    // --- Piratify Page Action ---
    piratifyButton.addEventListener('click', () => {
        piratifyButton.disabled = true;
        showStatus(rewriteStatusDiv, "Summonin' the kraken to rewrite the page...", "info");

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                showStatus(rewriteStatusDiv, "No active tab found, ye bilge rat!", "error");
                piratifyButton.disabled = false;
                return;
            }
            const activeTab = tabs[0];

            // Check if the URL is one the content script can run on (http/https)
            if (!activeTab.url || (!activeTab.url.startsWith("http:") && !activeTab.url.startsWith("https:"))) {
                showStatus(rewriteStatusDiv, "Cannot piratify this type o' page (e.g., chrome://). Try a regular webpage!", "error");
                piratifyButton.disabled = false;
                return;
            }

            chrome.tabs.sendMessage(
                activeTab.id,
                { type: "PIRATIFY_PAGE_CONTENT" },
                (response) => {
                    piratifyButton.disabled = false;
                    if (chrome.runtime.lastError) {
                        // This error often means the content script isn't there or isn't listening.
                        // Could be due to the page not matching <all_urls> or an issue with content script injection.
                        console.error("Piratify Error (Popup):", chrome.runtime.lastError.message);
                        showStatus(rewriteStatusDiv, `Error: ${chrome.runtime.lastError.message}. Try reloading the page or extension.`, "error");
                    } else if (response) {
                        if (response.success) {
                            showStatus(rewriteStatusDiv, response.message || "Page piratified!", "success");
                        } else {
                            showStatus(rewriteStatusDiv, response.message || "Failed to piratify page.", "error");
                            if (response.alreadyRewritten) {
                                piratifyButton.disabled = true; // Keep disabled if already done
                                piratifyButton.textContent = "✅ Already Piratified";
                            }
                        }
                    } else {
                        // No response often means the content script didn't send one or an issue occurred.
                        showStatus(rewriteStatusDiv, "No response from page. Content script might be busy or encountered an issue.", "error");
                    }
                }
            );
        });
    });

    /**
     * Helper function to display status messages in the popup.
     * @param {HTMLElement} element - The div element to show the status in.
     * @param {string} message - The message to display.
     * @param {"success" | "error" | "info"} type - The type of message.
     */
    function showStatus(element, message, type) {
        element.textContent = message;
        element.className = 'status-area'; // Reset classes
        if (type === "success") {
            element.classList.add('status-success');
        } else if (type === "error") {
            element.classList.add('status-error');
        } else {
            element.classList.add('status-info');
        }
        element.style.display = 'block';
    }
});