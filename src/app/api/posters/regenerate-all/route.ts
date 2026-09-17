import { getCurrentLeague } from "@/lib/league";
import { regenerateAllCurrentWeekPosters } from "@/lib/posterGen";

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => controller.enqueue(encoder.encode(sseEvent(data)));

      try {
        const league = await getCurrentLeague();
        const result = await regenerateAllCurrentWeekPosters(league.id, (progress) => {
          send({ type: "progress", ...progress });
        });
        send({ type: "done", ...result });
      } catch (err) {
        console.error("Failed to regenerate all posters", err);
        send({ type: "error", error: "Regeneration failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
