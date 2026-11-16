const sharp = require("sharp"); const fs = require("fs");
const content = require("./content"); const { fileFlowSvg, bridgeSvg } = require("./diagrams");
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
(async () => {
  for (const [n, svg] of [["diagram-file-flow", fileFlowSvg(content.fileFlow.steps)], ["diagram-bridge", bridgeSvg()]]) {
    fs.writeFileSync(`${out}/${n}.svg`, svg);
    await sharp(Buffer.from(svg), { density: 144 }).png().toFile(`${out}/${n}.png`);
    console.log("rendered", n);
  }
})();
