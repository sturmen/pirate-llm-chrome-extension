// Handles the settings popup for the Pirate Rewriter extension.

document.addEventListener('DOMContentLoaded', () => {
    const apiUrlInput = document.getElementById('llmApiUrl');
    const modelNameInput = document.getElementById('llmModelName');
    const apiKeyInput = document.getElementById('llmApiKey');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');

    const DEFAULT_LM_STUDIO_URL = "http://localhost:1234/v1";
    const DEFAULT_MODEL_NAME = "llama3"; // Or whatever you prefer as a placeholder

    // Load saved settings
    chrome.storage.sync.get(["llmApiUrl", "llmModelName", "llmApiKey"], (result) => {
        apiUrlInput.value = result.llmApiUrl || DEFAULT_LM_STUDIO_URL;
        modelNameInput.value = result.llmModelName || DEFAULT_MODEL_NAME;
        if (result.llmApiKey) {
            apiKeyInput.value = result.llmApiKey;
        } else {
            // Suggest "none" or blank for LM Studio if no key is saved
            apiKeyInput.placeholder = "Usually 'none' or blank for LM Studio";
        }
    });

    // Save settings
    saveButton.addEventListener('click', () => {
        statusDiv.textContent = ""; // Clear previous status
        statusDiv.style.color = "red"; // Default to red for errors

        const apiUrl = apiUrlInput.value.trim();
        const modelName = modelNameInput.value.trim();
        const apiKey = apiKeyInput.value.trim();

        if (!apiUrl) {
            statusDiv.textContent = "API URL cannot be empty, ye scallywag!";
            return;
        }
        try {
            const parsedUrl = new URL(apiUrl);
            if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
                 statusDiv.textContent = "API URL must start with http:// or https://";
                 return;
            }
        } catch (_) {
            statusDiv.textContent = "That API URL be lookin' fishy! Invalid format.";
            return;
        }
        
        if (!modelName) {
            statusDiv.textContent = "Avast! Ye need to enter a Model Name!";
            return;
        }

        chrome.storage.sync.set({
            llmApiUrl: apiUrl,
            llmModelName: modelName,
            llmApiKey: apiKey // Save it even if empty, as "none" or empty is valid for some
        }, () => {
            statusDiv.textContent = "Settings saved, Cap'n! Ready to set sail!";
            statusDiv.style.color = "green";
            setTimeout(() => { statusDiv.textContent = ""; }, 3500);
        });
    });
});