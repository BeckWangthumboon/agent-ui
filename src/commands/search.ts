import type { ComponentFramework, ComponentMotion, ComponentStyling, ComponentTopic } from "../types";
import { loadComponentDocuments } from "../loader";
import { ComponentSearchEngine } from "../search";
import { printSearchResults, printValidationIssues } from "../utils/output";

export type SearchCommandOptions = {
  dataDir: string;
  limit: number;
  json: boolean;
  topics: ComponentTopic[];
  framework?: ComponentFramework;
  styling?: ComponentStyling;
  motion?: ComponentMotion;
};

export async function runSearchCommand(query: string, options: SearchCommandOptions): Promise<void> {
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
  const results = engine.search(query, {
    limit: options.limit,
    topics: options.topics,
    framework: options.framework,
    styling: options.styling,
    motion: options.motion,
  });

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          query,
          totalLoaded: documents.length,
          resultCount: results.length,
          results: results.map((result) => ({
            score: result.score,
            document: result.document,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  printSearchResults(results);
}
