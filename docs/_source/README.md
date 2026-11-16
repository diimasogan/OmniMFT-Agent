# Regenerate the OmniMFT documentation
Edit `content.js` (single source of truth), then from a folder with `docx`, `pptxgenjs`, `sharp`,
`react-icons`, `react`, `react-dom` installed:

    node render_diagrams.js ./assets
    node build_docx.js ../OmniMFT-Ops-Copilot-Documentation.docx
    PPTX_SKILL=<pptx skill dir> NODE_PATH=./node_modules node build_pptx.js ../OmniMFT-Ops-Copilot-Presentation.pptx
    node build_html.js ../OmniMFT-Ops-Copilot-Documentation.html
