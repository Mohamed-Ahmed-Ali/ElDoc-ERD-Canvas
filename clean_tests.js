const fs = require("node:fs");

const testFiles = [
  "packages/web/src/components/canvas/edges.test.ts",
  "packages/web/src/components/canvas/layoutSize.test.ts",
  "packages/web/src/components/inspector/Inspector.test.tsx",
  "packages/web/src/components/inspector/RelationshipInspector.test.tsx",
  "packages/web/src/components/TemplateApplyDialog.test.tsx",
];

testFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, "utf8");
    content = content.replace(/\s*status:\s*['"'](created|pending|error)['"'],?/g, "");
    fs.writeFileSync(file, content);
  }
});

const modelTs = "packages/web/src/state/model.ts";
let modelContent = fs.readFileSync(modelTs, "utf8");
modelContent = modelContent.replace(
  /id: uid\("c"\),?\n\s*\};/g,
  'id: uid("c"),\n        createdAt: new Date().toISOString(),\n      };',
);
fs.writeFileSync(modelTs, modelContent);

const objInspector = "packages/web/src/components/inspector/ObjectInspector.tsx";
let objContent = fs.readFileSync(objInspector, "utf8");
objContent = objContent.replace(/const isCreated = node\.status === "created";\n/g, "");
fs.writeFileSync(objInspector, objContent);
