import { MistralAIEmbeddings } from "@langchain/mistralai";


const embeddings = new MistralAIEmbeddings({
  model: "mistral-embed",
  apiKey: process.env.MISTRAL_API_KEY,
});
export default embeddings