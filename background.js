// background.js

// Service worker for the Pirate Rewriter extension.
// Handles API calls to the local LLM. (Largely unchanged)

const DEFAULT_LLM_API_URL = "http://localhost:1234/v1"; // Default for LM Studio
const DEFAULT_LLM_MODEL = "llama3";
const PIRATE_CHUNK_SEPARATOR = "%%PIRATE_CHUNK_SEPARATOR%%";

async function getLlmConfig() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["llmApiUrl", "llmModelName", "llmApiKey"], (result) => {
            resolve({
                apiUrl: result.llmApiUrl || DEFAULT_LLM_API_URL,
                modelName: result.llmModelName || DEFAULT_LLM_MODEL,
                apiKey: result.llmApiKey || null
            });
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "rewriteText") { // This message comes from content.js
        console.log("Background: Received 'rewriteText' request.");

        getLlmConfig().then(async ({ apiUrl, modelName, apiKey }) => {
            if (!apiUrl.endsWith('/')) {
                apiUrl += '/';
            }
            const fullApiUrl = `${apiUrl}chat/completions`;
            const systemPrompt = `You are a master pirate text rewriter, Cap'n! Ye be tasked with takin' plain landlubber's text and makin' it sound like it came from the mouth o' the fiercest buccaneer to ever sail the seven seas!
IMPORTANT INSTRUCTIONS, MATEY:
1.  The user will give ye text segments. These segments are separated by the special marker: '${PIRATE_CHUNK_SEPARATOR}'.
2.  Ye MUST rewrite each segment into authentic, colorful pirate speak. Be creative, use pirate slang, and make it fun!
3.  In yer response, ye MUST keep the exact '${PIRATE_CHUNK_SEPARATOR}' marker between each rewritten segment. Do not add it at the very beginning or very end of your entire response.
4.  The number o' rewritten segments in yer output, separated by the marker, MUST exactly match the number o' original segments provided by the user.
5.  Do not add any extra text or explanations before the first rewritten segment or after the last one. Only provide the rewritten segments and their separators.
Failure to follow these rules will have ye walkin' the plank! Arr!`;

            const messages = [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": request.text }
            ];
            const headers = { "Content-Type": "application/json" };
            if (apiKey && apiKey.trim() !== "" && apiKey.trim().toLowerCase() !== "none") {
                headers["Authorization"] = `Bearer ${apiKey}`;
            }

            console.log(`Background: Sending to LLM: ${fullApiUrl}, Model: ${modelName}`);
            try {
                const response = await fetch(fullApiUrl, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify({ model: modelName, messages: messages, temperature: 0.7 }),
                });
                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error("Background: LLM API Error Status:", response.status, "Body:", errorBody);
                    sendResponse({ error: `LLM API request failed: ${response.status} ${response.statusText}. Details: ${errorBody.substring(0,200)}` });
                    return;
                }
                const data = await response.json();
                if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
                    let rewrittenText = data.choices[0].message.content;
                    if (rewrittenText.startsWith(PIRATE_CHUNK_SEPARATOR)) {
                        rewrittenText = rewrittenText.substring(PIRATE_CHUNK_SEPARATOR.length);
                    }
                    if (rewrittenText.endsWith(PIRATE_CHUNK_SEPARATOR)) {
                        rewrittenText = rewrittenText.substring(0, rewrittenText.length - PIRATE_CHUNK_SEPARATOR.length);
                    }
                    console.log("Background: Sending rewritten text back to content script.");
                    sendResponse({ rewrittenText: rewrittenText });
                } else {
                    console.error("Background: LLM API response format unexpected:", data);
                    sendResponse({ error: "LLM API response was empty or in an unexpected format." });
                }
            } catch (error) {
                console.error("Background: Error calling LLM API:", error);
                sendResponse({ error: `Failed to connect to LLM: ${error.message}.` });
            }
        });
        return true; // Indicates asynchronous response.
    }
});

console.log("Pirate Rewriter Background Script Loaded (v1.4)");