import {ClerkProvider} from "@clerk/react";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Match Clerk's UI to the app's typeface. Inter is already loaded globally in
// index.css; the stack is passed literally because Clerk renders its modals in
// a portal on <body>, outside the .prism-root scope where --font is defined.
const FONT_STACK =
  "'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ClerkProvider
      afterSignOutUrl="/"
      appearance={{
        variables: {
          fontFamily: FONT_STACK,
          fontFamilyButtons: FONT_STACK,
        },
      }}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);