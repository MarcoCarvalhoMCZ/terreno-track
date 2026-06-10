import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const isExternalDomMutationError = (message?: string) =>
  message?.includes("insertBefore") ||
  message?.includes("removeChild") ||
  message?.includes("appendChild");

// Prevent browser translators/extensions from rewriting React-managed nodes.
// Those rewrites commonly trigger DOM insertBefore/removeChild crashes in production.
document.documentElement.lang = "pt-BR";
document.documentElement.classList.add("notranslate");
document.documentElement.setAttribute("translate", "no");
document.body.classList.add("notranslate");
document.body.setAttribute("translate", "no");

// Global handler for unhandled promise rejections (prevents blank screens)
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled rejection:", event.reason);
  event.preventDefault();
});

// Global handler for uncaught errors (prevents blank screens from DOM manipulation errors)
window.addEventListener("error", (event) => {
  // insertBefore errors are typically caused by browser extensions modifying the DOM
  if (isExternalDomMutationError(event.message)) {
    console.warn("DOM manipulation error caught (likely browser extension):", event.message);
    event.preventDefault();
    return;
  }
});

const rootElement = document.getElementById("root")!;

// Ensure the root element is clean before rendering
while (rootElement.firstChild) {
  rootElement.removeChild(rootElement.firstChild);
}

createRoot(rootElement).render(<App />);
