// React import removed as it's not needed in this component
import { createPortal } from "react-dom";

export function Portal({ children }) {
  const portalElement = document.getElementById("core-ui-portal");
  if (!portalElement) return null;
  return createPortal(children, portalElement);
}
