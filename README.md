# Pirate LLM Extension

## What is it?

This is a Chrome extension that calls out to an LLM to rewrite the article text of any webpage into pirate speak.

## How did you make it?

I [vibe coded](https://en.wikipedia.org/wiki/Vibe_coding) this with [Google Gemini 2.5 Pro](https://gemini.google.com/app). Don't ask me how this extension works, because I never bothered to learn!

## How do you use it?

Clone this repo and follow Google's tutorial on loading unpacked extensions: [Hello World extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)

For the "brains" behind the extension, I run [LM Studio](https://lmstudio.ai) on my MacBook Pro, and point this extension at its server.
For this particular use case, I think the [Gemma 3 12B QAT](https://model.lmstudio.ai/download/lmstudio-community/gemma-3-12B-it-qat-GGUF) model is a good tradeoff between resource usage and quality. It doesn't work with the 4B model for some reason, something to do with chunk sizes. You'll get even better results with better models, like Gemma 3 27B.

Then, just pin the extension to your toolbar and follow the instructions in the popup!