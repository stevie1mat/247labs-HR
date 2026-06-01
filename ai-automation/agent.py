"""
AI-Driven Job Posting Agent
Uses Playwright (headless browser) + LLM (Groq or Claude) to automatically
navigate job boards, fill out forms, and verify successful posting.
"""

import asyncio
import base64
import json
import os
import re
from typing import Optional

from playwright.async_api import async_playwright, Page, Browser


def get_llm_client():
    """Return the appropriate LLM client based on environment config."""
    provider = os.getenv("AI_PROVIDER", "groq").lower()

    if provider == "anthropic" or provider == "claude":
        from anthropic import Anthropic
        return "anthropic", Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    else:
        from groq import Groq
        return "groq", Groq(api_key=os.getenv("GROQ_API_KEY"))


async def ask_llm(provider: str, client, prompt: str, screenshot_b64: Optional[str] = None) -> str:
    """Send a prompt (and optionally a screenshot) to the LLM and get a response."""

    if provider == "anthropic":
        messages = [{"role": "user", "content": []}]
        if screenshot_b64:
            messages[0]["content"].append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": screenshot_b64,
                },
            })
        messages[0]["content"].append({"type": "text", "text": prompt})

        response = client.messages.create(
            model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
            max_tokens=4096,
            messages=messages,
        )
        return response.content[0].text

    else:  # groq
        messages = [{"role": "user", "content": []}]
        if screenshot_b64:
            messages[0]["content"].append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{screenshot_b64}"},
            })
        messages[0]["content"].append({"type": "text", "text": prompt})

        response = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.2-90b-vision-preview"),
            messages=messages,
            max_tokens=4096,
        )
        return response.choices[0].message.content


async def take_screenshot_b64(page: Page) -> str:
    """Take a screenshot of the current page and return as base64."""
    screenshot_bytes = await page.screenshot(full_page=False)
    return base64.b64encode(screenshot_bytes).decode("utf-8")


async def get_page_context(page: Page) -> str:
    """Extract a simplified view of the current page for the LLM."""
    # Get the page title, URL, and a simplified accessibility tree
    title = await page.title()
    url = page.url

    # Extract visible form elements for the LLM to reason about
    form_elements = await page.evaluate("""
        () => {
            const elements = [];
            const inputs = document.querySelectorAll('input, textarea, select, button, a');
            inputs.forEach((el, i) => {
                if (i > 60) return;  // limit to 60 elements
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return;  // skip hidden
                
                const info = {
                    tag: el.tagName.toLowerCase(),
                    type: el.type || '',
                    name: el.name || '',
                    id: el.id || '',
                    placeholder: el.placeholder || '',
                    value: el.value || '',
                    text: el.innerText?.substring(0, 80) || '',
                    ariaLabel: el.getAttribute('aria-label') || '',
                    href: el.href || '',
                    index: i
                };
                elements.push(info);
            });
            return elements;
        }
    """)

    return json.dumps({
        "title": title,
        "url": url,
        "form_elements": form_elements,
    }, indent=2)


def parse_agent_action(response: str) -> dict:
    """Parse the LLM's response into an executable action."""
    # Try to extract JSON from the response
    json_match = re.search(r'\{[\s\S]*?\}', response)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    return {"action": "done", "reason": "Could not parse LLM response"}


SYSTEM_PROMPT = """You are an AI agent that automates job posting on websites.
You control a headless browser through actions. You will receive the current page context
(URL, title, visible form elements) and optionally a screenshot.

Your goal is to navigate the website, find the job posting form, fill it out with the
provided job details, and submit it.

ALWAYS respond with a single JSON object describing your next action. Valid actions:

1. {"action": "navigate", "url": "https://..."}
2. {"action": "click", "selector": "#element-id"} or {"action": "click", "text": "Button Text"}
3. {"action": "fill", "selector": "#element-id", "value": "text to type"}
4. {"action": "select", "selector": "#element-id", "value": "option value"}
5. {"action": "scroll", "direction": "down"}
6. {"action": "wait", "seconds": 2}
7. {"action": "done", "success": true, "posted_url": "https://...", "reason": "Job posted successfully"}
8. {"action": "done", "success": false, "reason": "Explanation of failure"}

Rules:
- Only return ONE JSON object per response, nothing else.
- If you see a login page, use the provided credentials.
- After clicking submit, wait and check if the posting was successful.
- If you encounter a CAPTCHA, report failure.
- Be methodical: navigate → find form → fill fields one by one → submit → verify.
"""


async def run_agent(
    platform: str,
    job_data: dict,
    credentials: dict,
    max_steps: int = 25,
) -> dict:
    """
    Run the AI agent to post a job on a given platform.

    Args:
        platform: The platform name (e.g., 'linkedin', 'remotive', 'wellfound')
        job_data: Dict with keys like title, description, requirements, salaryRange
        credentials: Dict with login credentials for the platform
        max_steps: Maximum number of actions the agent can take

    Returns:
        Dict with keys: success, posted_url, screenshot_b64, logs
    """
    provider, llm_client = get_llm_client()
    logs = []

    # Platform-specific starting URLs
    start_urls = {
        "linkedin": "https://www.linkedin.com/talent/post-a-job",
        "remotive": "https://remotive.com/post-a-remote-job",
        "wellfound": "https://wellfound.com/recruit/jobs/new",
        "dubizzle_jobs_uae": "https://www.dubizzle.com/post-ad/",
        "upwork": "https://www.upwork.com/nx/create-job/",
    }

    start_url = start_urls.get(platform, f"https://{platform}.com")

    async with async_playwright() as pw:
        browser: Browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()

        try:
            # Navigate to start URL
            await page.goto(start_url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(2)

            job_details_prompt = f"""
JOB DETAILS TO POST:
- Title: {job_data.get('title', '')}
- Description: {job_data.get('description', '')}
- Requirements: {job_data.get('requirements', '')}
- Salary: {job_data.get('salaryRange', 'Competitive')}
- Location: Remote

LOGIN CREDENTIALS (if needed):
- Email/Username: {credentials.get('username', credentials.get('email', ''))}
- Password: {credentials.get('password', '')}

You are on: {platform}
"""

            for step in range(max_steps):
                # Get current page context
                page_context = await get_page_context(page)
                screenshot_b64 = await take_screenshot_b64(page)

                prompt = f"""{SYSTEM_PROMPT}

{job_details_prompt}

CURRENT PAGE STATE (Step {step + 1}/{max_steps}):
{page_context}

What is your next action? Respond with ONLY a JSON object."""

                # Ask the LLM
                llm_response = await ask_llm(provider, llm_client, prompt, screenshot_b64)
                action = parse_agent_action(llm_response)
                logs.append({"step": step + 1, "action": action, "url": page.url})

                # Execute the action
                if action["action"] == "navigate":
                    await page.goto(action["url"], wait_until="domcontentloaded", timeout=30000)
                    await asyncio.sleep(2)

                elif action["action"] == "click":
                    if "selector" in action:
                        await page.click(action["selector"], timeout=5000)
                    elif "text" in action:
                        await page.get_by_text(action["text"], exact=False).first.click(timeout=5000)
                    await asyncio.sleep(1.5)

                elif action["action"] == "fill":
                    await page.fill(action["selector"], action["value"])
                    await asyncio.sleep(0.5)

                elif action["action"] == "select":
                    await page.select_option(action["selector"], action["value"])
                    await asyncio.sleep(0.5)

                elif action["action"] == "scroll":
                    direction = action.get("direction", "down")
                    delta = 500 if direction == "down" else -500
                    await page.mouse.wheel(0, delta)
                    await asyncio.sleep(1)

                elif action["action"] == "wait":
                    await asyncio.sleep(action.get("seconds", 2))

                elif action["action"] == "done":
                    final_screenshot = await take_screenshot_b64(page)

                    # Ask the LLM to verify the result
                    verify_prompt = f"""Look at this screenshot. Was the job "{job_data.get('title', '')}" successfully posted?
Respond with ONLY a JSON object:
{{"verified": true/false, "posted_url": "url if visible", "reason": "explanation"}}"""

                    verify_response = await ask_llm(provider, llm_client, verify_prompt, final_screenshot)
                    verification = parse_agent_action(verify_response)

                    return {
                        "success": action.get("success", False) and verification.get("verified", False),
                        "posted_url": action.get("posted_url") or verification.get("posted_url"),
                        "screenshot_b64": final_screenshot,
                        "logs": logs,
                        "verification": verification,
                    }

            # Max steps exceeded
            final_screenshot = await take_screenshot_b64(page)
            return {
                "success": False,
                "posted_url": None,
                "screenshot_b64": final_screenshot,
                "logs": logs,
                "verification": {"reason": f"Exceeded maximum {max_steps} steps"},
            }

        except Exception as e:
            screenshot_b64 = None
            try:
                screenshot_b64 = await take_screenshot_b64(page)
            except:
                pass
            return {
                "success": False,
                "posted_url": None,
                "screenshot_b64": screenshot_b64,
                "logs": logs,
                "error": str(e),
            }

        finally:
            await browser.close()
