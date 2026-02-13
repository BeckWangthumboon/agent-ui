import type { ComponentDocument } from "../types";
import type { ComponentSearchResult } from "../search";
import type { ValidationIssue } from "../loader";
import { toDisplayPath } from "../loader";

export function printValidationIssues(issues: ValidationIssue[]): void {
  for (const issue of issues) {
    const prefix = issue.level === "error" ? "ERROR" : "WARN";
    console.error(`[${prefix}] ${toDisplayPath(issue.path)}: ${issue.message}`);
  }
}

export function printSearchResults(results: ComponentSearchResult[]): void {
  if (results.length === 0) {
    console.log("No matching components found.");
    return;
  }

  for (const [index, result] of results.entries()) {
    const rank = String(index + 1).padStart(2, " ");
    const score = result.score.toFixed(3);
    const { document } = result;

    console.log(`${rank}. [${score}] ${document.name} (${document.id})`);

    console.log(`    intent: ${document.intent}`);

    if (document.topics.length > 0) {
      console.log(`    topics: ${document.topics.join(", ")}`);
    }

    if (document.constraints?.motion) {
      console.log(`    motion: ${document.constraints.motion}`);
    }

    console.log(`    source: ${document.source.url}`);
  }
}

export function printComponentDocument(document: ComponentDocument, includeCode: boolean): void {
  console.log(`id: ${document.id}`);
  console.log(`name: ${document.name}`);
  console.log(`intent: ${document.intent}`);

  console.log(`framework: ${document.framework}`);
  console.log(`styling: ${document.styling}`);
  console.log(`source.url: ${document.source.url}`);

  if (document.source.repo) {
    console.log(`source.repo: ${document.source.repo}`);
  }

  if (document.source.author) {
    console.log(`source.author: ${document.source.author}`);
  }

  if (document.source.license) {
    console.log(`source.license: ${document.source.license}`);
  }

  if (document.topics.length > 0) {
    console.log(`topics: ${document.topics.join(", ")}`);
  }

  if (document.capabilities.length > 0) {
    console.log(`capabilities: ${document.capabilities.join(", ")}`);
  }

  if (document.synonyms.length > 0) {
    console.log(`synonyms: ${document.synonyms.join(", ")}`);
  }

  if (document.constraints?.motion) {
    console.log(`constraints.motion: ${document.constraints.motion}`);
  }

  if (document.dependencies.length > 0) {
    console.log(`dependencies: ${document.dependencies.join(", ")}`);
  }

  console.log(`code.fileName: ${document.code.fileName}`);

  if (includeCode) {
    console.log("--- code ---");
    console.log(document.code.content);
  }
}
