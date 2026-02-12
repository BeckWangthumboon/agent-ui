export type ComponentFramework = 'react';

export type ComponentStyling = 'tailwind';

export type ComponentDependency = {
  name: string;
  version?: string;
};

export type ComponentDocument = {
  id: string;
  name: string;
  description?: string;
  framework: ComponentFramework;
  styling: ComponentStyling;
  source: {
    repo?: string;
    author?: string;
    license?: string;
    url: string;
  };
  tags: string[];
  useCases: string[];
  dependencies: ComponentDependency[];
  code: {
    fileName: string;
    content: string;
  };
};
