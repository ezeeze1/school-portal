# Divine Academy Portal

A highly-polished, modern, and responsive portal application for **Divine Academy** built using **React**, **Vite**, **TypeScript**, and **Tailwind CSS**.

---

## 🚀 How to Deploy on Render

This project is a client-side Single Page Application (SPA). The easiest, fastest, and most cost-effective way to host it is as a **Render Static Site** (which is completely free).

Follow these steps to deploy:

### 1. Create a New Static Site on Render
1. Sign in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** in the top right corner and select **Static Site**.
3. Connect your GitHub or GitLab repository where this code is hosted.

### 2. Configure Your Deployment Settings
Provide Render with the following configuration details:

| Setting | Value |
| :--- | :--- |
| **Name** | `divine-academy` *(or your custom name)* |
| **Region** | Select the region closest to you |
| **Branch** | `main` *(or your active branch)* |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

### 3. Configure Redirects / Rewrites (CRUCIAL)
Since this is a Single Page Application (SPA), all route requests should be redirected to `index.html` so that the React router can handle routing smoothly. Without this, visiting or refreshing subpages will result in a 404 error on Render.

To set up rewrites on Render:
1. In your Static Site settings on Render, navigate to the **Redirects/Rewrites** tab.
2. Click **Add Rule** and enter:
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`
3. Save the rule.

---

## 💻 Local Development

If you want to run this application locally on your machine:

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (version 18+ is recommended).

### Setup Steps
1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will run locally, usually at `http://localhost:3000`.

3. **Build the production version:**
   ```bash
   npm run build
   ```
   This will generate a highly optimized and minified `dist` directory ready for deployment.

---

## 🛠️ Tech Stack
* **Framework:** React 19 (TypeScript)
* **Build Tool:** Vite
* **Styling:** Tailwind CSS v4
* **Icons:** Lucide React
* **Animations:** Motion
