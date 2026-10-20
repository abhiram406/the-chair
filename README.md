# The Chair

**Train to be a CEO or CTO, one decision at a time.**

The Chair is a browser game that puts you in charge of a company. Each turn brings a realistic dilemma. Every choice you make ripples outward: some effects land right away, some months later, and some only after your tenure ends.

<!-- Replace with your deployed address, or delete this line -->
**Play it:** https://your-app-name.onrender.com

## Features

- **Your setup.** Play as CEO (Chief Executive Officer, who runs the whole company and answers to the board) or CTO (Chief Technology Officer, who owns technology and the engineering team). Pick an industry, a company size from 12-person startup to 20,000-person enterprise, and a tenure of 1, 3, 5 or 10 years.
- **Consequences on three timescales.** A timeline shows medium- and long-term effects heading your way. Some land after you've left, and they still count toward your legacy.
- **A live company dashboard.** It tracks revenue, cash, runway, growth, profit margin, morale, customer satisfaction, tech debt, reputation and board confidence. Tap any number for a plain-language explanation.
- **Ways to lose.** Run out of cash, or lose the board's confidence, and your tenure ends early.
- **Learning built in.** Every briefing explains its jargon and includes an everyday analogy. After each decision you see the lesson, a real company case study, and how the other paths would have played out.
- **Two scenario sources.** AI-written scenarios are tailored to your industry and react to your numbers. In AI mode you can also write your own decision for the AI to judge, and ask a mentor questions. A built-in library of 37 dilemmas works without any AI at all.
- **Multi-lever decisions.** In 25 of the built-in scenarios, you don’t pick one answer: you set several levers at once, such as price, staffing and communication. Some combinations reinforce each other and some backfire, and the outcome shows how your choices interacted.
- **A final review.** It covers company value at the start, when you left, and after your long-term bets landed, along with a breakdown of your leadership style.

Progress is saved in your browser automatically.

## How it works

The project has two parts:

- **`public/index.html`** is the whole game. It runs in the player's browser.
- **`server.js`** is a small backend: a program running on a server rather than in the browser. It sends the game page to visitors, and it passes the game's AI requests on to a language model provider (Groq by default).

The server acts as a **proxy**, a middleman that forwards requests. That keeps the provider's **API key** (the secret password that lets an account use the AI service) on the server, where visitors can't see or copy it.

Think of a restaurant: diners (browsers) give orders to the waiter (the server). Only the waiter goes into the kitchen (the AI provider) and carries the house account card (the key).

```
Browser ──POST /api/llm──▶ server.js ──(adds secret key)──▶ AI provider
        ◀──scenario JSON──           ◀──────────────────────
```

The game asks for **JSON** (JavaScript Object Notation), a structured text format that code can read reliably. That way each scenario arrives with labeled fields: title, options, effects and so on.

The server has no dependencies, so there's nothing to install beyond Node.js. If no API key is configured, AI features switch off and the built-in library of 37 scenarios is used.

## Run it locally

You need **Node.js 18 or newer** (https://nodejs.org). Node is the program that runs JavaScript outside a browser.

1. Clone or download this repository.
2. Get an API key. Groq offers a free plan with no credit card: sign up at https://console.groq.com, open **API Keys**, and create one. It starts with `gsk_` and is shown only once.
3. Copy `.env.example` to a new file named `.env`, and put the key after `LLM_API_KEY=`.
   A `.env` file holds **environment variables**: settings the server reads when it starts, kept out of the code. It's listed in `.gitignore`, so it won't be committed.
4. Start the server:

   ```
   npm start
   ```

5. Open http://localhost:3000. "localhost" means "this computer," and 3000 is the port, the numbered door the server listens on.

If the setup screen lets you choose **Written by AI** and shows a model name, AI is working.

## Deploy your own copy

To **deploy** is to run the app on a computer on the internet so others can reach it. Any host that runs Node works. These steps use Render, which has a free tier.

1. Fork this repository, or push your own copy to GitHub.
2. At https://render.com, choose **New**, then **Web Service**, and connect the repository.
3. Use these settings:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free
4. Under **Environment**, add `LLM_API_KEY`. If the link will be public, also add `ACCESS_CODE` (see "Protecting your quota").
5. Deploy. Render gives you an address like `https://your-app-name.onrender.com`.

Free Render services go to sleep after about 15 minutes without visitors. The next visit can take up to a minute while the server wakes up. If the first briefing fails, wait a moment and select **Try again**.

Railway, Fly.io, a home server or a VPS (virtual private server, a rented computer in a data center) also work. Set the same environment variables and run `npm start`.

Never put an API key in `index.html` or commit it to the repository. Set it as an environment variable on your host.

## Configuration

Every setting is an environment variable. See `.env.example` for a ready-to-copy template.

| Variable | Default | What it does |
|---|---|---|
| `LLM_API_KEY` | (none) | Provider API key. AI features are off without it. |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` | The provider's OpenAI-compatible endpoint (the web address its API answers on). |
| `LLM_MODEL` | `openai/gpt-oss-120b` | Model for scenarios, custom-decision judging and the final review. |
| `LLM_QUICK_MODEL` | same as `LLM_MODEL` | Model for quick "Ask a mentor" answers. |
| `LLM_REASONING_EFFORT` | `low` | How long reasoning models think. Lower is faster and uses fewer tokens. Leave empty to never send it. |
| `LLM_JSON_MODE` | `true` | Ask the provider for strict JSON. Set to `false` if a provider rejects it. |
| `LLM_MAX_TOKENS` | `4096` | Maximum length of each AI response. |
| `LLM_TEMPERATURE` | `0.8` | How varied the writing is, from 0 (predictable) to 1 (creative). Leave empty to use the provider's default. |
| `ACCESS_CODE` | (empty) | Optional shared password visitors must enter to use AI features. |
| `RATE_LIMIT_PER_MINUTE` | `6` | AI requests allowed per visitor per minute. |
| `RATE_LIMIT_PER_DAY` | `150` | AI requests allowed per visitor per day. |
| `PORT` | `3000` | Port the server listens on. Most hosts set this automatically. |

## Choosing a provider

The server works with any provider offering an OpenAI-compatible `/chat/completions` endpoint. To switch, change three variables:

| Provider | `LLM_BASE_URL` | `LLM_MODEL` | Notes |
|---|---|---|---|
| Groq (default) | `https://api.groq.com/openai/v1` | `openai/gpt-oss-120b` | Very fast; free plan with rate limits |
| OpenRouter | `https://openrouter.ai/api/v1` | a model ID ending in `:free` | Many free models, tight daily limits |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | a current Gemini model name | Key from Google AI Studio |
| Claude (Anthropic API) | `https://api.anthropic.com/v1` | e.g. `claude-haiku-5-5` | Paid per use; key from the Claude Console |
| Ollama (local) | `http://localhost:11434/v1` | e.g. `llama3.1` | Free and offline; any text works as the key |

Model catalogs change often, so check each provider's model list for current names.

If a provider rejects JSON mode, the reasoning setting or the temperature, the server automatically retries without them. Smaller models sometimes write weaker scenarios or broken JSON; if that happens often, use a larger model.

## Protecting your quota

Free AI plans come with **rate limits**: caps on how many requests and tokens an account can use per minute and per day. A **token** is a chunk of text, roughly three-quarters of a word.

One briefing uses roughly 3,000 to 5,000 tokens, so a free plan supports a few dozen AI scenarios a day. Check your provider's console for your actual limits.

Because the limits apply to the whole account, one busy visitor can use up the day's quota for everyone. The server has three safeguards:

- **`ACCESS_CODE`** turns on a shared password for AI features. The built-in library stays open to everyone.
- **Per-visitor limits** (`RATE_LIMIT_PER_MINUTE` and `RATE_LIMIT_PER_DAY`) cap how much any one person can request.
- **A fixed model and token cap** mean visitors can't pick an expensive model or request huge responses.

If you share your deployment publicly, set an access code.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Written by AI" is greyed out | No `LLM_API_KEY` is set. Set it, then restart or redeploy. |
| "Switched to the built-in library" | The provider rejected the key. Check for typos or a revoked key. |
| "You’ve reached a usage limit" | The provider's or the server's rate limit was hit. Wait a minute. |
| "Couldn’t reach the AI server" | The server is waking from sleep or the provider timed out. Try again shortly. |

Provider errors are printed in the server logs. On Render, open the service's **Logs** tab.

## Project structure

```
public/index.html   The game: interface, simulation, 37 built-in scenarios
server.js           Serves the game and forwards AI requests
.env.example        Configuration template
package.json        Start script and Node version
```
