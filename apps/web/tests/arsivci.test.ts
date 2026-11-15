import { expect, it } from "vitest";
import { arsivle } from "@/lib/agents/arsivci";
import { createFakeLlm } from "@/lib/agents/fake-llm";

it("ustanın notunu kayda çevirir", async () => {
  const draft = { actualFault: "Gaz kolu hall sensörü", actions: ["gaz kolu değişti"], partsReplaced: ["gaz kolu"] };
  const llm = createFakeLlm([draft]);
  const job = { brand: "Xiaomi", model: null, errorCodes: [], symptoms: ["gaz vermiyor"], customerName: null, customerPhone: null, missingInfo: [] };
  await expect(arsivle({ job, note: "gaz kolu sensörü gitmiş değiştirdim" }, llm)).resolves.toEqual(draft);
  expect(llm.calls[0].user).toContain("gaz kolu sensörü gitmiş değiştirdim");
  expect(llm.calls[0].effort).toBe("low");
});
