/**
 * downloadFile.ts - Browser File Download Utility
 *
 * Triggers a browser download for a Blob or File object.
 * Uses the HTML5 download attribute to prompt the user to save the file.
 *
 * Usage:
 * ```ts
 * const blob = new Blob(['Hello world'], { type: 'text/plain' });
 * (blob as Blob & { name: string }).name = 'hello.txt';
 * downloadFile(blob as Blob & { name: string });
 * ```
 *
 * Referenced by: Export features, file generation utilities
 */

/**
 * Trigger browser download for a file.
 *
 * Creates a temporary object URL, triggers download, then cleans up.
 *
 * @param file - Blob with a name property
 */
export function downloadFile(file: Blob & { name: string }): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url); // Clean up to prevent memory leaks
}
