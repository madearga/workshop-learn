import { ModelRuntime } from "@earendil-works/pi-coding-agent";
async function main() {
  const rt = await ModelRuntime.create();
  const m = rt.getModel("openai-codex", "gpt-5.6-luna");
  console.log("model found:", !!m, m?.id, m?.api);
}
main();