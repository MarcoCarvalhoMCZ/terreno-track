import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global handler for unhandled promise rejections (prevents blank screens)
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled rejection:", event.reason);
  event.preventDefault();
});

// Global handler for uncaught errors (prevents blank screens from DOM manipulation errors)
window.addEventListener("error", (event) => {
  // insertBefore errors are typically caused by browser extensions modifying the DOM
  if (event.message?.includes("insertBefore") || event.message?.includes("removeChild") || event.message?.includes("appendChild")) {
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
