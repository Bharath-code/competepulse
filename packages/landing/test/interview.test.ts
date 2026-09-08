import { describe, expect, it } from "vitest";
import {
  drills,
  interviewMeta,
  pipelineSteps,
  stackChoices,
  yourStory,
} from "../src/interview/content";

describe("interview briefing content", () => {
  it("covers pitch, pipeline, stack tradeoffs, and drills", () => {
    expect(interviewMeta.headline.length).toBeGreaterThan(10);
    expect(pipelineSteps).toHaveLength(6);
    expect(stackChoices.length).toBeGreaterThanOrEqual(6);
    expect(drills.length).toBeGreaterThanOrEqual(10);
  });

  it("gives every stack choice a why / against / rejected / interview line", () => {
    for (const choice of stackChoices) {
      expect(choice.why.length).toBeGreaterThan(20);
      expect(choice.against.length).toBeGreaterThan(10);
      expect(choice.rejected.length).toBeGreaterThan(5);
      expect(choice.interviewLine.length).toBeGreaterThan(20);
    }
  });

  it("keeps yourStory editable placeholders until the candidate fills them", () => {
    expect(yourStory.owned).toMatch(/TODO/);
    expect(yourStory.hardest).toMatch(/TODO/);
    expect(yourStory.metric).toMatch(/TODO/);
    expect(yourStory.next).toMatch(/TODO/);
  });
});
