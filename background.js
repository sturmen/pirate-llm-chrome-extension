// background.js

// Service worker for the Pirate Rewriter extension.
// Handles API calls to the local LLM.

const DEFAULT_LLM_API_URL = "http://localhost:1234/v1"; // Default for LM Studio
const DEFAULT_LLM_MODEL = "llama3"; // A popular default, user can change
const PIRATE_CHUNK_SEPARATOR = "%%PIRATE_CHUNK_SEPARATOR%%"; // Must match content.js

/**
 * Fetches the LLM configuration from chrome.storage.sync.
 * @returns {Promise<object>} A promise that resolves to an object with { apiUrl, modelName, apiKey }.
 */
async function getLlmConfig() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["llmApiUrl", "llmModelName", "llmApiKey"], (result) => {
            resolve({
                apiUrl: result.llmApiUrl || DEFAULT_LLM_API_URL,
                modelName: result.llmModelName || DEFAULT_LLM_MODEL,
                apiKey: result.llmApiKey || null // API key is optional, LM Studio often uses "none" or empty
            });
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "rewriteText") {
        console.log("Background: Received text to rewrite:", request.text.substring(0, 100) + "...");

        getLlmConfig().then(async ({ apiUrl, modelName, apiKey }) => {
            if (!apiUrl.endsWith('/')) { // Ensure trailing slash for base URL
                apiUrl += '/';
            }
            const fullApiUrl = `${apiUrl}chat/completions`; // Standard OpenAI endpoint path

            // Updated system prompt to be more explicit about the separator
            const systemPrompt = `You are a master pirate text rewriter, Cap'n! Ye be tasked with takin' plain landlubber's text and makin' it sound like it came from the mouth o' the fiercest buccaneer to ever sail the seven seas!
IMPORTANT INSTRUCTIONS, MATEY:
1.  The user will give ye text segments. These segments are separated by the special marker: '${PIRATE_CHUNK_SEPARATOR}'.
2.  Ye MUST rewrite each segment into authentic, colorful pirate speak. Be creative, use pirate slang, and make it fun!
3.  In yer response, ye MUST keep the exact '${PIRATE_CHUNK_SEPARATOR}' marker between each rewritten segment. Do not add it at the very beginning or very end of your entire response.
4.  The number o' rewritten segments in yer output, separated by the marker, MUST exactly match the number o' original segments provided by the user. For example, if the input is "Hello world.${PIRATE_CHUNK_SEPARATOR}How are you?", your output must be something like "Ahoy, matey!${PIRATE_CHUNK_SEPARATOR}How be ye farin'?".
5.  Do not add any extra text or explanations before the first rewritten segment or after the last one. Only provide the rewritten segments and their separators.
Failure to follow these rules will have ye walkin' the plank! Now, show 'em what ye got! Arr!`;

            const messages = [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": request.text }
            ];

            const headers = {
                "Content-Type": "application/json",
            };
            // For LM Studio, API key is often not needed or a dummy one like "none" is used.
            // If the user provides one, we'll use it.
            if (apiKey && apiKey.trim() !== "" && apiKey.trim().toLowerCase() !== "none") {
                headers["Authorization"] = `Bearer ${apiKey}`;
            }

            console.log(`Background: Sending to LLM: ${fullApiUrl}, Model: ${modelName}`);

            try {
                const response = await fetch(fullApiUrl, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify({
                        model: modelName,
                        messages: messages,
                        temperature: 0.7,
                        // stream: false // LM Studio supports streaming, but keeping it simple for now
                    }),
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
                    // Some models might add a leading/trailing separator if the prompt isn't perfectly followed.
                    // Let's try to clean it up defensively.
                    if (rewrittenText.startsWith(PIRATE_CHUNK_SEPARATOR)) {
                        rewrittenText = rewrittenText.substring(PIRATE_CHUNK_SEPARATOR.length);
                    }
                    if (rewrittenText.endsWith(PIRATE_CHUNK_SEPARATOR)) {
                        rewrittenText = rewrittenText.substring(0, rewrittenText.length - PIRATE_CHUNK_SEPARATOR.length);
                    }
                    console.log("Background: Received rewritten text from LLM:", rewrittenText.substring(0, 100) + "...");
                    sendResponse({ rewrittenText: rewrittenText });
                } else {
                    console.error("Background: LLM API response format unexpected:", data);
                    sendResponse({ error: "LLM API response was empty or in an unexpected format." });
                }

            } catch (error) {
                console.error("Background: Error calling LLM API:", error);
                sendResponse({ error: `Failed to connect to LLM: ${error.message}. Is your local LLM server (e.g., LM Studio) running at ${apiUrl} and configured correctly? Check CORS settings on LM Studio if issues persist.` });
            }
        });
        return true; // Indicates that the response will be sent asynchronously
    }
});

console.log("Pirate Rewriter Background Script Loaded (v1.2 - LM Studio & Button)");