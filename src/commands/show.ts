import { loadComponentDocuments } from "../loader";
import { ComponentSearchEngine } from "../search";
import { printComponentDocument, printValidationIssues } from "../utils/output";

export type ShowCommandOptions = {
  dataDir: string;
  json: boolean;
  code: boolean;
};

export async function runShowCommand(id: string, options: ShowCommandOptions): Promise<void> {
  const { entries, issues } = await loadComponentDocuments({ componentsDir: options.dataDir });

  if (issues.length > 0) {
    printValidationIssues(issues);
  }

  const documents = entries.map((entry) => entry.document);
  if (documents.length === 0) {
    console.error("No component documents were loaded.");
    process.exitCode = 1;
    return;
  }

  const engine = new ComponentSearchEngine(documents);
  const document = engine.findById(id) ?? engine.findByIdInsensitive(id);

  if (!document) {
    console.error(`Component not found: ${id}`);
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(document, null, 2));
    return;
  }

  printComponentDocument(document, options.code);
}
