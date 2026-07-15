import fs from "node:fs";

const parseFile = "packages/okf/src/parse.ts";
let p = fs.readFileSync(parseFile, "utf8");
p = p.replace(/const eldocId = [^\n]+\n/g, "");
fs.writeFileSync(parseFile, p);

const sqlParserFile = "packages/okf/src/sqlParser.ts";
let s = fs.readFileSync(sqlParserFile, "utf8");
s = s.replace(/status:\s*"pending",\n\s*/g, "");
fs.writeFileSync(sqlParserFile, s);
