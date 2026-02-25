const fs = require("fs");
const content = fs.readFileSync(
  "packages/gold-betting-demo/app/src/styles.css",
  "utf8",
);

let newContent = content.replace(
  `.stream-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}`,
  `.stream-bg {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--panel-border);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}`,
);

newContent = newContent.replace(
  `.stream-stage-placeholder {
  flex: 1;
  min-height: 0;
}`,
  `.stream-stage-placeholder {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}`,
);

// also make betting dock not absolute but part of the column layout maybe?
// Wait, betting dock is position fixed.

fs.writeFileSync("packages/gold-betting-demo/app/src/styles.css", newContent);
