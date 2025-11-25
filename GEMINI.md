# Project Overview

This is a TypeScript-based Node.js project designed to automate the process of taking screenshots of a website. It uses the `puppeteer` library to control a headless Chrome browser, navigate through pages, and capture full-page screenshots.

The main script, `src/index.ts`, contains the core logic. It starts from a specified URL, discovers new links on the page, and then categorizes each page into one of the following types: `main`, `sub`, `board`, or `tabbed`. Based on the page type, it takes one or more screenshots. For tabbed pages, it clicks through each tab and captures the content.

The screenshots are saved in a `screenshots` directory, organized by the date the script is run.

## Building and Running

To use this project, you need to have Node.js and npm installed.

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Build the project:**
    This command transpiles the TypeScript code to JavaScript and saves it in the `dist` directory.
    ```bash
    npm run build
    ```

3.  **Run the script:**
    This command executes the compiled JavaScript code.
    ```bash
    npm run start
    ```

4.  **Run in development mode:**
    You can also run the TypeScript code directly using `ts-node`. This is useful for development as it doesn't require a separate build step.
    ```bash
    npm run dev
    ```

## Development Conventions

*   **Language:** The project is written in TypeScript.
*   **Code Style:** The code is formatted using standard TypeScript conventions.
*   **Testing:** There are no explicit testing frameworks or scripts set up in this project.

---

## Advanced Screenshot Guidelines

### Handling Dynamic Content (AOS, Lazy Loading)

To ensure that dynamically loaded content (e.g., via AOS library, lazy-loaded images) is fully visible in screenshots, a forced scrolling mechanism should be implemented.

**Method:**
1.  **Force Scroll:** Before taking a screenshot, the page should be programmatically scrolled to the bottom. This triggers the loading and rendering of all dynamic elements.
2.  **Wait for Render:** After scrolling, a short delay is necessary to allow content to fully render.
3.  **Capture:** Take the screenshot only after scrolling and waiting are complete.

This process is best handled by `Puppeteer`, which can execute custom scripts within the browser context to control scrolling behavior.

### Handling Login-Required Pages

To capture pages that require user authentication, a form automation approach can be used as an optional feature.

**Method:**
1.  **UI Option:** The user interface should provide an option (e.g., a checkbox) to enable login.
2.  **Login Credentials:** If login is enabled, the UI will require:
    *   Login Page URL
    *   Username
    *   Password
3.  **Automation Logic (Backend):**
    *   The backend API will receive the login information.
    *   Puppeteer will first navigate to the specified `loginUrl`.
    *   It will then programmatically fill in the username and password fields and click the login button.
    *   After a successful login, it will proceed to the target URL to begin the crawling and screenshot process.