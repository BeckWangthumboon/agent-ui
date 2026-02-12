import { loadComponentDocuments, validateCodeConsistency } from "../loader";
import { printValidationIssues } from "../utils/output";

export type ValidateCommandOptions = {
  dataDir: string;
  strict: boolean;
  json: boolean;
};

export async function runValidateCommand(options: ValidateCommandOptions): Promise<void> {
  const { entries, issues } = await loadComponentDocuments({ componentsDir: options.dataDir });
  const strictIssues = options.strict ? await validateCodeConsistency(entries) : [];
  const allIssues = [...issues, ...strictIssues];

  const warningCount = allIssues.filter((issue) => issue.level === "warning").length;
  const errorCount = allIssues.filter((issue) => issue.level === "error").length;

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          componentsLoaded: entries.length,
          strictMode: options.strict,
          warningCount,
          errorCount,
          issues: allIssues,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`Loaded components: ${entries.length}`);
    console.log(`Warnings: ${warningCount}`);
    console.log(`Errors: ${errorCount}`);

    if (allIssues.length > 0) {
      printValidationIssues(allIssues);
    }
  }

  if (errorCount > 0) {
    process.exitCode = 1;
  }
}
