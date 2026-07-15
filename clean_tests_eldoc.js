const fs = require('fs');

const testFiles = [
  'packages/web/src/components/canvas/edges.test.ts',
  'packages/web/src/components/canvas/layoutSize.test.ts',
  'packages/web/src/components/inspector/Inspector.test.tsx',
  'packages/web/src/components/inspector/RelationshipInspector.test.tsx',
  'packages/web/src/components/TemplateApplyDialog.test.tsx'
];

testFiles.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/\s*eldocId:\s*.*?,/g, '');
    fs.writeFileSync(file, content);
  }
});
