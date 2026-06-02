(function () {
  if (window.__247LabsContentAgentLoaded) {
    return;
  }

  window.__247LabsContentAgentLoaded = true;

  const PREVIEW_ROOT_ID = "__247labs_extension_preview__";
  const CONTROL_BAR_ID = "__247labs_extension_control_bar__";
  const STYLE_ID = "__247labs_extension_preview_styles__";
  let isAutomationStopped = false;

  const PLATFORM_PROFILES = {
    linkedin: {
      label: "LinkedIn",
      fieldRules: {
        jobTitle: {
          label: "Job title",
          required: true,
          selectors: [
            'input[aria-label*="job title" i]',
            'input[id*="job-title" i]',
            'input[name*="jobTitle" i]',
            'input[aria-label*="job title" i]',
            'input[name*="jobTitle" i]',
            'input[id*="jobTitle" i]',
          ],
          keywords: ["job title", "title", "role title", "position title"],
        },
        location: {
          label: "Location",
          selectors: [
            'input[aria-label*="location" i]',
            'input[name*="location" i]',
            'input[placeholder*="location" i]',
          ],
          keywords: ["location", "city", "where is this job located"],
        },
        workplaceType: {
          label: "Workplace type",
          selectors: [
            'select[name*="workplace" i]',
            'input[aria-label*="workplace type" i]',
            '[role="radiogroup"] input[type="radio"]',
          ],
          keywords: ["workplace type", "remote", "hybrid", "on-site", "onsite"],
        },
        salary: {
          label: "Salary",
          selectors: [
            'input[aria-label*="salary" i]',
            'input[name*="salary" i]',
            'input[placeholder*="salary" i]',
          ],
          keywords: ["salary", "compensation", "pay range"],
        },
        description: {
          label: "Description",
          required: true,
          selectors: [
            '[contenteditable="true"][role="textbox"]',
            'textarea[aria-label*="description" i]',
            'textarea[name*="description" i]',
          ],
          keywords: ["description", "job description", "about the job", "responsibilities"],
        },
        requirements: {
          label: "Requirements",
          selectors: [
            'textarea[aria-label*="requirement" i]',
            'textarea[name*="requirement" i]',
          ],
          keywords: ["requirements", "qualifications", "skills", "must have"],
        },
      },
    },
    indeed: {
      label: "Indeed",
      fieldRules: {
        jobTitle: {
          label: "Job title",
          required: true,
          selectors: ['input[name*="jobTitle" i]', 'input[aria-label*="job title" i]'],
          keywords: ["job title", "title", "role title"],
        },
        location: {
          label: "Location",
          selectors: ['input[name*="location" i]', 'input[aria-label*="location" i]'],
          keywords: ["location", "city", "remote location"],
        },
        workplaceType: {
          label: "Workplace type",
          selectors: ['select[name*="remote" i]', 'select[name*="workplace" i]'],
          keywords: ["remote", "workplace type", "job location type", "hybrid"],
        },
        salary: {
          label: "Salary",
          selectors: [
            'input[name*="salary" i]',
            'input[aria-label*="salary" i]',
            'input[placeholder*="salary" i]',
          ],
          keywords: ["salary", "pay", "compensation"],
        },
        description: {
          label: "Description",
          required: true,
          selectors: [
            'textarea[name*="description" i]',
            'textarea[aria-label*="description" i]',
            '[contenteditable="true"]',
          ],
          keywords: ["description", "job description", "responsibilities"],
        },
        requirements: {
          label: "Requirements",
          selectors: ['textarea[name*="requirement" i]', 'textarea[aria-label*="qualification" i]'],
          keywords: ["requirements", "qualifications", "skills"],
        },
      },
    },
    wellfound: {
      label: "Wellfound",
      fieldRules: {
        jobTitle: {
          label: "Job title",
          required: true,
          selectors: ['#form-input--title', 'input[name="title"]', 'input[name*="title" i]', 'input[placeholder*="software engineer" i]', 'input[placeholder*="job title" i]'],
          keywords: ["job title", "title", "role"],
        },
        primaryRole: {
          label: "Primary role",
          selectors: ['#form-input--primaryRoleId', '#react-select-form-input--primaryRoleId-input', 'input[id*="primaryRoleId" i]'],
          keywords: ["primary role", "select role"],
        },
        location: {
          label: "Location",
          selectors: ['#downshift-1-input', 'input[name="locations"]', 'input[placeholder*="san francisco" i]', 'input[name*="location" i]', 'input[placeholder*="location" i]'],
          keywords: ["location", "where are you hiring for this role", "city", "remote"],
        },
        workplaceType: {
          label: "Workplace type",
          selectors: ['input[name*="remote" i]', 'input[name*="policy" i]', 'fieldset[name*="remote" i] input', 'fieldset[name*="policy" i] input'],
          keywords: ["remote policy", "remote", "hybrid", "on-site", "onsite", "workplace type"],
        },
        salary: {
          label: "Salary",
          selectors: ['#form-input--salaryMin', '#form-input--salaryMax', 'input[name="salaryMin"]', 'input[name="salaryMax"]', 'input[name*="salary" i]', 'input[placeholder*="60,000" i]', 'input[placeholder*="salary" i]'],
          keywords: ["annual salary range", "salary", "compensation", "range"],
        },
        description: {
          label: "Description",
          required: true,
          selectors: ['#react-simplemde-editor-wrapper .CodeMirror textarea', '#react-simplemde-editor-wrapper .CodeMirror', 'textarea[name*="description" i]', '[contenteditable="true"]'],
          keywords: ["description", "describe the responsibilities of the position", "about the role", "job description"],
        },
        requirements: {
          label: "Requirements",
          selectors: ['#downshift-0-input', 'textarea[name*="requirement" i]', 'textarea[name*="qualification" i]'],
          keywords: ["requirements", "qualifications", "skills"],
        },
      },
    },
    ziprecruiter: {
      label: "ZipRecruiter",
      fieldRules: {
        jobTitle: {
          label: "Job title",
          required: true,
          selectors: ['input[name*="title" i]', 'input[aria-label*="job title" i]'],
          keywords: ["job title", "title", "position"],
        },
        location: {
          label: "Location",
          selectors: ['input[name*="location" i]', 'input[placeholder*="location" i]'],
          keywords: ["location", "city", "zip code", "remote location"],
        },
        workplaceType: {
          label: "Workplace type",
          selectors: ['select[name*="remote" i]', 'select[name*="workplace" i]'],
          keywords: ["remote", "hybrid", "on-site", "onsite", "workplace type"],
        },
        salary: {
          label: "Salary",
          selectors: ['input[name*="salary" i]', 'input[aria-label*="salary" i]'],
          keywords: ["salary", "compensation", "pay"],
        },
        description: {
          label: "Description",
          required: true,
          selectors: ['textarea[name*="description" i]', '[contenteditable="true"]'],
          keywords: ["description", "job description", "responsibilities"],
        },
        requirements: {
          label: "Requirements",
          selectors: ['textarea[name*="requirement" i]', 'textarea[aria-label*="qualification" i]'],
          keywords: ["requirements", "qualifications", "skills"],
        },
      },
    },
    remotive: {
      label: "Remotive",
      fieldRules: {
        jobTitle: {
          label: "Job title",
          required: true,
          selectors: ['input[name*="title" i]', 'input[placeholder*="job title" i]'],
          keywords: ["job title", "title", "role"],
        },
        location: {
          label: "Location",
          selectors: ['input[name*="location" i]', 'input[placeholder*="location" i]'],
          keywords: ["location", "country", "region"],
        },
        workplaceType: {
          label: "Workplace type",
          selectors: ['select[name*="remote" i]', 'input[type="checkbox"][name*="remote" i]'],
          keywords: ["remote", "remote only", "workplace type"],
        },
        salary: {
          label: "Salary",
          selectors: ['input[name*="salary" i]', 'input[placeholder*="salary" i]'],
          keywords: ["salary", "compensation", "pay range"],
        },
        description: {
          label: "Description",
          required: true,
          selectors: ['textarea[name*="description" i]', '[contenteditable="true"]'],
          keywords: ["description", "job description", "responsibilities"],
        },
        requirements: {
          label: "Requirements",
          selectors: ['textarea[name*="requirement" i]', 'textarea[aria-label*="requirement" i]'],
          keywords: ["requirements", "qualifications", "skills"],
        },
      },
    },
    generic: {
      label: "Generic",
      fieldRules: {
        jobTitle: { label: "Job title", required: true, keywords: ["job title", "title", "position", "role"] },
        location: { label: "Location", keywords: ["location", "city", "country", "region"] },
        workplaceType: { label: "Workplace type", keywords: ["workplace type", "remote", "hybrid", "on-site", "onsite"] },
        salary: { label: "Salary", keywords: ["salary", "compensation", "pay", "range"] },
        description: { label: "Description", required: true, keywords: ["description", "job description", "about the role", "responsibilities"] },
        requirements: { label: "Requirements", keywords: ["requirements", "qualifications", "skills", "must have"] },
      },
    },
  };

  function normalizeText(value) {
    return (value || "")
      .toString()
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function associatedLabelText(element) {
    const labels = [];

    if (element.id) {
      document.querySelectorAll(`label[for="${CSS.escape(element.id)}"]`).forEach((label) => {
        labels.push(label.innerText || label.textContent || "");
      });
    }

    if (element.labels) {
      Array.from(element.labels).forEach((label) => labels.push(label.innerText || label.textContent || ""));
    }

    const wrappingLabel = element.closest("label");
    if (wrappingLabel) {
      labels.push(wrappingLabel.innerText || wrappingLabel.textContent || "");
    }

    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      labelledBy.split(/\s+/).forEach((id) => {
        const node = document.getElementById(id);
        if (node) labels.push(node.innerText || node.textContent || "");
      });
    }

    return labels.map((value) => value.trim()).filter(Boolean).join(" ");
  }

  function nearbyLegendText(element) {
    const fieldset = element.closest("fieldset");
    if (!fieldset) return "";
    const legend = fieldset.querySelector("legend");
    return legend ? (legend.innerText || legend.textContent || "").trim() : "";
  }

  function getElementDescriptor(element, index) {
    const tag = element.tagName.toLowerCase();
    const type = (element.getAttribute("type") || "").toLowerCase();
    const placeholder = element.getAttribute("placeholder") || "";
    const ariaLabel = element.getAttribute("aria-label") || "";
    const name = element.getAttribute("name") || "";
    const id = element.getAttribute("id") || "";
    const label = associatedLabelText(element);
    const legend = nearbyLegendText(element);
    const descriptorText = [label, legend, ariaLabel, placeholder, name, id].join(" ");

    return {
      element,
      index,
      tag,
      type,
      name,
      id,
      placeholder,
      label,
      legend,
      descriptorText,
      normalizedText: normalizeText(descriptorText),
      isContentEditable: element.getAttribute("contenteditable") === "true",
      options:
        tag === "select"
          ? Array.from(element.options || []).map((option) => ({
              value: option.value,
              label: option.textContent || option.innerText || option.value,
            }))
          : [],
    };
  }

  function detectFields() {
    const nodes = Array.from(
      document.querySelectorAll(
        'input:not([type="hidden"]), textarea, select, [contenteditable="true"], [role="textbox"][contenteditable="true"], .CodeMirror, .EasyMDEContainer .CodeMirror'
      )
    );

    return nodes
      .filter((node) => isVisible(node))
      .map((node, index) => getElementDescriptor(node, index));
  }

  function detectHumanVerification() {
    const selectors = [
      'iframe[src*="recaptcha"]',
      'iframe[title*="captcha" i]',
      '.g-recaptcha',
      '[data-sitekey]',
      'input[autocomplete="one-time-code"]',
      'input[name*="otp" i]',
      'input[name*="2fa" i]',
      'input[name*="verification" i]',
      'input[id*="verification" i]',
      'input[aria-label*="verification code" i]',
    ];

    if (selectors.some((selector) => findVisibleElements(selector).length > 0)) {
      return "CAPTCHA or verification input detected.";
    }

    const bodyText = normalizeText(document.body.innerText);
    const phrases = [
      "verification code",
      "two-factor authentication",
      "two factor authentication",
      "complete the captcha",
      "prove you are human",
      "security check",
    ];

    return phrases.find((phrase) => bodyText.includes(phrase))
      ? "This page is asking for CAPTCHA or 2FA verification."
      : null;
  }

  function inferWorkplaceType(jobData, platform) {
    const explicit = jobData.workplaceType || jobData.workplace_type || jobData.workplace || jobData.remotePolicy;
    if (explicit) return explicit;

    const location = normalizeText(jobData.location || "");
    const description = normalizeText(jobData.description || "");

    if (location.includes("remote") || description.includes("remote")) return "Remote";
    if (description.includes("hybrid")) return "Hybrid";
    if (platform === "remotive") return "Remote";

    return "";
  }

  function inferWellfoundPrimaryRole(jobData) {
    const haystack = normalizeText([
      jobData.title,
      jobData.jobTitle,
      jobData.category,
      jobData.description,
      jobData.requirements,
    ].filter(Boolean).join(" "));

    const roleMappings = [
      { patterns: ["devops", "site reliability", "sre"], role: "DevOps" },
      { patterns: ["full stack", "full-stack"], role: "Full-Stack Engineer" },
      { patterns: ["frontend", "front end", "react", "vue", "angular", "ui engineer"], role: "Frontend Engineer" },
      { patterns: ["backend", "back end", "node", "api engineer"], role: "Backend Engineer" },
      { patterns: ["mobile developer", "react native", "android developer", "ios developer", "ios engineer", "android engineer"], role: "Mobile Developer" },
      { patterns: ["software engineer", "software developer", "web developer"], role: "Software Engineer" },
      { patterns: ["data engineer"], role: "Data Engineer" },
      { patterns: ["machine learning", "ml engineer", "ai engineer"], role: "Machine Learning Engineer" },
      { patterns: ["security engineer", "application security", "cloud security"], role: "Security Engineer" },
      { patterns: ["qa engineer", "quality assurance", "test engineer", "sdet"], role: "QA Engineer" },
      { patterns: ["engineering manager"], role: "Engineering Manager" },
      { patterns: ["ui/ux", "ux designer", "product designer", "graphic designer", "visual designer", "designer"], role: "UI/UX Designer" },
      { patterns: ["product manager"], role: "Product Manager" },
      { patterns: ["recruiter", "talent acquisition", "hr manager", "human resources"], role: "Recruiter" },
      { patterns: ["marketing manager", "growth hacker", "copywriter", "social media"], role: "Marketing Manager" },
      { patterns: ["operations manager", "office manager", "customer service"], role: "Operations Manager" },
      { patterns: ["business analyst"], role: "Business Analyst" },
      { patterns: ["project manager"], role: "Project Manager" },
      { patterns: ["data analyst"], role: "Data Analyst" },
      { patterns: ["cto"], role: "CTO" },
      { patterns: ["ceo"], role: "CEO" },
      { patterns: ["cfo"], role: "CFO" },
      { patterns: ["coo"], role: "COO" },
      { patterns: ["cmo"], role: "CMO" },
      { patterns: ["hardware engineer"], role: "Hardware Engineer" },
      { patterns: ["mechanical engineer"], role: "Mechanical Engineer" },
      { patterns: ["systems engineer"], role: "Systems Engineer" },
    ];

    const match = roleMappings.find((entry) => entry.patterns.some((pattern) => haystack.includes(pattern)));
    return match?.role || "";
  }

  function normalizeJobData(jobData, platform) {
    const description = jobData.description || "";
    const requirements = jobData.requirements || "";
    const combinedDescription = [description, requirements ? `Requirements:\n${requirements}` : ""]
      .filter(Boolean)
      .join("\n\n");

    return {
      jobTitle: jobData.title || jobData.jobTitle || "",
      primaryRole: platform === "wellfound" ? inferWellfoundPrimaryRole(jobData) : "",
      location: jobData.location || "",
      workplaceType: inferWorkplaceType(jobData, platform),
      salary: jobData.salaryRange || jobData.salary || "",
      description: combinedDescription || description,
      requirements,
    };
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function findVisibleElements(selector, root = document) {
    return Array.from(root.querySelectorAll(selector)).filter((element) => isVisible(element));
  }

  function elementText(element) {
    return normalizeText(element?.innerText || element?.textContent || "");
  }

  function includesAny(text, patterns) {
    return patterns.some((pattern) => text.includes(normalizeText(pattern)));
  }

  function findTextNode(patterns, selectors = "label, legend, span, p, h1, h2, h3, h4, h5, div, button") {
    return findVisibleElements(selectors).find((element) => includesAny(elementText(element), patterns)) || null;
  }

  function findControlNearText(patterns, controlSelector = 'input, textarea, select, [role="combobox"], button[aria-haspopup="listbox"], [contenteditable="true"], [role="textbox"]') {
    const candidates = findVisibleElements("label, legend, span, p, h1, h2, h3, h4, h5, div");

    for (const candidate of candidates) {
      if (!includesAny(elementText(candidate), patterns)) continue;

      const ancestors = [];
      let current = candidate;
      for (let depth = 0; current && depth < 5; depth += 1) {
        ancestors.push(current);
        current = current.parentElement;
      }

      for (const container of ancestors) {
        const controls = findVisibleElements(controlSelector, container);
        const firstControl = controls.find((control) => control !== candidate);
        if (firstControl) return firstControl;
      }
    }

    return null;
  }

  function findButtonByText(patterns) {
    return findVisibleElements('button, a[role="button"], [role="button"], input[type="button"], input[type="submit"]').find((element) =>
      includesAny(
        normalizeText(
          element.innerText ||
            element.textContent ||
            element.value ||
            element.getAttribute("aria-label") ||
            element.getAttribute("title") ||
            ""
        ),
        patterns
      )
    ) || null;
  }

  function isEnabledControl(element) {
    if (!element) return false;
    const className = String(element.className || "");
    return (
      !element.disabled &&
      element.getAttribute("aria-disabled") !== "true" &&
      !className.includes("disabled") &&
      !className.includes("artdeco-button--disabled")
    );
  }

  function clickElement(element) {
    if (!element) return false;
    const clickable = element.closest?.('button, a[role="button"], [role="button"], input[type="button"], input[type="submit"]') || element;
    clickable.scrollIntoView({ block: "center", behavior: "smooth" });
    clickable.focus?.();
    clickable.click();
    clickable.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return true;
  }

  function clickElementLikeUser(element) {
    if (!element) return false;
    const clickable = element.closest?.('button, a[role="button"], [role="button"], input[type="button"], input[type="submit"]') || element;
    const rect = clickable.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    clickable.scrollIntoView({ block: "center", behavior: "smooth" });
    clickable.focus?.();
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
      const EventCtor = type.startsWith("pointer") && typeof PointerEvent !== "undefined" ? PointerEvent : MouseEvent;
      clickable.dispatchEvent(
        new EventCtor(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX,
          clientY,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
        })
      );
    });
    
    // Fallback to native click if the events didn't trigger React's synthetic event system properly
    try {
      clickable.click();
    } catch (e) {
      // Ignore
    }
    
    return true;
  }

  async function waitForCondition(check, timeoutMs = 12000, intervalMs = 250) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (isAutomationStopped) throw new Error("AUTOMATION_STOPPED");
      const result = check();
      if (result) return result;
      await sleep(intervalMs);
    }

    return null;
  }

  function parseSalaryRange(rawSalary) {
    const matches = (rawSalary || "").match(/[\d,.]+/g) || [];
    const values = matches
      .map((value) => Number(value.replace(/,/g, "")))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (!values.length) return { minimum: "", maximum: "" };

    if (values.length === 1) {
      return { minimum: String(Math.round(values[0])), maximum: String(Math.round(values[0])) };
    }

    return {
      minimum: String(Math.round(Math.min(...values))),
      maximum: String(Math.round(Math.max(...values))),
    };
  }

  function inferEmploymentTypes(jobData) {
    const haystack = normalizeText([jobData.title, jobData.description, jobData.requirements, jobData.category].filter(Boolean).join(" "));
    const types = [];

    if (haystack.includes("contract")) types.push("Contract");
    if (haystack.includes("part-time") || haystack.includes("part time")) types.push("Part-time");
    if (haystack.includes("temporary")) types.push("Temporary");
    if (haystack.includes("intern")) types.push("Internship / Co-op");
    if (haystack.includes("seasonal")) types.push("Seasonal");
    if (!types.length) types.push("Full-time");

    if (!types.includes("Full-time") && !haystack.includes("part-time") && !haystack.includes("temporary") && !haystack.includes("intern")) {
      types.unshift("Full-time");
    }

    return Array.from(new Set(types));
  }

  function findIndeedContinueButton() {
    return findButtonByText(["continue", "review", "next"]);
  }

  function findIndeedConfirmButton() {
    return findButtonByText(["confirm"]);
  }

  function setComboboxValue(combobox, optionText) {
    if (!combobox) return false;

    if (combobox.tagName?.toLowerCase() === "select") {
      const optionValue = pickSelectOption(combobox, optionText);
      if (!optionValue) return false;
      combobox.value = optionValue;
      combobox.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    clickElement(combobox);
    return true;
  }

  async function chooseListOption(optionText, timeoutMs = 6000) {
    const option = await waitForCondition(() =>
      findVisibleElements('[role="option"], [data-testid], li, button, div, span').find((element) =>
        includesAny(elementText(element), [optionText]) && !element.closest(`#${PREVIEW_ROOT_ID}`)
      )
    , timeoutMs);

    if (!option) return false;
    clickElement(option);
    return true;
  }

  function findIndeedLocationTypeDropdown() {
    const label = findTextNode(["job location type"], "label, legend, span, p, div");
    if (!label) return null;

    let current = label;
    for (let depth = 0; current && depth < 6; depth += 1) {
      const candidates = findVisibleElements('button, [role="combobox"], select, input, div[tabindex]', current)
        .filter((element) => element !== label);

      const dropdown = candidates.find((element) => {
        const text = elementText(element);
        const aria = normalizeText([
          element.getAttribute("aria-label"),
          element.getAttribute("aria-expanded"),
          element.getAttribute("role"),
        ].filter(Boolean).join(" "));

        return (
          element.tagName?.toLowerCase() === "select" ||
          aria.includes("combobox") ||
          aria.includes("false") ||
          aria.includes("true") ||
          includesAny(text, ["in person", "fully remote", "hybrid", "remote"])
        );
      });

      if (dropdown) return dropdown;
      current = current.parentElement;
    }

    return findControlNearText(["job location type"], 'select, [role="combobox"], button, input, div[tabindex]');
  }

  async function setIndeedLocationTypeRemote() {
    const remoteLabel = "Fully remote: No on-site work required";

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const dropdown = findIndeedLocationTypeDropdown();
      if (!dropdown) {
        await sleep(300);
        continue;
      }

      if (dropdown.tagName?.toLowerCase() === "select") {
        const optionValue = pickSelectOption(dropdown, remoteLabel);
        if (optionValue) {
          dropdown.value = optionValue;
          dropdown.dispatchEvent(new Event("input", { bubbles: true }));
          dropdown.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
      }

      clickElement(dropdown);
      await sleep(350);

      const selected = await chooseListOption(remoteLabel, 4000);
      await sleep(500);

      if (selected && findTextNode([remoteLabel], "button, [role='combobox'], div, span, select")) {
        return true;
      }
    }

    return false;
  }

  function findRadioOption(questionPatterns, optionPatterns) {
    const questionNode = findTextNode(questionPatterns);
    if (!questionNode) return null;

    const ancestors = [];
    let current = questionNode;
    for (let depth = 0; current && depth < 5; depth += 1) {
      ancestors.push(current);
      current = current.parentElement;
    }

    for (const container of ancestors) {
      const labels = findVisibleElements('label, button, span, div', container);
      const match = labels.find((element) => includesAny(elementText(element), optionPatterns));
      if (match) return match.closest("label") || match;
    }

    return null;
  }

  function findChipByText(text) {
    return findVisibleElements('button, label, div[role="button"], span').find((element) =>
      includesAny(elementText(element), [text])
    ) || null;
  }

  function chipIsSelected(element) {
    if (!element) return false;
    const text = `${element.getAttribute("aria-pressed") || ""} ${element.getAttribute("aria-selected") || ""} ${element.className || ""}`;
    return /true|selected|active|checked/i.test(text);
  }

  async function indeedStepJobBasics(jobData) {
    await waitForCondition(() => findTextNode(["add job basics"]), 12000);

    const titleInput = findControlNearText(["job title"]);
    if (titleInput) setNativeInputValue(titleInput, jobData.jobTitle);

    const remoteSelected = await setIndeedLocationTypeRemote();
    if (!remoteSelected) {
      chrome.runtime.sendMessage({
        type: "EXTENSION_LOG",
        message: "Indeed: could not set job location type to fully remote.",
        status: "Indeed paused at location type.",
      });
      window.alert("Indeed automation could not set Job location type to Fully remote. Please select it manually, then rerun or continue.");
      return;
    }

    await sleep(250);
    const noRadio = findRadioOption(["required to reside in a specific location"], ["no"]);
    if (noRadio) clickElement(noRadio);

    await sleep(250);
    clickElement(findIndeedContinueButton());
  }

  async function indeedStepHiringGoals() {
    await waitForCondition(() => findTextNode(["hiring goals"]), 12000);

    const timelineControl = findControlNearText(["hiring timeline for this job"], 'select, [role="combobox"], button[aria-haspopup="listbox"], input');
    if (timelineControl) {
      setComboboxValue(timelineControl, "2 to 4 weeks");
      if (timelineControl.tagName?.toLowerCase() !== "select") {
        await sleep(300);
        await chooseListOption("2 to 4 weeks");
      }
    }

    const countInput = findControlNearText(["number of people to hire in the next 30 days"], "input");
    if (countInput) setNativeInputValue(countInput, "1");

    await sleep(250);
    clickElement(findIndeedContinueButton());
  }

  async function indeedStepJobDetails(jobData) {
    await waitForCondition(() => findTextNode(["add job details"]), 12000);

    const employmentTypes = inferEmploymentTypes(jobData);
    employmentTypes.forEach((typeLabel) => {
      const chip = findChipByText(typeLabel);
      if (chip && !chipIsSelected(chip)) clickElement(chip);
    });

    await sleep(250);
    clickElement(findIndeedContinueButton());
  }

  async function indeedStepPay(jobData) {
    await waitForCondition(() => findTextNode(["add pay and benefits"]), 12000);

    const salary = parseSalaryRange(jobData.salary);
    const payModeControl = findControlNearText(["show pay by"], 'select, [role="combobox"], button[aria-haspopup="listbox"], input');
    if (payModeControl) {
      setComboboxValue(payModeControl, "Range");
      if (payModeControl.tagName?.toLowerCase() !== "select") {
        await sleep(200);
        await chooseListOption("Range");
      }
    }

    const minimumInput = findControlNearText(["minimum"], "input");
    if (minimumInput && salary.minimum) setNativeInputValue(minimumInput, salary.minimum);

    const maximumInput = findControlNearText(["maximum"], "input");
    if (maximumInput && salary.maximum) setNativeInputValue(maximumInput, salary.maximum);

    const rateControl = findControlNearText(["rate"], 'select, [role="combobox"], button[aria-haspopup="listbox"], input');
    if (rateControl) {
      setComboboxValue(rateControl, "per year");
      if (rateControl.tagName?.toLowerCase() !== "select") {
        await sleep(200);
        await chooseListOption("per year");
      }
    }

    await sleep(250);
    clickElement(findIndeedContinueButton());
  }

  async function indeedStepDescription(jobData) {
    await waitForCondition(() => findTextNode(["describe the job"]), 12000);

    const editor = findControlNearText(["job description"], '[contenteditable="true"], textarea, [role="textbox"]');
    if (editor) {
      if (editor.getAttribute("contenteditable") === "true") {
        await fillContentEditable(editor, jobData.description);
      } else {
        setNativeInputValue(editor, jobData.description);
      }
    }

    await sleep(250);
    clickElement(findIndeedContinueButton());
  }

  async function clickContinueThroughIndeed() {
    const button = findIndeedContinueButton();
    if (!button) return false;
    clickElement(button);
    return true;
  }

  async function runIndeedFlow(jobData) {
    const normalizedJob = normalizeJobData(jobData, "indeed");
    let attempts = 0;
    showControlBar("Indeed", "Starting guided flow", "Preparing the posting wizard");

    while (attempts < 10) {
      attempts += 1;
      showControlBar("Indeed", `Running step ${attempts}`, "Reading the current wizard page");

      const verificationReason = detectHumanVerification();
      if (verificationReason) {
        removeControlBar();
        renderBlocker("Indeed", verificationReason, async () => {
          chrome.runtime.sendMessage({
            type: "EXTENSION_LOG",
            message: "Indeed: verification completed manually. Resuming the wizard.",
            status: "Resuming Indeed wizard...",
          });
          await runIndeedFlow(jobData);
        });
        chrome.runtime.sendMessage({
          type: "EXTENSION_LOG",
          message: "Indeed: stopped because CAPTCHA or 2FA was detected during the wizard.",
          status: "Paused on Indeed: complete CAPTCHA/2FA, then continue.",
        });
        return;
      }

      if (findIndeedConfirmButton()) {
        removeControlBar();
        chrome.runtime.sendMessage({
          type: "EXTENSION_LOG",
          message: "Indeed: reached the final Confirm page. Review and submit manually.",
          status: "Indeed ready on Confirm page.",
        });
        window.alert("Indeed is now on the Confirm page. Review everything carefully and submit manually.");
        return;
      }

      if (findTextNode(["add job basics"])) {
        showControlBar("Indeed", "Filling job basics", "Title, fully remote, and no specific residence");
        await indeedStepJobBasics(normalizedJob);
      } else if (findTextNode(["hiring goals"])) {
        showControlBar("Indeed", "Filling hiring goals", "Timeline and number of hires");
        await indeedStepHiringGoals();
      } else if (findTextNode(["add job details"])) {
        showControlBar("Indeed", "Filling job details", "Employment type");
        await indeedStepJobDetails(jobData);
      } else if (findTextNode(["add pay and benefits"])) {
        showControlBar("Indeed", "Filling pay details", "Salary range and yearly rate");
        await indeedStepPay(normalizedJob);
      } else if (findTextNode(["describe the job"])) {
        showControlBar("Indeed", "Filling job description", "Description and requirements");
        await indeedStepDescription(normalizedJob);
      } else {
        showControlBar("Indeed", "Advancing wizard", "Clicking Continue on the current page");
        const moved = await clickContinueThroughIndeed();
        if (!moved) {
          removeControlBar();
          chrome.runtime.sendMessage({
            type: "EXTENSION_LOG",
            message: "Indeed: automation paused because it could not identify the current step.",
            status: "Indeed paused for manual review.",
          });
          window.alert("Indeed automation paused because this step was not recognized. Please review manually.");
          return;
        }
      }

      await sleep(1800);
    }

    removeControlBar();
    chrome.runtime.sendMessage({
      type: "EXTENSION_LOG",
      message: "Indeed: stopped after too many step transitions without reaching Confirm.",
      status: "Indeed paused for manual review.",
    });
    window.alert("Indeed automation stopped before reaching the Confirm page. Please review the current step manually.");
  }

  function scoreDescriptor(descriptor, keywords) {
    if (!keywords || keywords.length === 0) return 0;

    return keywords.reduce((score, keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      return descriptor.normalizedText.includes(normalizedKeyword) ? score + normalizedKeyword.length : score;
    }, 0);
  }

  function findBySelectors(descriptors, selectors) {
    if (!selectors || selectors.length === 0) return null;

    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (!element || !isVisible(element)) continue;
        const match = descriptors.find((descriptor) => descriptor.element === element) || null;
        if (match) return match;
      } catch (error) {
        console.warn("[247Labs Extension] Invalid selector skipped:", selector, error);
      }
    }

    return null;
  }

  function findBestDescriptor(descriptors, rule) {
    const selectorMatch = findBySelectors(descriptors, rule.selectors);
    if (selectorMatch) return selectorMatch;

    const scored = descriptors
      .map((descriptor) => ({
        descriptor,
        score: scoreDescriptor(descriptor, rule.keywords),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    return scored[0]?.descriptor || null;
  }

  function pickSelectOption(element, desiredValue) {
    const normalizedDesired = normalizeText(desiredValue);
    if (!normalizedDesired) return null;

    const options = Array.from(element.options || []);
    const exact = options.find((option) => normalizeText(option.textContent || option.value) === normalizedDesired);
    if (exact) return exact.value;

    const partial = options.find((option) => normalizeText(option.textContent || option.value).includes(normalizedDesired));
    return partial ? partial.value : null;
  }

  function findRadioMatch(descriptors, descriptor, desiredValue) {
    const normalizedDesired = normalizeText(desiredValue);
    const groupName = descriptor.name;
    const group = descriptors.filter((item) => item.type === "radio" && item.name === groupName);

    const match = group.find((item) => {
      const optionText = normalizeText(
        [
          item.label,
          item.legend,
          item.element.value,
          item.element.getAttribute("aria-label") || "",
          item.element.parentElement?.innerText || "",
        ].join(" ")
      );

      return optionText.includes(normalizedDesired);
    });

    return match || null;
  }

  function buildPlan(platform, jobData, descriptors) {
    const profile = PLATFORM_PROFILES[platform] || PLATFORM_PROFILES.generic;
    const normalizedJob = normalizeJobData(jobData, platform);
    const planItems = [];

    if (platform === "wellfound") {
      const salaryRange = parseSalaryRange(normalizedJob.salary);
      const salaryMinInput = document.querySelector('#form-input--salaryMin, input[name="salaryMin"]');
      const salaryMaxInput = document.querySelector('#form-input--salaryMax, input[name="salaryMax"]');

      if (salaryRange.minimum && salaryRange.maximum && salaryMinInput && salaryMaxInput) {
        planItems.push({
          key: "salary",
          label: "Salary",
          status: "ready",
          value: normalizedJob.salary,
          apply: () => {
            setNativeInputValue(salaryMinInput, salaryRange.minimum);
            setNativeInputValue(salaryMaxInput, salaryRange.maximum);
          },
        });
      }
    }

    Object.entries(profile.fieldRules).forEach(([fieldKey, rule]) => {
      if (platform === "wellfound" && fieldKey === "salary" && planItems.some((item) => item.key === "salary")) {
        return;
      }

      const value = normalizedJob[fieldKey] || "";
      const descriptor = findBestDescriptor(descriptors, rule);

      if (!value) {
        planItems.push({
          key: fieldKey,
          label: rule.label,
          status: "manual",
          reason: "Needs manual input: no data available in the template.",
        });
        return;
      }

      if (!descriptor) {
        planItems.push({
          key: fieldKey,
          label: rule.label,
          status: "manual",
          reason: "Needs manual input: matching field not found on this page.",
        });
        return;
      }

      if (descriptor.tag === "select") {
        const optionValue = pickSelectOption(descriptor.element, value);
        if (!optionValue) {
          planItems.push({
            key: fieldKey,
            label: rule.label,
            status: "manual",
            reason: `Needs manual input: no ${rule.label.toLowerCase()} option matches "${value}".`,
            descriptor,
            value,
          });
          return;
        }

        planItems.push({
          key: fieldKey,
          label: rule.label,
          status: "ready",
          descriptor,
          value,
          fillValue: optionValue,
        });
        return;
      }

      if (descriptor.type === "radio") {
        const radioMatch = findRadioMatch(descriptors, descriptor, value);
        if (!radioMatch) {
          planItems.push({
            key: fieldKey,
            label: rule.label,
            status: "manual",
            reason: `Needs manual input: no ${rule.label.toLowerCase()} radio option matches "${value}".`,
            descriptor,
            value,
          });
          return;
        }

        planItems.push({
          key: fieldKey,
          label: rule.label,
          status: "ready",
          descriptor: radioMatch,
          value,
          fillValue: true,
        });
        return;
      }

      if (descriptor.type === "checkbox") {
        const normalizedValue = normalizeText(value);
        const shouldCheck = ["remote", "yes", "true", "1"].includes(normalizedValue);

        if (!shouldCheck) {
          planItems.push({
            key: fieldKey,
            label: rule.label,
            status: "manual",
            reason: `Needs manual input: checkbox mapping for "${value}" should be reviewed manually.`,
            descriptor,
            value,
          });
          return;
        }

        planItems.push({
          key: fieldKey,
          label: rule.label,
          status: "ready",
          descriptor,
          value,
          fillValue: true,
        });
        return;
      }

      planItems.push({
        key: fieldKey,
        label: rule.label,
        status: "ready",
        descriptor,
        value,
        fillValue: value,
      });
    });

    return {
      platformKey: platform,
      platformLabel: profile.label,
      planItems,
      detectedFields: descriptors,
    };
  }

  function setNativeInputValue(element, value) {
    const prototype =
      element.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    if (setter) setter.call(element, value);
    else element.value = value;

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function fillContentEditable(element, value) {
    element.focus();
    document.execCommand("selectAll", false, null);
    
    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", value);
      const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dataTransfer });
      element.dispatchEvent(pasteEvent);
    } catch (err) {
      console.warn("[247Labs Extension] Paste event failed, falling back to execCommand", err);
    }

    if (!element.innerText || element.innerText.length < value.length * 0.5) {
      document.execCommand("insertText", false, value);
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));

    await sleep(50);
    element.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", keyCode: 32, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keypress", { key: " ", code: "Space", keyCode: 32, bubbles: true }));
    document.execCommand("insertText", false, " ");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key: " ", code: "Space", keyCode: 32, bubbles: true }));

    await sleep(50);
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace", keyCode: 8, bubbles: true }));
    document.execCommand("delete", false, null);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key: "Backspace", code: "Backspace", keyCode: 8, bubbles: true }));

    element.blur();
  }

  function textToHtml(value) {
    return escapeHtml(value)
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function fillCodeMirror(element, value) {
    const wrapper =
      element?.classList?.contains("CodeMirror")
        ? element
        : element?.closest?.(".CodeMirror") || element?.closest?.(".EasyMDEContainer")?.querySelector(".CodeMirror");
    const instance = wrapper?.CodeMirror || element?.CodeMirror;
    const host = element?.closest?.("#react-simplemde-editor-wrapper") || wrapper?.closest?.("#react-simplemde-editor-wrapper");

    if (instance) {
      try {
        if (instance.getDoc && typeof instance.getDoc === "function") {
          instance.getDoc().setValue(value);
        } else if (typeof instance.setValue === "function") {
          instance.setValue(value);
        }

        if (typeof instance.save === "function") {
          instance.save();
        }

        if (typeof instance.refresh === "function") {
          instance.refresh();
        }

        if (typeof instance.focus === "function") {
          instance.focus();
        }

        const instanceTextarea = typeof instance.getTextArea === "function" ? instance.getTextArea() : null;
        const hiddenTextarea = instanceTextarea || host?.querySelector("textarea");
        if (hiddenTextarea) {
          setNativeInputValue(hiddenTextarea, value);
          hiddenTextarea.dispatchEvent(new Event("input", { bubbles: true }));
          hiddenTextarea.dispatchEvent(new Event("change", { bubbles: true }));
          hiddenTextarea.dispatchEvent(new Event("blur", { bubbles: true }));
        }

        wrapper?.dispatchEvent(new Event("input", { bubbles: true }));
        wrapper?.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      } catch (error) {
        console.error("[247Labs Extension] CodeMirror fill via instance failed:", error);
      }
    }

    const textarea =
      element?.tagName?.toLowerCase() === "textarea"
        ? element
        : wrapper?.querySelector("textarea") || host?.querySelector("textarea");

    if (textarea) {
      setNativeInputValue(textarea, value);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    }

    return false;
  }

  async function fillWellfoundPrimaryRole(value) {
    const control =
      document.querySelector('#form-input--primaryRoleId .select__control') ||
      document.querySelector('#react-select-form-input--primaryRoleId-input') ||
      findControlNearText(["primary role"], '[role="combobox"], input, .select__control');

    if (!control || !value) return false;

    clickElement(control);
    await sleep(250);

    const roleInput = document.querySelector('#react-select-form-input--primaryRoleId-input');
    if (roleInput) {
      setNativeInputValue(roleInput, value);
      await sleep(250);
    }

    return await chooseListOption(value, 5000);
  }

  async function fillLinkedInJobTitle(value) {
    const input =
      findControlNearText(["job title"], 'input, [role="combobox"]') ||
      document.querySelector('input[aria-label*="job title" i], input[name*="jobTitle" i], input[id*="jobTitle" i], input[id*="job-title" i]');

    if (!input || !value) return false;

    clickElement(input);
    await sleep(150);
    setNativeInputValue(input, value);
    await sleep(350);

    const exactOption = await waitForCondition(
      () =>
        findVisibleElements('[role="option"], li, div').find((element) => {
          if (element.closest(`#${PREVIEW_ROOT_ID}`)) return false;
          const text = elementText(element);
          return text === normalizeText(value);
        }),
      4000
    );

    if (exactOption) {
      clickElement(exactOption);
      return true;
    }

    const firstSuggestion = await waitForCondition(
      () =>
        findVisibleElements('[role="option"], li, div').find((element) => {
          if (element.closest(`#${PREVIEW_ROOT_ID}`)) return false;
          const text = elementText(element);
          return Boolean(text) && (text.includes(normalizeText(value)) || normalizeText(value).includes(text));
        }),
      3000
    );

    if (firstSuggestion) {
      clickElement(firstSuggestion);
      return true;
    }

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
    return true;
  }

  function getActionElementText(element) {
    return normalizeText(
      [
        element.innerText,
        element.textContent,
        element.value,
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  function findLinkedInContinueButton() {
    const candidates = findVisibleElements(
      [
        "button",
        'a[role="button"]',
        '[role="button"]',
        'input[type="button"]',
        'input[type="submit"]',
        ".artdeco-button",
      ].join(", ")
    )
      .filter((element) => {
        if (element.closest(`#${PREVIEW_ROOT_ID}`) || element.closest(`#${CONTROL_BAR_ID}`)) return false;
        if (!isEnabledControl(element)) return false;

        const text = getActionElementText(element);
        if (!text) return false;
        if (includesAny(text, ["post job", "publish job", "submit job", "promote job", "finish"])) return false;

        return includesAny(text, ["continue", "next", "review"]);
      })
      .sort((left, right) => right.getBoundingClientRect().bottom - left.getBoundingClientRect().bottom);

    return candidates[0] || null;
  }

  function findLinkedInFinalSubmitButton() {
    return findButtonByText(["post job", "publish job", "submit job", "finish"]);
  }

  function isLinkedInPromotionStep() {
    const url = normalizeText(window.location.href || "");
    const pageText = normalizeText(document.body.innerText || "");
    return (
      includesAny(url, ["free-trial", "checkout", "promotion", "promote"]) ||
      includesAny(pageText, [
        "promote your job post",
        "boost your job post",
        "select your payment method",
        "payment method",
        "order summary",
        "today's total",
        "daily average",
        "daily budget",
        "secure checkout",
        "start with ca$50 credit",
        "one-time ca$50 credit",
      ])
    );
  }

  function findLinkedInNotNowButton() {
    const candidates = findVisibleElements(
      [
        "button",
        "a",
        '[role="button"]',
        'input[type="button"]',
        'input[type="submit"]',
        ".artdeco-button",
      ].join(", ")
    )
      .filter((element) => {
        if (element.closest(`#${PREVIEW_ROOT_ID}`) || element.closest(`#${CONTROL_BAR_ID}`)) return false;
        if (!isEnabledControl(element)) return false;

        const text = getActionElementText(element);
        if (text.includes("skip to") || text.includes("skip search")) return false;
        return includesAny(text, ["not now", "skip", "no thanks", "maybe later", "without promoting"]);
      })
      .sort((left, right) => right.getBoundingClientRect().bottom - left.getBoundingClientRect().bottom);

    return candidates[0] || null;
  }

  async function waitForLinkedInNotNowButton(timeoutMs = 18000) {
    return await waitForCondition(() => {
      const button = findLinkedInNotNowButton();
      if (button) return button;

      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      return null;
    }, timeoutMs, 500);
  }

  async function skipLinkedInPromotionStep() {
    showControlBar("LinkedIn", "Skipping promotion", "Choosing Not now on the paid boost step");
    const notNowButton = await waitForLinkedInNotNowButton();
    if (!notNowButton) return false;

    clickElement(notNowButton);
    await sleep(1800);
    return true;
  }

  function isLinkedInGeneratedDescriptionStep() {
    const settingsHeading = findTextNode(
      ["review your job settings", "job settings"],
      "h1, h2, h3"
    );
    if (settingsHeading || findTextNode(["screening questions", "rejection settings"], "h2, h3, h4, div")) {
      return false;
    }

    const descriptionHeading = findTextNode(
      ["drafted job description", "job description"],
      "h1, h2, h3"
    );
    const descriptionHelper = findTextNode(
      [
        "make edits or continue as is",
        "edit your job description before continuing",
        "edit to include key information for job seekers",
        "job seekers such as salary range and benefits",
        "provide a summary of the role",
      ],
      "p, div, span"
    );
    const hasDescriptionEditor = Boolean(findLinkedInDescriptionEditor());

    return (
      Boolean(descriptionHeading && (descriptionHelper || hasDescriptionEditor)) ||
      Boolean(hasDescriptionEditor && findTextNode(["draft with ai"], "button, span, div"))
    );
  }

  function findLinkedInDescriptionEditor() {
    const selectors = [
      'textarea[aria-label*="description" i]',
      '[contenteditable="true"][aria-label*="description" i]',
      '[role="textbox"][aria-label*="description" i]',
      ".ql-editor",
      '[contenteditable="true"]',
      '[role="textbox"]',
      "textarea",
    ].join(", ");

    const candidates = findVisibleElements(selectors)
      .filter((element) => {
        if (element.closest(`#${PREVIEW_ROOT_ID}`) || element.closest(`#${CONTROL_BAR_ID}`)) return false;
        if (element.closest("button, [role='button'], [aria-hidden='true']")) return false;
        const rect = element.getBoundingClientRect();
        if (rect.height < 160 || rect.width < 350) return false;
        return true;
      })
      .sort((left, right) => {
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        return rightRect.width * rightRect.height - leftRect.width * leftRect.height;
      });

    return candidates[0] || null;
  }

  function findLinkedInDescriptionEditButton() {
    const descriptionLabel = findTextNode(["job description"], "h1, h2, h3, h4");
    if (!descriptionLabel) return null;

    const labelRect = descriptionLabel.getBoundingClientRect();
    const candidates = findVisibleElements("button, [role='button'], a[role='button']")
      .filter((element) => {
        if (element.closest(`#${PREVIEW_ROOT_ID}`) || element.closest(`#${CONTROL_BAR_ID}`)) return false;
        if (!isEnabledControl(element)) return false;
        const text = getActionElementText(element);
        const hasEditText = includesAny(text, ["edit", "modify"]);
        const hasIconOnly = !text && Boolean(element.querySelector("svg, path, use"));
        return hasEditText || hasIconOnly;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          distance: Math.abs(rect.top - labelRect.top) + Math.abs(rect.left - labelRect.right),
        };
      })
      .sort((left, right) => left.distance - right.distance);

    return candidates[0]?.element || null;
  }

  function linkedInTemplateDescriptionMatchesPage(jobData) {
    const expected = normalizeText(buildLinkedInDescription(jobData)).slice(0, 120);
    if (!expected || expected.length < 40) return true;

    const pageText = normalizeText(document.body.innerText || "");
    return pageText.includes(expected.slice(0, 80));
  }

  function isLinkedInDescriptionReviewCard(jobData) {
    if (linkedInTemplateDescriptionMatchesPage(jobData)) return false;

    const descriptionHeading = findTextNode(["job description"], "h1, h2, h3, h4");
    if (!descriptionHeading) return false;

    return Boolean(findLinkedInDescriptionEditor() || findLinkedInDescriptionEditButton());
  }

  async function openLinkedInDescriptionEditor() {
    const editButton = findLinkedInDescriptionEditButton();
    if (!editButton) return false;

    showControlBar("LinkedIn", "Opening description editor", "Clicking the edit control for the job description");
    clickElementLikeUser(editButton);
    await sleep(1200);
    return Boolean(findLinkedInDescriptionEditor());
  }

  function findLinkedInSaveDescriptionButton() {
    return findButtonByText(["save", "done", "apply", "update"]);
  }

  async function saveLinkedInDescriptionIfNeeded() {
    const saveButton = await waitForCondition(() => findLinkedInSaveDescriptionButton(), 4000, 400);
    if (!saveButton) return false;

    showControlBar("LinkedIn", "Saving description", "Committing the edited job description");
    clickElementLikeUser(saveButton);
    await sleep(1800);
    return true;
  }

  function buildLinkedInDescription(jobData) {
    const normalizedJob = normalizeJobData(jobData, "linkedin");
    const sections = [
      normalizedJob.description,
      normalizedJob.salary ? `Salary range: ${normalizedJob.salary}` : "",
      "Location: Remote",
    ].filter(Boolean);

    return sections.join("\n\n");
  }

  async function fillLinkedInDescriptionEditor(jobData) {
    const value = buildLinkedInDescription(jobData);
    let editor = await waitForCondition(() => findLinkedInDescriptionEditor(), 4000, 500);
    if (!editor) {
      await openLinkedInDescriptionEditor();
      editor = await waitForCondition(() => findLinkedInDescriptionEditor(), 12000, 500);
    }
    if (!editor || !value) return false;

    showControlBar("LinkedIn", "Pasting job description", "Replacing LinkedIn's draft with our generated content");

    if (editor.tagName?.toLowerCase() === "textarea" || editor.tagName?.toLowerCase() === "input") {
      setNativeInputValue(editor, value);
    } else {
      await fillContentEditable(editor, value);
      if (normalizeText(editor.innerText || "").length < 100) {
        editor.innerHTML = textToHtml(value);
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    editor.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: value }));
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    editor.closest("form")?.dispatchEvent(new Event("input", { bubbles: true }));
    editor.closest("form")?.dispatchEvent(new Event("change", { bubbles: true }));
    editor.dispatchEvent(new Event("blur", { bubbles: true }));
    document.body.focus?.();
    await sleep(1200);
    await saveLinkedInDescriptionIfNeeded();
    return true;
  }

  function hasLinkedInDescriptionValidationError() {
    return Boolean(
      findTextNode(
        ["edit your job description before continuing", "job description before continuing"],
        "p, div, span"
      )
    );
  }

  function hasLinkedInServerError() {
    return Boolean(
      findTextNode(["sorry, something went wrong", "please try again"], "p, div, span")
    );
  }

  async function continueLinkedInDescriptionStep() {
    showControlBar("LinkedIn", "Committing description", "Waiting for LinkedIn to accept the pasted content");
    const continueButton = await waitForCondition(() => {
      if (hasLinkedInDescriptionValidationError()) return null;
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      return findLinkedInContinueButton();
    }, 12000, 500);

    const button = continueButton || findLinkedInContinueButton();
    if (!button) return false;

    showControlBar("LinkedIn", "Advancing step", "Clicking Continue after the description was accepted");
    
    clickElementLikeUser(button);
    
    // Wait up to 10 seconds for the step to transition or the button to disappear
    const didTransition = await waitForCondition(() => {
      if (hasLinkedInServerError()) {
        chrome.runtime.sendMessage({
          type: "EXTENSION_LOG",
          message: "LinkedIn: detected a server error, reloading page to recover...",
          status: "Reloading to recover from error...",
        });
        window.location.reload();
        return true;
      }
      const currentBtn = findLinkedInContinueButton();
      return !currentBtn || !isLinkedInGeneratedDescriptionStep();
    }, 10000, 500);

    if (!didTransition) {
      chrome.runtime.sendMessage({
        type: "EXTENSION_LOG",
        message: "LinkedIn: step did not transition, reloading page to force progress...",
        status: "Reloading to recover...",
      });
      window.location.reload();
      await new Promise(() => {});
    }

    await sleep(1000);
    return true;
  }

  async function waitForLinkedInGeneratedDescription() {
    return await waitForCondition(() => {
      const editor =
        findControlNearText(["drafted job description"], 'textarea, [contenteditable="true"], [role="textbox"], div[tabindex]') ||
        findVisibleElements('textarea, [contenteditable="true"], [role="textbox"], div[tabindex]').find((element) =>
          normalizeText(element.innerText || element.value || "").length > 250
        );

      const textLength = normalizeText(editor?.innerText || editor?.value || document.body.innerText || "").length;
      return textLength > 250 ? editor || true : null;
    }, 30000, 500);
  }

  async function waitForLinkedInContinueButton(timeoutMs = 18000) {
    return await waitForCondition(() => {
      const button = findLinkedInContinueButton();
      if (button) return button;

      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      return null;
    }, timeoutMs, 500);
  }

  async function setLinkedInRemoteWorkplace(jobData) {
    const workplaceValue = inferWorkplaceType(jobData, "linkedin") || "Remote";
    const control = findControlNearText(
      ["workplace type", "remote", "on-site", "onsite", "hybrid"],
      'select, [role="combobox"], input, button'
    );

    if (!control) return false;

    if (control.tagName?.toLowerCase() === "select") {
      const optionValue = pickSelectOption(control, workplaceValue);
      if (!optionValue) return false;
      control.value = optionValue;
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    clickElement(control);
    await sleep(250);
    return await chooseListOption(workplaceValue, 4000);
  }

  async function fillLinkedInVisibleStep(jobData) {
    const descriptors = detectFields();
    const plan = buildPlan("linkedin", jobData, descriptors);
    const beforeReady = plan.planItems.filter((item) => item.status === "ready").length;

    await applyPlan(plan);

    const normalizedJob = normalizeJobData(jobData, "linkedin");
    const locationInput = findControlNearText(["location"], "input, [role='combobox']");
    if (locationInput && normalizedJob.location && !String(locationInput.value || "").trim()) {
      setNativeInputValue(locationInput, normalizedJob.location);
      await sleep(250);
      await chooseListOption(normalizedJob.location, 2500);
    }

    await setLinkedInRemoteWorkplace(jobData);

    return beforeReady;
  }

  async function runLinkedInFlow(jobData) {
    const maxSteps = 15;
    for (let step = 0; step < maxSteps; step++) {
      if (isAutomationStopped) throw new Error("AUTOMATION_STOPPED");
      if (window.location.href.includes("/detail/")) {
        removeControlBar();
        chrome.runtime.sendMessage({
          type: "EXTENSION_LOG",
          message: "LinkedIn: automation stopped on job details page.",
          status: "LinkedIn automation complete.",
        });
        chrome.runtime.sendMessage({ type: "STOP_AUTOMATION" });
        return;
      }

      showControlBar("LinkedIn", `Running step ${step + 1}`, "Reading the current posting page");

      const verificationReason = detectHumanVerification();
      if (verificationReason) {
        removeControlBar();
        renderBlocker("LinkedIn", verificationReason, async () => {
          chrome.runtime.sendMessage({
            type: "EXTENSION_LOG",
            message: "LinkedIn: verification completed manually. Resuming the posting flow.",
            status: "Resuming LinkedIn flow...",
          });
          await runLinkedInFlow(jobData);
        });
        chrome.runtime.sendMessage({
          type: "EXTENSION_LOG",
          message: "LinkedIn: paused because CAPTCHA or 2FA was detected during the flow.",
          status: "Paused on LinkedIn: complete CAPTCHA/2FA, then continue.",
        });
        return;
      }

      if (isLinkedInPromotionStep()) {
        const skippedPromotion = await skipLinkedInPromotionStep();
        if (!skippedPromotion) {
          removeControlBar();
          chrome.runtime.sendMessage({
            type: "EXTENSION_LOG",
            message: "LinkedIn: paid promotion step detected, but Not now was not visible.",
            status: "LinkedIn paused on promotion step.",
          });
          chrome.runtime.sendMessage({ type: "STOP_AUTOMATION" });
          return;
        }

        continue;
      }

      if (isLinkedInDescriptionReviewCard(jobData)) {
        showControlBar("LinkedIn", "Writing job description", "Replacing LinkedIn's draft with our exact description");
        await fillLinkedInDescriptionEditor(jobData);
        await continueLinkedInDescriptionStep();
        continue;
      }

      if (findLinkedInFinalSubmitButton()) {
        removeControlBar();
        chrome.runtime.sendMessage({
          type: "EXTENSION_LOG",
          message: "LinkedIn: reached the final submit/review step. Review and submit manually.",
          status: "LinkedIn ready for final review.",
        });
        chrome.runtime.sendMessage({ type: "STOP_AUTOMATION" });
        return;
      }

      if (isLinkedInGeneratedDescriptionStep()) {
        showControlBar("LinkedIn", "Writing job description", "Replacing LinkedIn's AI draft with our exact description");
        await waitForLinkedInGeneratedDescription();
        await fillLinkedInDescriptionEditor(jobData);
        const advancedDescription = await continueLinkedInDescriptionStep();
        if (advancedDescription) continue;
        await sleep(600);
      } else if (findTextNode(["job title"], "label, h1, h2, p, div, span")) {
        showControlBar("LinkedIn", "Filling job title", "Typing and selecting the best matching suggestion");
        await fillLinkedInJobTitle(normalizeJobData(jobData, "linkedin").jobTitle);
        await sleep(450);
      } else {
        showControlBar("LinkedIn", "Filling visible fields", "Scanning labels and controls on this page");
        await fillLinkedInVisibleStep(jobData);
        await sleep(450);
      }

      showControlBar("LinkedIn", "Finding Continue", "Waiting for LinkedIn to enable the next step");
      const continueButton = await waitForLinkedInContinueButton();
      if (!continueButton) {
        if (findLinkedInNotNowButton()) {
          const skippedPromotion = await skipLinkedInPromotionStep();
          if (skippedPromotion) continue;
        }

        removeControlBar();
        chrome.runtime.sendMessage({
          type: "EXTENSION_LOG",
          message: "LinkedIn: automation paused because no Continue button was visible.",
          status: "LinkedIn paused for manual review.",
        });
        chrome.runtime.sendMessage({ type: "STOP_AUTOMATION" });
        return;
      }

      showControlBar("LinkedIn", "Advancing step", "Clicking Continue");
      clickElementLikeUser(continueButton);
      
      const didTransition = await waitForCondition(() => {
        if (isAutomationStopped) throw new Error("AUTOMATION_STOPPED");
        if (hasLinkedInServerError()) {
          chrome.runtime.sendMessage({
            type: "EXTENSION_LOG",
            message: "LinkedIn: detected a server error, reloading page to recover...",
            status: "Reloading to recover from error...",
          });
          window.location.reload();
          return true;
        }
        const btn = findLinkedInContinueButton();
        return !btn || btn !== continueButton;
      }, 10000, 500);

      if (!didTransition) {
        chrome.runtime.sendMessage({
          type: "EXTENSION_LOG",
          message: "LinkedIn: step did not transition, reloading page to force progress...",
          status: "Reloading to recover...",
        });
        window.location.reload();
        await new Promise(() => {});
      }
      
      await sleep(1000);
    }

    removeControlBar();
    chrome.runtime.sendMessage({
      type: "EXTENSION_LOG",
      message: "LinkedIn: stopped after too many step transitions without reaching final review.",
      status: "LinkedIn paused for manual review.",
    });
    chrome.runtime.sendMessage({ type: "STOP_AUTOMATION" });
  }

  async function applyPlan(plan) {
    const readyItems = plan.planItems.filter((item) => item.status === "ready");

    for (const item of readyItems) {
      if (typeof item.apply === "function") {
        try {
          await item.apply();
        } catch (error) {
          console.error("[247Labs Extension] Failed to run custom field fill:", item, error);
        }
        continue;
      }

      const element = item.descriptor.element;
      if (!element) continue;

      try {
        if (item.key === "jobTitle" && plan.platformKey === "linkedin") {
          await fillLinkedInJobTitle(item.fillValue);
          continue;
        }

        if (item.key === "primaryRole" && plan.platformKey === "wellfound") {
          await fillWellfoundPrimaryRole(item.fillValue);
          continue;
        }

        if (item.key === "description" && plan.platformLabel === "Wellfound" && fillCodeMirror(element, item.fillValue)) {
          continue;
        }

        if (item.descriptor.isContentEditable) {
          await fillContentEditable(element, item.fillValue);
          continue;
        }

        if (item.descriptor.tag === "select") {
          element.value = item.fillValue;
          element.dispatchEvent(new Event("change", { bubbles: true }));
          continue;
        }

        if (item.descriptor.type === "radio" || item.descriptor.type === "checkbox") {
          if (!element.checked) element.click();
          continue;
        }

        setNativeInputValue(element, item.fillValue);
      } catch (error) {
        console.error("[247Labs Extension] Failed to fill field:", item, error);
      }
    }
  }

  function removePreview() {
    const root = document.getElementById(PREVIEW_ROOT_ID);
    if (root) root.remove();
  }

  function removeControlBar() {
    const root = document.getElementById(CONTROL_BAR_ID);
    if (root) root.remove();
  }

  function showControlBar(platformLabel, status, detail = "") {
    ensureStyles();

    let root = document.getElementById(CONTROL_BAR_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = CONTROL_BAR_ID;
      root.innerHTML = `
        <div class="agent-dot"></div>
        <div class="agent-copy">
          <div class="agent-title"></div>
          <div class="agent-detail"></div>
        </div>
        <button type="button" class="agent-stop">Stop</button>
      `;
      root.querySelector(".agent-stop").addEventListener("click", () => {
        isAutomationStopped = true;
        removeControlBar();
        chrome.runtime.sendMessage({
          type: "EXTENSION_LOG",
          message: `${platformLabel}: user stopped the guided automation.`,
          status: `${platformLabel} stopped.`,
        });
        chrome.runtime.sendMessage({ type: "STOP_AUTOMATION" });
      });
      document.body.appendChild(root);
    }

    root.querySelector(".agent-title").textContent = `${platformLabel} automation in control`;
    root.querySelector(".agent-detail").textContent = detail ? `${status} - ${detail}` : status;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PREVIEW_ROOT_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: rgba(15, 23, 42, 0.55);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 24px;
        overflow-y: auto;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #${PREVIEW_ROOT_ID} .panel {
        width: min(860px, 100%);
        max-height: calc(100vh - 48px);
        margin: auto 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        border-radius: 24px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        box-shadow: 0 28px 90px rgba(15, 23, 42, 0.35);
        border: 1px solid rgba(148, 163, 184, 0.25);
      }
      #${PREVIEW_ROOT_ID} .header {
        padding: 22px 24px 18px;
        border-bottom: 1px solid rgba(226, 232, 240, 0.9);
      }
      #${PREVIEW_ROOT_ID} .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #0369a1;
        background: rgba(224, 242, 254, 0.95);
        border: 1px solid rgba(125, 211, 252, 0.9);
        border-radius: 999px;
        padding: 7px 10px;
      }
      #${PREVIEW_ROOT_ID} h2 {
        margin: 14px 0 8px;
        font-size: 26px;
        line-height: 1.1;
        color: #0f172a;
      }
      #${PREVIEW_ROOT_ID} p {
        margin: 0;
        color: #475569;
        line-height: 1.6;
      }
      #${PREVIEW_ROOT_ID} .meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 12px;
        margin-top: 18px;
      }
      #${PREVIEW_ROOT_ID} .meta-card {
        border-radius: 18px;
        padding: 14px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(226, 232, 240, 0.95);
      }
      #${PREVIEW_ROOT_ID} .meta-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #64748b;
      }
      #${PREVIEW_ROOT_ID} .meta-value {
        margin-top: 8px;
        font-size: 24px;
        font-weight: 700;
        color: #0f172a;
      }
      #${PREVIEW_ROOT_ID} .body {
        padding: 20px 24px 24px;
        overflow-y: auto;
        flex: 1 1 auto;
        min-height: 0;
      }
      #${PREVIEW_ROOT_ID} .section-title {
        margin: 0 0 12px;
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
      }
      #${PREVIEW_ROOT_ID} .item-list {
        display: grid;
        gap: 12px;
      }
      #${PREVIEW_ROOT_ID} .item {
        border-radius: 18px;
        border: 1px solid rgba(226, 232, 240, 0.95);
        background: #ffffff;
        padding: 14px 16px;
      }
      #${PREVIEW_ROOT_ID} .item.ready {
        border-color: rgba(16, 185, 129, 0.26);
        background: rgba(236, 253, 245, 0.92);
      }
      #${PREVIEW_ROOT_ID} .item.manual {
        border-color: rgba(245, 158, 11, 0.32);
        background: rgba(255, 251, 235, 0.96);
      }
      #${PREVIEW_ROOT_ID} .item-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      #${PREVIEW_ROOT_ID} .item-title {
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
      }
      #${PREVIEW_ROOT_ID} .pill {
        display: inline-flex;
        align-items: center;
        padding: 5px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      #${PREVIEW_ROOT_ID} .pill.ready {
        background: rgba(16, 185, 129, 0.12);
        color: #047857;
      }
      #${PREVIEW_ROOT_ID} .pill.manual {
        background: rgba(245, 158, 11, 0.16);
        color: #b45309;
      }
      #${PREVIEW_ROOT_ID} .item-copy {
        margin-top: 8px;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 13px;
        color: #334155;
      }
      #${PREVIEW_ROOT_ID} .item-help {
        margin-top: 8px;
        font-size: 12px;
        color: #92400e;
      }
      #${PREVIEW_ROOT_ID} .footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 24px 24px;
        border-top: 1px solid rgba(226, 232, 240, 0.9);
        background: rgba(248, 250, 252, 0.92);
        flex-shrink: 0;
      }
      #${PREVIEW_ROOT_ID} .footer-copy {
        font-size: 13px;
        color: #475569;
      }
      #${PREVIEW_ROOT_ID} .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      #${PREVIEW_ROOT_ID} button {
        appearance: none;
        border: 0;
        border-radius: 14px;
        padding: 12px 16px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }
      #${PREVIEW_ROOT_ID} .secondary {
        background: #e2e8f0;
        color: #0f172a;
      }
      #${PREVIEW_ROOT_ID} .primary {
        background: linear-gradient(135deg, #0f172a 0%, #2563eb 100%);
        color: white;
      }
      #${PREVIEW_ROOT_ID} .warning-panel {
        margin-top: 18px;
        border-radius: 18px;
        border: 1px solid rgba(248, 113, 113, 0.35);
        background: rgba(254, 242, 242, 0.95);
        padding: 16px;
        color: #991b1b;
      }
      #${CONTROL_BAR_ID} {
        position: fixed;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483646;
        display: flex;
        align-items: center;
        gap: 12px;
        width: min(720px, calc(100vw - 32px));
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.96);
        color: #ffffff;
        border: 1px solid rgba(148, 163, 184, 0.4);
        box-shadow: 0 18px 60px rgba(15, 23, 42, 0.36);
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #${CONTROL_BAR_ID} .agent-dot {
        width: 10px;
        height: 10px;
        flex: 0 0 auto;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.18);
      }
      #${CONTROL_BAR_ID} .agent-copy {
        min-width: 0;
        flex: 1;
      }
      #${CONTROL_BAR_ID} .agent-title {
        font-size: 13px;
        font-weight: 800;
        color: #ffffff;
      }
      #${CONTROL_BAR_ID} .agent-detail {
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        color: #cbd5e1;
      }
      #${CONTROL_BAR_ID} .agent-stop {
        border: 1px solid rgba(226, 232, 240, 0.24);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
        padding: 8px 11px;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function renderBlocker(platformLabel, reason, onContinue) {
    removePreview();
    ensureStyles();

    const root = document.createElement("div");
    root.id = PREVIEW_ROOT_ID;
    root.innerHTML = `
      <div class="panel">
        <div class="header">
          <div class="eyebrow">Manual verification required</div>
          <h2>${platformLabel}: action paused</h2>
          <p>The extension detected CAPTCHA or 2FA and paused. Complete verification manually, then continue from here.</p>
          <div class="warning-panel">${reason}</div>
        </div>
        <div class="footer">
          <div class="footer-copy">Manual verification stays under your control. Once the page is clear, the extension can continue.</div>
          <div class="actions">
            <button class="primary" data-action="continue">I've completed it</button>
            <button class="secondary" data-action="close">Close</button>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-action="close"]').addEventListener("click", removePreview);
    root.querySelector('[data-action="continue"]').addEventListener("click", async () => {
      removePreview();
      if (typeof onContinue === "function") {
        await onContinue();
      }
    });
    document.body.appendChild(root);
  }

  function renderPreview(plan) {
    removePreview();
    ensureStyles();

    const readyItems = plan.planItems.filter((item) => item.status === "ready");
    const manualItems = plan.planItems.filter((item) => item.status === "manual");

    const root = document.createElement("div");
    root.id = PREVIEW_ROOT_ID;

    const itemsMarkup = plan.planItems
      .map((item) => {
        if (item.status === "ready") {
          return `
            <div class="item ready">
              <div class="item-header">
                <div class="item-title">${item.label}</div>
                <div class="pill ready">Ready to fill</div>
              </div>
              <div class="item-copy">${escapeHtml(item.value)}</div>
            </div>
          `;
        }

        return `
          <div class="item manual">
            <div class="item-header">
              <div class="item-title">${item.label}</div>
              <div class="pill manual">Needs manual input</div>
            </div>
            <div class="item-help">${escapeHtml(item.reason)}</div>
          </div>
        `;
      })
      .join("");

    root.innerHTML = `
      <div class="panel">
        <div class="header">
          <div class="eyebrow">${plan.platformLabel} site profile</div>
          <h2>Preview the form fill before anything is typed</h2>
          <p>Review mapped fields, confirm the values, and fill only the fields the extension can safely identify. You will still submit the page manually.</p>
          <div class="meta">
            <div class="meta-card">
              <div class="meta-label">Detected fields</div>
              <div class="meta-value">${plan.detectedFields.length}</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Ready to fill</div>
              <div class="meta-value">${readyItems.length}</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Manual review</div>
              <div class="meta-value">${manualItems.length}</div>
            </div>
          </div>
        </div>
        <div class="body">
          <div class="section-title">Field mapping preview</div>
          <div class="item-list">${itemsMarkup}</div>
        </div>
        <div class="footer">
          <div class="footer-copy">
            ${manualItems.length > 0
              ? `${manualItems.length} field${manualItems.length === 1 ? "" : "s"} still need manual input after fill.`
              : "All mapped fields can be filled automatically. Manual submit still required."}
          </div>
          <div class="actions">
            <button class="secondary" data-action="cancel">Cancel</button>
            <button class="primary" data-action="fill"${readyItems.length === 0 ? " disabled" : ""}>Fill matched fields</button>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-action="cancel"]').addEventListener("click", () => {
      chrome.runtime.sendMessage({
        type: "EXTENSION_LOG",
        message: `${plan.platformLabel}: user canceled the preview.`,
        status: "Ready",
      });
      removePreview();
    });

    root.querySelector('[data-action="fill"]').addEventListener("click", async () => {
      await applyPlan(plan);
      chrome.runtime.sendMessage({
        type: "EXTENSION_LOG",
        message: `${plan.platformLabel}: filled ${readyItems.length} field${readyItems.length === 1 ? "" : "s"} after user confirmation.`,
        status: "Filled fields. Waiting for manual submit.",
      });
      removePreview();
      window.alert(
        `${plan.platformLabel}: filled ${readyItems.length} field${readyItems.length === 1 ? "" : "s"}.\n` +
          `${manualItems.length > 0 ? `${manualItems.length} field${manualItems.length === 1 ? "" : "s"} still need manual input.\n` : ""}` +
          `Please review the page and submit it manually.`
      );
    });

    document.body.appendChild(root);
  }

  function renderIndeedAutomationPreview(jobData) {
    removePreview();
    ensureStyles();

    const normalizedJob = normalizeJobData(jobData, "indeed");
    const salary = parseSalaryRange(normalizedJob.salary);
    const employmentTypes = inferEmploymentTypes(jobData);

    const root = document.createElement("div");
    root.id = PREVIEW_ROOT_ID;
    root.innerHTML = `
      <div class="panel">
        <div class="header">
          <div class="eyebrow">Indeed site profile</div>
          <h2>Start the Indeed wizard and stop at Confirm</h2>
          <p>This run will follow the exact Indeed flow you outlined, auto-advance through the wizard, and stop on the final Confirm page without submitting.</p>
          <div class="meta">
            <div class="meta-card">
              <div class="meta-label">Location type</div>
              <div class="meta-value" style="font-size:18px">Fully remote</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Specific location</div>
              <div class="meta-value" style="font-size:18px">No</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Hiring timeline</div>
              <div class="meta-value" style="font-size:18px">2 to 4 weeks</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Benefits</div>
              <div class="meta-value" style="font-size:18px">None</div>
            </div>
          </div>
        </div>
        <div class="body">
          <div class="section-title">Indeed automation summary</div>
          <div class="item-list">
            <div class="item ready">
              <div class="item-header">
                <div class="item-title">Job title</div>
                <div class="pill ready">Will fill</div>
              </div>
              <div class="item-copy">${escapeHtml(normalizedJob.jobTitle || "Needs manual input")}</div>
            </div>
            <div class="item ready">
              <div class="item-header">
                <div class="item-title">Job type</div>
                <div class="pill ready">Will select</div>
              </div>
              <div class="item-copy">${escapeHtml(employmentTypes.join(", "))}</div>
            </div>
            <div class="item ready">
              <div class="item-header">
                <div class="item-title">Pay range</div>
                <div class="pill ready">Will fill</div>
              </div>
              <div class="item-copy">${escapeHtml(salary.minimum && salary.maximum ? `${salary.minimum} to ${salary.maximum} per year` : normalizedJob.salary || "Needs manual input")}</div>
            </div>
            <div class="item ready">
              <div class="item-header">
                <div class="item-title">Description</div>
                <div class="pill ready">Will fill</div>
              </div>
              <div class="item-copy">${escapeHtml((normalizedJob.description || "").slice(0, 600) || "Needs manual input")}</div>
            </div>
          </div>
        </div>
        <div class="footer">
          <div class="footer-copy">The extension will not click the final Confirm button. You will review that page manually.</div>
          <div class="actions">
            <button class="secondary" data-action="cancel">Cancel</button>
            <button class="primary" data-action="start">Start Indeed flow</button>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-action="cancel"]').addEventListener("click", () => {
      chrome.runtime.sendMessage({
        type: "EXTENSION_LOG",
        message: "Indeed: user canceled before starting the wizard automation.",
        status: "Ready",
      });
      removePreview();
    });

    root.querySelector('[data-action="start"]').addEventListener("click", async () => {
      removePreview();
      chrome.runtime.sendMessage({
        type: "EXTENSION_LOG",
        message: "Indeed: starting the guided wizard flow toward the Confirm page.",
        status: "Running Indeed wizard...",
      });
      await runPlatformAutomation("indeed", jobData);
    });

    document.body.appendChild(root);
  }

  function renderLinkedInAutomationPreview(jobData) {
    removePreview();
    ensureStyles();

    const normalizedJob = normalizeJobData(jobData, "linkedin");
    const root = document.createElement("div");
    root.id = PREVIEW_ROOT_ID;
    root.innerHTML = `
      <div class="panel">
        <div class="header">
          <div class="eyebrow">LinkedIn site profile</div>
          <h2>Start the LinkedIn posting flow</h2>
          <p>The extension will fill the visible LinkedIn steps, click Continue between pages, and stop before the final submit action.</p>
          <div class="meta">
            <div class="meta-card">
              <div class="meta-label">Current step</div>
              <div class="meta-value" style="font-size:18px">Job title</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Flow</div>
              <div class="meta-value" style="font-size:18px">Auto-advance</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Final submit</div>
              <div class="meta-value" style="font-size:18px">Manual</div>
            </div>
          </div>
        </div>
        <div class="body">
          <div class="section-title">LinkedIn step summary</div>
          <div class="item-list">
            <div class="item ready">
              <div class="item-header">
                <div class="item-title">Job title</div>
                <div class="pill ready">Will fill</div>
              </div>
              <div class="item-copy">${escapeHtml(normalizedJob.jobTitle || "Needs manual input")}</div>
            </div>
            <div class="item manual">
              <div class="item-header">
                <div class="item-title">Later LinkedIn fields</div>
                <div class="pill manual">Will continue</div>
              </div>
              <div class="item-help">Location, workplace type, salary, and description appear on later LinkedIn screens. The extension will continue through those pages and fill what it can identify.</div>
            </div>
          </div>
        </div>
        <div class="footer">
          <div class="footer-copy">The extension will not click the final post/submit button.</div>
          <div class="actions">
            <button class="secondary" data-action="cancel">Cancel</button>
            <button class="primary" data-action="start">Start LinkedIn flow</button>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-action="cancel"]').addEventListener("click", () => {
      chrome.runtime.sendMessage({
        type: "EXTENSION_LOG",
        message: "LinkedIn: user canceled before filling the job title step.",
        status: "Ready",
      });
      removePreview();
    });

    root.querySelector('[data-action="start"]').addEventListener("click", async () => {
      removePreview();
      chrome.runtime.sendMessage({
        type: "EXTENSION_LOG",
        message: "LinkedIn: starting the guided posting flow.",
        status: "Running LinkedIn flow...",
      });
      await runPlatformAutomation("linkedin", jobData);
    });

    document.body.appendChild(root);
  }

  function escapeHtml(value) {
    return (value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function runPlatformAutomation(platform, jobData) {
    isAutomationStopped = false;
    try {
      if (platform === "linkedin") {
        if (!jobData) return;
        chrome.runtime.sendMessage({
          type: "EXTENSION_LOG",
          message: "LinkedIn: user authorized start of automation.",
          status: "Starting LinkedIn flow...",
        });
        await runLinkedInFlow(jobData);
      } else if (platform === "indeed") {
        if (!jobData) return;
        chrome.runtime.sendMessage({
          type: "EXTENSION_LOG",
          message: "Indeed: user authorized start of automation.",
          status: "Starting Indeed flow...",
        });
        await runIndeedFlow(jobData);
      }
    } catch (error) {
      if (error.message === "AUTOMATION_STOPPED") {
        console.log("[247Labs Extension] Automation was stopped by the user.");
      } else {
        console.error("[247Labs Extension] Automation error:", error);
      }
    }
  }

  async function preparePlatformFill(platform, jobData) {
    const profile = PLATFORM_PROFILES[platform] || PLATFORM_PROFILES.generic;

    chrome.runtime.sendMessage({
      type: "EXTENSION_LOG",
      message: `${profile.label}: scanning form fields for preview.`,
      status: `Scanning ${profile.label} form...`,
    });

    const verificationReason = detectHumanVerification();
    if (verificationReason) {
      renderBlocker(profile.label, verificationReason, async () => {
        chrome.runtime.sendMessage({
          type: "EXTENSION_LOG",
          message: `${profile.label}: verification completed manually. Rescanning the form.`,
          status: `Rescanning ${profile.label} form...`,
        });
        await preparePlatformFill(platform, jobData);
      });
      chrome.runtime.sendMessage({
        type: "EXTENSION_LOG",
        message: `${profile.label}: stopped because CAPTCHA or 2FA was detected.`,
        status: `Paused on ${profile.label}: complete CAPTCHA/2FA, then continue.`,
      });
      return;
    }

    if (platform === "indeed") {
      renderIndeedAutomationPreview(jobData);
      chrome.runtime.sendMessage({
        type: "EXTENSION_LOG",
        message: "Indeed: automation preview ready. Waiting for user confirmation to start the wizard.",
        status: "Indeed preview ready.",
      });
      return;
    }

    if (platform === "linkedin") {
      chrome.runtime.sendMessage({
        type: "EXTENSION_LOG",
        message: "LinkedIn: starting the guided posting flow.",
        status: "Running LinkedIn flow...",
      });
      await runLinkedInFlow(jobData);
      return;
    }

    const descriptors = detectFields();
    const plan = buildPlan(platform, jobData, descriptors);

    renderPreview(plan);

    chrome.runtime.sendMessage({
      type: "EXTENSION_LOG",
      message:
        `${profile.label}: preview ready with ` +
        `${plan.planItems.filter((item) => item.status === "ready").length} matched field(s) and ` +
        `${plan.planItems.filter((item) => item.status === "manual").length} manual field(s).`,
      status: `Preview ready on ${profile.label}.`,
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PREPARE_PLATFORM_FILL") {
      setTimeout(() => {
        preparePlatformFill(message.platform, message.jobData || {});
      }, 1200);

      sendResponse({ ok: true });
    }
  });
})();
