import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Check if we are in dev mode (Vite)
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handler for POST_JOB
ipcMain.handle('POST_JOB', async (event, payload) => {
  const { platforms, jobData } = payload;
  console.log('Received POST_JOB request for platforms:', platforms);

  try {
    // Launch a persistent Playwright context to keep cookies/session
    const userDataDir = path.join(app.getPath('userData'), 'playwright_data');
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Make it visible so the user can see the AI typing
      args: ['--start-maximized']
    });

    const page = await browserContext.newPage();

    for (const platform of platforms) {
      let url = "";
      if (platform === "wellfound") url = "https://wellfound.com/recruit/jobs/new";
      else if (platform === "remotive") url = "https://remotive.com/post-a-remote-job";
      else if (platform === "linkedin") url = "https://www.linkedin.com/talent/post-a-job";
      else if (platform === "indeed") url = "https://employers.indeed.com/p";

      if (!url) continue;

      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'networkidle' });

      // Wait 3 seconds for SPA hydration
      await page.waitForTimeout(3000);

      // Scrape the form map using Playwright's evaluate
      const formMap = await page.evaluate(() => {
        const fields = [];
        const inputs = document.querySelectorAll("input, textarea, select, [contenteditable='true']");
        const allLabels = Array.from(document.querySelectorAll("label"));

        inputs.forEach((input, index) => {
          if (input.type === 'hidden' || input.style.display === 'none' || input.style.visibility === 'hidden') return;
          
          let labelText = "";
          if (input.id) {
            const matchingLabel = allLabels.find(l => l.getAttribute("for") === input.id);
            if (matchingLabel) labelText = matchingLabel.innerText;
          }
          if (!labelText && input.closest('label')) {
            labelText = input.closest('label').innerText;
          }
          if (!labelText) {
            labelText = input.getAttribute('aria-label') || "";
          }
          
          fields.push({
            index: index,
            tag: input.tagName.toLowerCase(),
            type: input.type || "",
            id: input.id || "",
            name: input.name || "",
            placeholder: input.placeholder || "",
            label: labelText.trim(),
            isContentEditable: input.getAttribute('contenteditable') === 'true'
          });
        });
        return fields;
      });

      console.log(`Extracted Form Map with ${formMap.length} fields. Asking Mistral AI...`);

      // Ask Mistral API
      const prompt = `
You are an expert AI form filler. Your task is to map a job posting's data to the correct HTML form fields.
Here is the job posting data:
${JSON.stringify(jobData, null, 2)}

Here are the available form fields on the page:
${JSON.stringify(formMap, null, 2)}

Instructions:
1. Match the job data to the appropriate fields based on their label, placeholder, name, id, and type.
2. Return a JSON object with a single key "instructions", containing an array of objects.
3. Each object in the array MUST have:
  - "index": The exact index of the field from the provided array.
  - "tag": The tag from the provided array.
  - "value": The text value to type. IMPORTANT: If the field is a description or rich text editor, you MUST use HTML tags (like <p>, <ul>, <li>, <strong>) and absolutely NO markdown asterisks (**) or hashes.

4. If a field asks for something not in the job data, skip it.
`;

      const response = await fetch(`https://api.mistral.ai/v1/chat/completions`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.MISTRAL_API_KEY || ""}`
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const parsedData = JSON.parse(data.choices[0].message.content);
      const instructions = parsedData.instructions || [];

      console.log(`Mistral generated ${instructions.length} instructions. Executing keystrokes...`);

      for (const inst of instructions) {
        try {
          const elementHandle = await page.evaluateHandle((index) => {
            return document.querySelectorAll("input, textarea, select, [contenteditable='true']")[index];
          }, inst.index);

          if (!elementHandle) continue;

          await elementHandle.scrollIntoViewIfNeeded();
          const isContentEditable = await elementHandle.evaluate(el => el.getAttribute('contenteditable') === 'true' || el.tagName.toLowerCase() === 'div');
          
          if (isContentEditable) {
             // For React Rich Text Editors, we must use insertHTML so the formatting applies correctly
             await elementHandle.click();
             await page.keyboard.press('Meta+a');
             await page.keyboard.press('Backspace');
             
             await elementHandle.evaluate((el, htmlValue) => {
                 el.focus();
                 document.execCommand('insertHTML', false, htmlValue);
                 el.dispatchEvent(new Event('input', { bubbles: true }));
                 el.dispatchEvent(new Event('change', { bubbles: true }));
             }, inst.value);
          } else {
             // For standard inputs, use Playwright's native fill
             await elementHandle.fill(inst.value);
          }
          
          // Slight delay to simulate human typing
          await page.waitForTimeout(300);
        } catch (e) {
          console.error(`Failed to fill field index ${inst.index}`, e);
        }
      }

      console.log("Job posting automation complete!");
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error during automation:", error);
    return { success: false, error: error.message };
  }
});
