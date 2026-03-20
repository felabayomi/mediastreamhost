import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function describeImage(base64Content: string, mimeType: string): Promise<string> {
  const dataUrl = `data:${mimeType};base64,${base64Content}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "low" },
          },
          {
            type: "text",
            text: `Describe this image concisely for search purposes. Include:
- What objects, people, animals, or scenes are visible
- Any text, logos, or brand names visible in the image
- Colors, style, or mood
- Location or setting if apparent

Reply with a single paragraph of plain text, no bullet points. Be specific and descriptive so someone could find this image by searching for any of its contents.`,
          },
        ],
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}
