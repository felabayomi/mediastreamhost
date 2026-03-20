import OpenAI from "openai";
import sharp from "sharp";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function describeImage(buffer: Buffer, mimeType: string): Promise<string> {
  // Convert to JPEG via Sharp first — this fixes CMYK, corrupt headers,
  // unusual color profiles, and any other format OpenAI won't accept
  let jpegBuffer: Buffer;
  try {
    jpegBuffer = await sharp(buffer, { failOnError: false, limitInputPixels: false })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new Error("sharp_conversion_failed");
  }

  const base64 = jpegBuffer.toString("base64");
  const dataUrl = `data:image/jpeg;base64,${base64}`;

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
