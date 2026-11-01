import { Mastra } from '@mastra/core';
import { daybackResearchWorkflow } from './workflows/research-workflow';

export const mastra = new Mastra({
  workflows: { daybackResearchWorkflow },
});
