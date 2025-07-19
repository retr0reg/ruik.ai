## Description

In `https://www.gradio.app/main/guides/pdf-component-example` and `guides/06_custom-components/07_pdf-component-example.md`, gradio built detailed walk-through for creating the custom component that can be integrated in to gradio to preview `.PDF` format files; Nevertheless, the vulnerable `pdfjs-disk` version `3.11.174` is imported as the `## Step 2: Frontend - modify javascript dependencies` instructed; this results arbitrary JavaScript injection possible due to recently discovered `PDF.js` generation via vectorization's evaluation process

## Where-is-it

in both `https://www.gradio.app/main/guides/pdf-component-example` and `guides/06_custom-components/07_pdf-component-example.md`; gradio provided official guidance for integrating `PDF` previewers; this guide consist parts for building PDF component by `gradio cc`, modifying JavaScript dependencies, basic frontend skeleton setting, PDF Rendering logic, Handling The File Upload And Clear, Adding buttons to navigate pages and etc.

However, at _Step 2: Frontend - modify JavaScript dependencies_part, gradio introduced quote:

> We're going to use the [pdfjs](https://mozilla.github.io/pdf.js/) JavaScript library to display the pdfs in the frontend. Let's start off by adding it to our frontend project's dependencies, as well as adding a couple of other projects we'll need.
> 
> From within the `frontend` directory, run `npm install @gradio/client @gradio/upload @gradio/icons @gradio/button` and `npm install --save-dev pdfjs-dist@3.11.174`. Also, let's uninstall the `@zerodevx/svelte-json-view` dependency by running `npm uninstall @zerodevx/svelte-json-view`.
> 
> The complete `package.json` should look like this:

```json
{
  "name": "gradio_pdf",
  "version": "0.2.0",
  "description": "Gradio component for displaying PDFs",
  "type": "module",
  "author": "",
  "license": "ISC",
  "private": false,
  "main_changeset": true,
  "exports": {
    ".": "./Index.svelte",
    "./example": "./Example.svelte",
    "./package.json": "./package.json"
  },
  "devDependencies": {
    "pdfjs-dist": "3.11.174"
  },
  "dependencies": {
    "@gradio/atoms": "0.2.0",
    "@gradio/statustracker": "0.3.0",
    "@gradio/utils": "0.2.0",
    "@gradio/client": "0.7.1",
    "@gradio/upload": "0.3.2",
    "@gradio/icons": "0.2.0",
    "@gradio/button": "0.2.3",
    "pdfjs-dist": "3.11.174"
  }
}
```

as `"pdfjs-dist": "3.11.174"` specifics, this custom gradio component uses version `3.11.174` of `pdfjs-dist`; which is found vulnerable to the recently discovered `CVE-2024-4367` PDF.js 's JavaScript Injection via the Font-injection at `FontMatrix` which is parsed at `this.*compileGlyphImpl*(code, cmds, glyphId);` 's `*new* *Function*(`.

# Impact

Arbitrary Javascript Injection