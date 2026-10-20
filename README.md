# The Chair: self-hosted edition

A CEO/CTO training simulator you can host yourself. Scenarios are written by Groq or any other provider that speaks the "OpenAI-compatible" format. If no AI is configured, the game still works with its built-in library of 12 scenarios.

## How it fits together

There are two pieces:

- **`public/index.html`** is the game itself. It runs in the player's browser.
- **`server.js`** is a small backend. A backend is a program running on a computer you control, as opposed to the visitor's browser. It sends the game page to visitors, and it passes the game's AI requests on to Groq.

That makes the server a **proxy**: a middleman that forwards requests on someone else's behalf.

The reason for the middleman is your **API key**, the secret password that lets your account use Groq. If the key sat inside `index.html`, anyone could open the page source, copy it and spend your quota.

Think of a restaurant. Diners (browsers) give orders to the waiter (your server). Only the waiter goes into the kitchen (Groq) and carries the house account card (your key).

```
Browser ──POST /api/llm──▶ server.js ──(adds secret key)──▶ Groq
        ◀──scenario JSON──           ◀──────────────────────
```

The game asks the AI for **JSON** (JavaScript Object Notation), a structured text format that code can read reliably. That way each scenario comes back with labeled fields: title, options, effects and so on.

## 1. Get a free Groq API key

1. Sign up at https://console.groq.com. No credit card is needed for the free plan.
2. Open **API Keys** and select **Create API Key**.
3. Copy the key, which starts with `gsk_`. Groq shows it only once.

## 2. Run it on your own computer first

You need **Node.js** version 18 or newer. Node is the program that runs JavaScript outside a browser; get it from https://nodejs.org.

1. In this folder, copy `.env.example` to a new file named `.env`.
2. Paste your key after `LLM_API_KEY=`. A `.env` file holds **environment variables**: settings the server reads when it starts, kept out of the code.
3. In a terminal, run:

   ```
   npm start
   ```

4. Open http://localhost:3000. "localhost" means "this computer," and 3000 is the door number (port) the server listens on.

On the setup screen, "Written by AI" should be selectable and show the model name.

There are no packages to install, because the server only uses what ships with Node.

## 3. Put it online for free (Render)

To **deploy** is to copy your app onto a computer on the internet so others can reach it. Render has a free tier that suits this.

1. Put this folder in a GitHub repository. `.gitignore` already keeps your `.env` file (and key) out of it.
2. At https://render.com, choose **New**, then **Web Service**, and connect the repository.
3. Use these settings:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free
4. Under **Environment**, add `LLM_API_KEY` with your Groq key. If you're sharing the link publicly, also add `ACCESS_CODE` (see section 5).
5. Select **Deploy**. You'll get an address like `https://the-chair-xxxx.onrender.com`.

**Cold starts:** free Render services go to sleep after 15 minutes without visitors. The next visit takes up to about a minute while the server wakes up. If the first briefing fails with "Couldn’t reach the AI server," wait a moment and select **Try again**.

The same folder runs anywhere that can run Node, such as Railway, Fly.io, a home server or a cheap VPS (virtual private server, a rented computer in a data center). Set the same environment variables and run `npm start`.

## 4. Using a different provider

The server talks to anything with an OpenAI-compatible `/chat/completions` endpoint. An **endpoint** is a specific web address an API answers on.

To switch, change these three settings:

| Provider | `LLM_BASE_URL` | `LLM_MODEL` | Notes |
|---|---|---|---|
| Groq (default) | `https://api.groq.com/openai/v1` | `openai/gpt-oss-120b` | Very fast; free plan has rate limits |
| OpenRouter | `https://openrouter.ai/api/v1` | a model ID ending in `:free` | Many free models, with tight daily limits |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | a current Gemini model name | Key from Google AI Studio |
| Ollama (on your own machine) | `http://localhost:11434/v1` | e.g. `llama3.1` | Fully free and offline; set any text as `LLM_API_KEY` |

Model catalogs change often, so check each provider's model list for current names.

If a provider rejects JSON mode or the `reasoning_effort` setting, the server automatically retries without them. You can also turn them off with `LLM_JSON_MODE=false` and an empty `LLM_REASONING_EFFORT=`.

Smaller models sometimes write sloppier scenarios or broken JSON. If that happens often, use a larger model.

## 5. Protecting your free quota

A **rate limit** is a cap on how many requests are allowed in a period of time. Groq's free plan applies one to your whole account. Its sample limits for `openai/gpt-oss-120b` are about:

- 30 requests and 8,000 tokens per minute
- 1,000 requests and 200,000 tokens per day

A **token** is a chunk of text, roughly three-quarters of a word. One briefing uses roughly 3,000 to 5,000 tokens, so expect a few dozen AI scenarios a day. Check your current limits in Groq's console.

The server adds three protections of its own:

- **`ACCESS_CODE`:** a shared password. If set, visitors must enter it before AI features work. The built-in library stays open to everyone.
- **`RATE_LIMIT_PER_MINUTE` and `RATE_LIMIT_PER_DAY`:** limits per visitor. They default to 6 and 150.
- **Fixed model and token cap:** visitors can't choose the model or ask for huge responses.

If you share the link widely, set an access code. Otherwise one enthusiastic stranger can use up your daily quota.

## Troubleshooting

- **"Written by AI" is greyed out.** The server has no key. Check `LLM_API_KEY` is set, then restart (on Render, redeploy).
- **"Switched to the built-in library."** The provider rejected your key. Check for typos or a revoked key.
- **"You’ve reached a usage limit."** Either the provider's or the server's rate limit was hit. Wait a minute.
- **Something else fails.** The server prints provider errors in its logs. On Render, open the service's **Logs** tab.

Saved games live in each visitor's browser (local storage). Clearing browser data, or switching devices, starts fresh.
